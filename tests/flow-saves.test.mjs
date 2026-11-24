import assert from 'node:assert/strict';
import test from 'node:test';
import { Simulation } from '../dist/simulation.js';
import { freshSave, normalizeSave, storeSave, restartSave, loadSave, SAVE_KEY as CLASSIC_KEY } from '../dist/save.js';
import { defaultProgress, SAVE_KEY } from '../dist/3d/simulation.js';
import { loadRun, restartRun, storeRun } from '../dist/3d/save.js';

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
    getItem: () => prior,
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
    getItem: () => '{"schemaVersion":9}',
    setItem(key) {
      assert.ok(key.startsWith(CLASSIC_KEY + '-before-restart-'));
      throw Error('Quota');
    },
  };
  assert.throws(() => restartSave(storage, freshSave()), /Quota/);
});
