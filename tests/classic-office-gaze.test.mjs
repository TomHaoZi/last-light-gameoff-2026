import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_DT } from '../dist/simulation.js';
import { freshSave } from '../dist/save.js';

function encounter() {
  const save = freshSave();
  Object.assign(save, { floor: 1, sector: 0 });
  const world = new Simulation(save);
  world.start();
  world.step({});
  world.drain();
  const ghost = world.ghosts[0];
  world.night = true;
  world.player.x = 170;
  world.player.prevX = 170;
  return { world, ghost };
}

function advance(world, seconds, input = {}) {
  for (let tick = 0; tick < Math.ceil(seconds / FIXED_DT); tick++) world.step(input);
}

test('classic Clerk reacts to player gaze and looks away safely with C', () => {
  const { world, ghost } = encounter();
  assert.equal(ghost.kind, 'mourner');
  advance(world, .25);
  assert.equal(world.officeGaze.looking, true);
  assert.ok(world.officeGaze.amount > .25);
  assert.ok(world.drain().some(event => event.type === 'mourning-glance'));
  advance(world, .75, { walk: true });
  assert.ok(world.player.eyesDown);
  assert.equal(world.officeGaze.amount, 0);
  assert.equal(world.deaths, 0);
  assert.equal(ghost.state, 'patrol');
  advance(world, .88);
  assert.equal(world.deaths, 1);
  assert.equal(world.death.kind, 'ghost');
  assert.equal(world.death.ghost.kind, 'mourner');
  assert.ok(world.drain().some(event => event.type === 'death' && event.cause === 'eye-contact'));
  advance(world, 1.7);
  assert.equal(world.player.lifeState, 'alive');
  assert.equal(world.officeGaze.amount, 0);
  assert.equal(world.night, false);
});

test('classic Clerk respects facing direction, active phase and intervening solid cover', () => {
  const { world } = encounter();
  world.player.dir = -1;
  advance(world, 1);
  assert.equal(world.officeGaze.amount, 0);
  world.player.dir = 1;
  world.night = false;
  advance(world, 1);
  assert.equal(world.officeGaze.amount, 0);
  world.night = true;
  world.walls.push({ x: 206, y: 174, w: 8, h: 54, solid: true });
  advance(world, 1);
  assert.equal(world.officeGaze.amount, 0);
  world.walls.pop();
  world.doors.push({ x: 206, y: 174, w: 8, h: 54, phase: 'closed', openness: 0 });
  advance(world, 1);
  assert.equal(world.officeGaze.amount, 0);
  world.doors.at(-1).openness = 1;
  advance(world, .35);
  assert.ok(world.officeGaze.amount > .3);
});

test('touching a classic Clerk still kills a player with lowered eyes', () => {
  const { world, ghost } = encounter();
  world.player.x = ghost.xNow - 7;
  world.player.prevX = world.player.x;
  world.step({ walk: true });
  assert.equal(world.deaths, 1);
  assert.ok(world.drain().some(event => event.type === 'death' && event.cause === 'mourning-contact'));
});

test('second floor guide is repeatable via the normal interact action', () => {
  const { world } = encounter();
  assert.deepEqual(world.officeGuide, { x: 102, y: 213 });
  world.player.x = 91;
  world.interact();
  assert.ok(world.drain().some(event => event.type === 'mourning-guide' && event.manual));
  world.loadSector(2, 0);
  assert.equal(world.officeGuide, null);
});
