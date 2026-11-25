import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, FIXED_DT } from '../dist/simulation.js';
import { freshSave } from '../dist/save.js';
import { damage } from '../dist/player-state.js';
import { MOURNING_CAPTURE } from '../dist/mourning-clerk.js';
import { mourningShot } from '../dist/mourning-capture-art.js';

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

test('classic Clerk moves only while stared at and kills on contact', () => {
  const { world, ghost } = encounter();
  assert.equal(ghost.kind, 'mourner');
  const home = ghost.xNow;
  advance(world, .16);
  assert.equal(world.officeGaze.looking, true);
  assert.equal(ghost.xNow, home);
  assert.ok(world.drain().some(event => event.type === 'mourning-glance'));
  advance(world, .13);
  assert.equal(world.officeGaze.charging, true);
  assert.ok(ghost.xNow < home - 12);
  const stoppedAt = ghost.xNow;
  advance(world, .75, { walk: true });
  assert.equal(ghost.xNow, stoppedAt);
  assert.equal(world.officeGaze.charging, false);
  assert.ok(world.player.eyesDown);
  assert.equal(world.officeGaze.amount, 0);
  assert.equal(world.deaths, 0);
  assert.equal(ghost.state, 'patrol');
  advance(world, .88);
  assert.equal(world.deaths, 1);
  assert.equal(world.death.kind, 'ghost');
  assert.equal(world.death.ghost.kind, 'mourner');
  assert.ok(Math.abs(world.death.ghost.x - world.player.x - 7) <= 13);
  assert.ok(world.drain().some(event => event.type === 'death' && event.cause === 'eye-contact'));
  const untilImpact = MOURNING_CAPTURE.impact + .04 - world.death.time;
  const where = world.player.x;
  advance(world, untilImpact, { right: true, jump: true, shift: true });
  assert.equal(world.player.x, where);
  assert.equal(world.player.lifeState, 'dying');
  const cues = world.drain().filter(event => event.name?.startsWith('mourning-'));
  assert.deepEqual(cues.map(event => event.name), ['mourning-release', 'mourning-impact']);
  advance(world, .32);
  assert.equal(world.player.lifeState, 'respawning');
  assert.equal(world.player.hp, 3);
  assert.equal(mourningShot(world).kind, 'revive');
  advance(world, MOURNING_CAPTURE.revival);
  assert.equal(world.player.lifeState, 'alive');
  assert.equal(world.officeGaze.amount, 0);
  assert.equal(world.night, false);
});

test('classic capture switches poses and uses a steady reduced-effects sequence', () => {
  const { world } = encounter();
  advance(world, .90);
  const hold = mourningShot(world);
  assert.equal(hold.kind, 'capture');
  assert.ok(hold.lift > 8 && hold.grip > .9);
  world.reducedEffects = true;
  const reduced = mourningShot(world);
  assert.ok(reduced.lift <= 2 && reduced.dropCap === 0 && reduced.dust === 0);
  world.reducedEffects = false;
  advance(world, 1.18 - world.death.time);
  const release = mourningShot(world);
  assert.ok(release.tilt > 1.4 && release.dropCap === 1);
  assert.ok(release.blackout > 0 && release.blackout < 1);
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

test('classic Clerk cannot charge across removed floor support or strike inside the lamp radius', () => {
  const { world, ghost } = encounter();
  world.platforms = world.platforms.filter(platform => platform.y !== 228);
  world.platforms.push({ x: 0, y: 228, w: 200 }, { x: 226, y: 228, w: 74 });
  world.collisionIndex.rebuild(world.platforms);
  advance(world, 1.5);
  assert.ok(ghost.gaze === 1 && ghost.charging);
  assert.ok(ghost.xNow >= 229 && ghost.xNow < 231);
  assert.equal(world.deaths, 0);

  Object.assign(world.player, { x: 109, prevX: 109 });
  Object.assign(ghost, { xNow: 121 });
  advance(world, .45);
  assert.equal(world.deaths, 0);
  assert.equal(ghost.xNow, 121);
  assert.equal(world.officeGaze.amount, 0);
});

test('classic difficulty changes the reaction delay, charge speed and hazard recovery', () => {
  const profiles = ['easy', 'normal', 'hard'].map(difficulty => {
    const { world, ghost } = encounter();
    world.difficulty = difficulty;
    const home = ghost.xNow;
    let reaction = 0;
    while (!ghost.charging && reaction < 120) {
      world.step();
      reaction++;
    }
    const startedAt = ghost.xNow;
    advance(world, .08);
    assert.ok(ghost.xNow < home);
    assert.equal(damage(world, world.player.x - 1), true);
    return [reaction, startedAt - ghost.xNow, world.player.invulnerable];
  });
  assert.ok(profiles[0][0] > profiles[1][0] && profiles[1][0] > profiles[2][0]);
  assert.ok(profiles[0][1] < profiles[1][1] && profiles[1][1] < profiles[2][1]);
  assert.ok(profiles[0][2] > profiles[1][2] && profiles[1][2] > profiles[2][2]);
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
