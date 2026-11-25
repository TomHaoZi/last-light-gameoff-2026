import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/simulation.js';
import {freshSave,loadSave,storeSave} from '../dist/save.js';
import {CHASE_START,CHASE_LAMP,CHASE_OBSTACLES,annexFloorAt,annexScore,replayAnnex} from '../dist/backrooms.js';

function enter(expanded=true) {
  const data=freshSave();
  Object.assign(data,{floor:1,sector:2,worldRevision:expanded?2:1,mechanisms:['1/archive']});
  data.chapterProgress[1]=[true,true,true];
  const world=new Simulation(data);world.start();
  const p=world.player;
  p.x=world.exitX-7;p.y=expanded?world.exitY:200;p.grounded=true;
  world.interact();
  for(let i=0;i<360&&!world.backrooms;i++)world.step();
  assert.ok(world.backrooms,'the normal archive transfer must enter the Annex');
  return world;
}
function run(world,{offset=0,stopX=Infinity,flip=true,jump=true}={}) {
  const jumps=[],shifts=[],start=world.time;
  for(let i=0;i<6000&&world.backrooms&&world.player.x<stopX&&!world.death;i++){
    const next=CHASE_OBSTACLES[world.backrooms.next],p=world.player,input={right:true};
    if(next&&jump&&p.grounded&&!jumps.includes(next.id)&&next.x-p.x<=next.launch+offset){
      jumps.push(next.id);input.jump=true;
    }
    if(next?.phase&&flip&&!p.grounded&&p.y+38<next.y&&jumps.includes(next.id)&&!shifts.includes(next.id)&&(world.night?'night':'day')!==next.phase){
      shifts.push(next.id);input.shift=true;
    }
    world.step(input);
  }
  return {jumps,shifts,duration:world.time-start};
}
for(const offset of [-4,0,5])test('full stride clears the 37 obstacles and nine airborne shifts with launch offset '+offset,()=>{
  const world=enter(),before=world.shifts,result=run(world,{offset});
  assert.equal(world.death,null);assert.equal(world.deaths,0);
  assert.equal(world.backrooms,null);assert.equal(world.floor,1);assert.equal(world.sector,3);
  assert.equal(result.jumps.length,37);assert.equal(result.shifts.length,9);assert.equal(world.shifts-before,9);
  assert.ok(result.duration>45.0&&result.duration<45.2,String(result.duration));
  assert.ok(world.events.includes('backrooms-escaped'));assert.equal(annexScore(world),null);
});
test('the ghost catches a player who stops; entering and respawning leave time to read before running',()=>{
  const world=enter();
  for(let i=0;i<420;i++)world.step();
  assert.equal(world.player.x,CHASE_START);assert.equal(world.backrooms.active,false);
  for(let i=0;i<55;i++)world.step({right:true});
  assert.ok(annexScore(world));world.pause();assert.equal(annexScore(world),null);world.resume();
  const stopAt=world.time;
  for(let i=0;i<300&&!world.death;i++)world.step();
  assert.equal(world.death.kind,'ghost');assert.equal(world.player.anim,'ghostDeath');
  assert.ok(world.time-stopAt<1.5);assert.equal(annexScore(world),null);
  for(let i=0;i<240;i++)world.step();
  assert.equal(world.player.x,CHASE_START);assert.equal(world.player.hp,3);assert.equal(world.backrooms.active,false);
});
test('unshifted long span drops the runner; halfway lamp survives a disk round trip',()=>{
  const world=enter();run(world,{flip:false});
  assert.equal(world.death.kind,'fall');assert.ok(world.player.x>819&&world.player.x<960);
  const fresh=enter();run(fresh,{stopX:CHASE_LAMP+2});assert.ok(fresh.events.includes('backrooms-relit'));
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  storeSave(storage,fresh.persist());
  const resumed=new Simulation(loadSave(storage).data);resumed.start();
  assert.equal(resumed.player.y,annexFloorAt(CHASE_LAMP)-28);
  assert.equal(resumed.player.x,CHASE_LAMP);assert.equal(resumed.backrooms.active,false);
  run(resumed);assert.equal(resumed.deaths,0);assert.equal(resumed.sector,3);
});
test('retained map goes through the corridor before the normal chapter intermission',()=>{
  const world=enter(false),result=run(world);assert.ok(result.duration>40);assert.equal(world.mode,'between');
  assert.ok(world.events.includes('chapter-1-complete'));world.start();assert.equal(world.floor,2);assert.equal(world.backrooms,null);
});

test('chapter replay starts at the entrance and preserves a previously earned final ending and clues',()=>{
  const data=freshSave();Object.assign(data,{floor:1,sector:2,finished:true,ending:'complete',evidence:['night-letter'],
    events:['backrooms-relit','backrooms-escaped'],checkpointId:'annex/emergency-circuit'});
  const world=new Simulation(data);world.mode='playing';replayAnnex(world);
  assert.equal(world.player.x,CHASE_START);
  const restored=new Simulation(structuredClone(world.persist()));restored.start();
  assert.equal(restored.player.x,CHASE_START);run(restored);
  assert.equal(restored.progress.finished,true);assert.equal(restored.ending,'complete');
  assert.deepEqual(restored.progress.evidence,['night-letter']);assert.equal(restored.events.includes('backrooms-replay'),false);
  assert.equal(restored.events.filter(id=>id==='backrooms-escaped').length,1);
});
