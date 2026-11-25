import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { BACKROOMS_TRACK, nextChaseObstacle, rackLane } from '../dist/3d/backrooms-track.js';

// Real controls only. Keep W held through the entire pursuit, including every jump and switch.
export function transferControls(state) {
  const { distance } = state.chase;
  const part = nextChaseObstacle(distance);
  const ahead = part ? part.at - distance : Infinity;
  let side = 0;
  if (part?.kind === 'rack' && ahead < 10) {
    const target = rackLane(part);
    if (Math.abs(target-state.x) > .23) side = Math.sign(target-state.x);
  }
  if (!part && Math.abs(BACKROOMS_TRACK.centerX - state.x) > .10) {
    side = Math.sign(BACKROOMS_TRACK.centerX - state.x);
  }
  const ordinaryJump = part && (part.kind === 'gap' || part.kind === 'hurdle') && ahead <= 1.75 && ahead > -1.65;
  const bridgeJump = part?.kind === 'bridge' && ahead <= 4.45 && ahead > -.6;
  return { forward:1, side, sprint:true, jump: Boolean(ordinaryJump || bridgeJump),
    shift: part?.kind === 'bridge' && ahead <= 3.25 && (part.phase === 'night') !== state.night };
}

export async function runTransfer({snapshot,input,onCrossing,onShift,miss,testSideWall=false}) {
  const held = new Set();
  async function set(key, on) {
    if (held.has(key) === on) return;
    await input(key, on);
    if (on) held.add(key); else held.delete(key);
  }
  const passed = new Map();
  const started = Date.now();
  let minimumLead = Infinity, state, before, wallContact = null, sideWallVerified = false;
  try {
    await set('KeyW',true);
    while (Date.now()-started < 90000) {
      state = await snapshot();
      if (miss && state.life === 'dying') {
        assert.equal(state.deathCause,'fall');
        assert.ok(Math.abs(state.chase.distance - miss.at) < 5);
        return {cause:state.deathCause,at:state.chase.distance};
      }
      assert.equal(state.life,'alive',JSON.stringify(state));
      if (!state.chase || state.chase.exiting) break;
      const controls = transferControls({...state, night:state.phase === 'night'});
      if (testSideWall && !nextChaseObstacle(state.chase.distance) && !sideWallVerified) {
        controls.side = 0;
        if (state.chase.distance >= BACKROOMS_TRACK.length - .12) {
          if (!wallContact) wallContact = { elapsed: state.chase.elapsed, x: state.x, z: state.z };
          if (state.chase.elapsed - wallContact.elapsed >= .35) {
            assert.ok(Math.abs(state.x - BACKROOMS_TRACK.centerX) > 1.7);
            assert.ok(state.chase.distance < BACKROOMS_TRACK.length);
            assert.ok(Math.abs(state.z - wallContact.z) < .12);
            sideWallVerified = true;
          }
        }
      }
      if (miss && nextChaseObstacle(state.chase.distance)?.id === miss.id) {
        controls.jump=false;
        controls.shift=false;
      }
      await set('KeyA',controls.side < 0);
      await set('KeyD',controls.side > 0);
      await set('Space',controls.jump);
      if (controls.shift && !held.has('MouseRight')) {
        assert.ok(state.y > .25, 'Phase-switch input was airborne');
        onShift?.(state);
      }
      await set('MouseRight',controls.shift);
      if (state.chase.started) minimumLead = Math.min(minimumLead,state.chase.headStart);
      for (const part of BACKROOMS_TRACK.obstacles) {
        if (!passed.has(part.id) && state.chase.distance >= part.at) {
          passed.set(part.id,{id:part.id,kind:part.kind,phase:state.phase,y:state.y,x:state.x,elapsed:state.chase.elapsed});
          onCrossing?.(part,state);
          if (part.id === miss?.id) continue;
          if (part.kind === 'hurdle' || part.kind === 'gap') assert.ok(state.y > .25, JSON.stringify({part,state}));
          if (part.kind === 'bridge') assert.equal(state.phase,part.phase);
        }
      }
      before = state;
      await delay(8);
    }
  } finally { for (const key of [...held]) await input(key,false); }
  assert.ok(!miss,'Skipping the obstacle must cause a fall');
  assert.ok(state?.chase?.exiting || state?.chapter === 2,'Reached the fire door');
  assert.equal(passed.size,BACKROOMS_TRACK.obstacles.length);
  if (testSideWall) assert.ok(sideWallVerified, 'Wall beside fire door held while W stayed pressed');
  assert.ok(Math.abs((state.chase ? state : before).x-BACKROOMS_TRACK.centerX)<.59,'Exited through the central doorway');
  const elapsed = state.chase?.elapsed ?? before.chase.elapsed;
  assert.ok(elapsed >= 40 && elapsed < 56);
  return { metres:BACKROOMS_TRACK.length, elapsed, wallSeconds:(Date.now()-started)/1000,
    minimumLead, sideWallVerified, passed:[...passed.values()] };
}
