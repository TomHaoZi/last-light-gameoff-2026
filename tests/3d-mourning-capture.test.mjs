import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation3D, STEP } from '../dist/3d/simulation.js';
import { clerkCaptureFrame, CLERK_CAPTURE_TIME, CLERK_REVIVAL_TIME } from '../dist/3d/mourning-capture.js';

test('Clerk capture follows continuous authored beats before a covered checkpoint cut', () => {
  const state = { mourningCapture: {side: 1}, life: 'dying', lifeTimer: 0 };
  const sample = time => clerkCaptureFrame({ ...state, lifeTimer: time });
  assert.deepEqual([0, .28, .52, .84, 1.31].map(time => sample(time).beat),
    ['contact', 'hold', 'shroud', 'fall', 'blackout']);
  assert.ok(sample(.28).grip > .9);
  assert.ok(sample(.52).cover > .9);
  assert.ok(sample(.84).stretch > .8);
  assert.equal(sample(CLERK_CAPTURE_TIME).veil, 1);
  let previous = sample(0);
  for (let time = STEP; time < CLERK_CAPTURE_TIME; time += STEP) {
    const frame = sample(time);
    for (const field of ['stretch', 'roll', 'grip', 'cover', 'veil', 'recoil', 'brace']) {
      assert.ok(Number.isFinite(frame[field]));
      assert.ok(Math.abs(frame[field] - previous[field]) < .092, `${field} jumps at ${time}`);
    }
    previous = frame;
  }
  state.life = 'respawning';
  assert.equal(sample(0).veil, 1);
  const quiet = clerkCaptureFrame({...state, lifeTimer: .34}, true);
  assert.ok(quiet.stretch < sample(.34).stretch);
  assert.equal(quiet.veil, sample(.34).veil);
  assert.equal(sample(CLERK_REVIVAL_TIME).veil + sample(CLERK_REVIVAL_TIME).stretch, 0);
});

test('a Clerk capture saves one death, ignores movement, fires each cue once and restores the lamp', () => {
  const sim = new Simulation3D({progress: {schema: 1, chapter: 1, checkpoint: '10/13'}});
  sim.mode = 'playing';
  const lamp = [sim.checkpoint.x, sim.checkpoint.z];
  const captureSpot = [sim.x + .3, sim.z];
  [sim.x, sim.z] = captureSpot;
  const pursuer = sim.ghosts.find(ghost => ghost.kind === 'mourning');
  sim.drain();
  sim.startDeath('gaze', pursuer);
  sim.startDeath('gaze', pursuer);
  assert.equal(sim.hp, 0);
  assert.equal(sim.saveData().deaths, 1);
  assert.equal(sim.saveData().mourningCapture, undefined);
  const sounds = sim.drain().filter(event => event.type === 'sound').map(event => event.name);
  for (let i = 0; i < Math.round(CLERK_CAPTURE_TIME / STEP) - 1; i++) {
    sim.step({forward: 1, shift: true, interact: true});
    sounds.push(...sim.drain().filter(event => event.type === 'sound').map(event => event.name));
  }
  assert.equal(sim.life, 'dying');
  assert.deepEqual([sim.x, sim.z], captureSpot);
  assert.deepEqual(sounds, ['death', 'mourning-bind', 'mourning-floor']);
  for (let i = 0; i < 4 && sim.life === 'dying'; i++) sim.step();
  assert.equal(sim.life, 'respawning');
  assert.equal(clerkCaptureFrame(sim).veil, 1);
  assert.deepEqual([sim.x, sim.z], lamp);
  assert.equal(sim.drain().filter(event => event.name === 'revive').length, 1);
  for (let i = 0; i < Math.ceil(CLERK_REVIVAL_TIME / STEP) + 1; i++) sim.step();
  assert.equal(sim.life, 'alive');
  assert.equal(sim.hp, 3);
  assert.equal(sim.mourningCapture, null);
  assert.equal(sim.saveData().deaths, 1);
});

test('another ghost retains the standard death and checkpoint timing', () => {
  const sim = new Simulation3D();
  sim.mode = 'playing';
  sim.startDeath('ghost', sim.ghosts[0]);
  assert.equal(clerkCaptureFrame(sim), null);
  sim.lifeStep(1.12);
  assert.equal(sim.life, 'respawning');
  sim.lifeStep(.68);
  assert.equal(sim.life, 'alive');
});
