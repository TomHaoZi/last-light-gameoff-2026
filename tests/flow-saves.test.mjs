import assert from 'node:assert/strict';
import test from 'node:test';
import { Simulation } from '../dist/simulation.js';
import { freshSave, normalizeSave, storeSave, commitSave, restartSave, loadSave, SAVE_KEY as CLASSIC_KEY } from '../dist/save.js';
import { defaultProgress, SAVE_KEY } from '../dist/3d/simulation.js';
import { loadRun, restartRun, storeRun, commitRun } from '../dist/3d/save.js';

test('a classic completed run can resume a revisit and keep its earned ending', () => {
  const completed = { ...freshSave(), floor: 2, sector: 5, finished: true, ending: 'complete' };
  const sim = new Simulation(normalizeSave(completed));
  assert.equal(sim.mode, 'won');
  sim.loadSector(1, 2);
  sim.mode = 'playing';
  const revisited = new Simulation(normalizeSave(sim.persist()));
  assert.equal(revisited.mode, 'menu');
  assert.equal(revisited.floor, 1);
  assert.equal(revisited.sector, 2);
  assert.equal(revisited.progress.finished, true);
  assert.equal(revisited.ending, 'complete');
  revisited.mode = 'between';
  const transfer = new Simulation(normalizeSave(revisited.persist()));
  assert.equal(transfer.mode, 'between');
  transfer.start();
  assert.equal(transfer.floor, 2);
  assert.equal(transfer.progress.finished, true);
});

test('classic recognizes an older completed revisit without awarding an unfinished final scene', () => {
  const older = { ...freshSave(), floor: 1, sector: 2, finished: false, ending: 'normal' };
  const restored = new Simulation(normalizeSave(older));
  assert.equal(restored.mode, 'menu');
  assert.equal(restored.progress.finished, true);
  assert.equal(restored.ending, 'normal');
  const duringCredits = normalizeSave({ ...older, floor: 2, sector: 5 });
  assert.equal(duringCredits.finished, false);
});

test('3D protects future or unreadable data until a confirmed restart backs up its original bytes', () => {
  const data = { schema: 1, ...defaultProgress() };
  for (const raw of ['{"schema":2,"future":true}', '{"schema":1,broken', 'null', '']) {
    const slots = new Map([[SAVE_KEY, raw]]);
    const storage = { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) };
    assert.equal(loadRun(storage).issue, 'protectedSave');
    assert.equal(storeRun(storage, data), 'protectedSave');
    assert.equal(slots.get(SAVE_KEY), raw);
    assert.equal(restartRun(storage), true);
    assert.equal(slots.get(SAVE_KEY + '-backup'), raw);
    assert.deepEqual(loadRun(storage).progress, data);
    assert.equal(storeRun(storage, { ...data, chapter: 1 }), null);
    assert.equal(loadRun(storage).progress.chapter, 1);
  }
});

test('a failed 3D backup leaves the original slot intact', () => {
  const prior = '{"schema":1,"chapter":2}';
  const storage = {
    getItem: key => key === SAVE_KEY ? prior : null,
    setItem(key) {
      assert.equal(key, SAVE_KEY + '-backup');
      throw Error('Storage quota reached');
    },
  };
  assert.equal(restartRun(storage), false);
  assert.equal(loadRun(storage).progress.chapter, 2);
});

test('an older classic tab cannot clobber an upgraded or unreadable save, and explicit restart backs it up', () => {
  const data = freshSave();
  for (const raw of ['{"schemaVersion":4}', '{"worldRevision":3}', '[]', '"invalid"', '{bad', '']) {
    const slots = new Map([[CLASSIC_KEY, raw]]);
    const storage = { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) };
    assert.equal(loadSave(storage).readOnly, true);
    assert.equal(storeSave(storage, data), false);
    assert.equal(slots.get(CLASSIC_KEY), raw);
    restartSave(storage, data);
    const backup = [...slots.keys()].find(key => key.startsWith(CLASSIC_KEY + '-before-restart-'));
    assert.equal(slots.get(backup), raw);
    assert.equal(loadSave(storage).readOnly, false);
    assert.equal(storeSave(storage, { ...data, floor: 1 }), true);
    assert.equal(loadSave(storage).data.floor, 1);
  }
});
test('classic leaves the original intact when an explicit restart backup fails', () => {
  const storage = {
    getItem: key => key === CLASSIC_KEY ? '{"schemaVersion":9}' : null,
    setItem(key) {
      assert.ok(key.startsWith(CLASSIC_KEY + '-before-restart-'));
      throw Error('Quota');
    },
  };
  assert.throws(() => restartSave(storage, freshSave()), /Quota/);
});

function memorySlot() {
  const slots = new Map();
  return { getItem: key => slots.get(key) ?? null, setItem: (key, value) => slots.set(key, value) };
}

const editions = [
  {name:'Classic', key:CLASSIC_KEY, fresh:freshSave, load:loadSave, commit:commitSave,
    reset:restartSave, completed:{floor:2,sector:5,finished:true,ending:'complete'}},
  {name:'3D', key:SAVE_KEY, fresh:()=>({schema:1,...defaultProgress()}), load:loadRun, commit:commitRun,
    reset:restartRun, completed:{chapter:2,finished:true}}
];
for (const {name,key,fresh,load,commit,reset,completed} of editions) {
  test(name+' saves a completed run from a newer tab without letting stale tabs replace it',async()=>{
    const storage=memorySlot(), older=load(storage), newer=load(storage);
    assert.equal(await commit(storage,{...fresh(),...completed},newer),null);
    assert.equal(await commit(storage,fresh(),older),'staleSave');
    assert.equal(JSON.parse(storage.getItem(key)).finished,true);
    const opened=load(storage);
    assert.equal(await commit(storage,{...fresh(),...completed,deaths:1},opened),null);
  });

  test(name+' guards queued writes and keeps an intentional restart distinct from the original save',async()=>{
    const storage=memorySlot(), session=load(storage);
    const data=fresh();
    const queued=commit(storage,data,session);
    data.finished=true;
    assert.equal(await queued,null);
    assert.equal(JSON.parse(storage.getItem(key)).finished,false);
    assert.deepEqual(await Promise.all([commit(storage,fresh(),session),commit(storage,{...fresh(),...completed},session)]),[null,null]);
    assert.equal(JSON.parse(storage.getItem(key)).finished,true);
    const fromPriorRun=load(storage), original=storage.getItem(key);
    reset(storage,fresh());
    assert.notEqual(storage.getItem(key),original);
    assert.equal(JSON.parse(storage.getItem(key)).finished,false);
    assert.equal(await commit(storage,{...fresh(),...completed},fromPriorRun),'staleSave');
    const firstReset=load(storage), emptyRun=load(storage);
    reset(storage,fresh());
    assert.notEqual(storage.getItem(key),firstReset.raw);
    assert.equal(await commit(storage,{...fresh(),...completed},emptyRun),'staleSave');
    assert.equal(await commit(storage,fresh(),load(storage)),null);
  });
}
