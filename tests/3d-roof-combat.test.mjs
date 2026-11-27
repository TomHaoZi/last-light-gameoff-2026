import assert from 'node:assert/strict';
import test from 'node:test';
import { floorActive, Simulation3D, STEP } from '../dist/3d/simulation.js';
import { TILE } from '../dist/3d/levels.js';
import { ROOF_STRIKE, createRoofCombat, roofTarget, updateRoofCombat } from '../dist/3d/roof-combat.js';

const figure = extra => ({x: 0, z: -1.8, active: true, ...extra});
const mock = (ghosts, difficulty) => ({x:0, y:0, z:0, yaw:0, pitch:0, ghosts, difficulty,
  roofCombat:createRoofCombat(), map: { get: () => null }, events: [], emit(type, event) { this.events.push([type,event]); }});
const floor = () => true;

test('roof contact uses current phase, nearest target, range, vertical aim, line of sight and support', () => {
  const nearest = figure({z: -1.4});
  const visible = figure();
  const state = mock([figure({active:false,z:-.4}), figure({banished:true,z:-.5}), figure({z:.8}),
    figure({z:-2.6}), figure({x:.53,z:-.8}), nearest, visible]);
  assert.equal(roofTarget(state, floor), nearest);
  assert.equal(roofTarget(state, (_,z) => z !== nearest.z), visible);
  state.z = TILE / 2;
  state.x = TILE / 2;
  state.pitch = -.3;
  state.ghosts = [figure({ x: state.x, z: -.8 })];
  state.map = { get: () => ({ kind: '#' }) };
  assert.equal(roofTarget(state, floor), null);
  state.map = { get: () => null };
  state.pitch = .85;
  assert.equal(roofTarget(state, floor), null);
});

test('roof strikes trace a real wall corner at the height of the swing', () => {
  const sim = new Simulation3D();
  sim.load(2);
  const ghost = sim.ghosts.find(ghost => ghost.phase === 'day');
  Object.assign(sim, { x: 5.411, z: 17.302, y: 0, night: false });
  Object.assign(ghost, { x: 3.612, z: 15.729, active: true });
  for (const other of sim.ghosts) if (other !== ghost) other.active = false;
  sim.yaw = Math.atan2(ghost.x - sim.x, sim.z - ghost.z);
  const supported = (x, z) => floorActive(sim.map.at(x, z), sim.night);
  assert.ok(supported(sim.x, sim.z) && supported(ghost.x, ghost.z));
  assert.ok(!sim.blocks(sim.x, sim.z) && !sim.blocks(ghost.x, ghost.z, .24));
  assert.equal(sim.map.get(2, 6).kind, '#');

  sim.pitch = -.46;
  updateRoofCombat(sim, .1, true, supported);
  updateRoofCombat(sim, .09, false, supported);
  assert.equal(sim.roofCombat.feedback, 'miss');
  assert.equal(sim.roofCombat.hits, 0);

  // A shallower ray enters above the coping but then intersects its far edge.
  sim.pitch = -.34;
  assert.equal(roofTarget(sim, supported), null);
  sim.pitch = -.29;
  assert.equal(roofTarget(sim, supported), ghost, 'an unobstructed strike above the wall still lands');
});

test('a swing resolves once on its contact frame, with difficulty-based stagger and banishment', () => {
  for (const [difficulty, required] of [['easy',1],['normal',2],['hard',3]]) {
    const ghost = figure();
    const state = mock([ghost], difficulty);
    for (let i = 1; i <= required; i++) {
      updateRoofCombat(state, .1, true, floor);
      assert.equal(ghost.strikes ?? 0, i-1);
      updateRoofCombat(state, .09, true, floor);
      assert.equal(ghost.strikes, i);
      assert.equal(ghost.banished, i===required);
      assert.equal(ghost.stagger, ROOF_STRIKE.stagger);
      for (let j = 0; j < 5; j++) updateRoofCombat(state, .1, false, floor);
      assert.equal(ghost.strikes, i);
      assert.equal(state.roofCombat.swinging, false);
    }
    assert.equal(state.roofCombat.hits, required);
    assert.equal(state.events.filter(([type])=>type === 'roof-impact').length, required);
  }
});

test('shifting the target out during wind-up produces a miss', () => {
  const ghost = figure(), state = mock([ghost], 'easy');
  updateRoofCombat(state, .10, true, floor);
  ghost.active = false;
  updateRoofCombat(state, .08, false, floor);
  assert.equal(state.roofCombat.feedback, 'miss');
  assert.equal(state.roofCombat.hits, 0);
});

test('roof-only state resets on revival and is not persisted in schema 1', () => {
  const sim = new Simulation3D();
  for (const chapter of [0,1]) {
    sim.load(chapter);
    assert.equal(sim.roofCombat, null);
  }
  sim.load(2);
  sim.mode = 'playing';
  const target = sim.ghosts.find(ghost => !ghost.phase);
  target.banished = true;
  sim.togglePhase();
  assert.equal(target.active, false);
  sim.roofCombat.banished++;
  assert.ok(!Object.hasOwn(sim.saveData(), 'roofCombat'));
  sim.startDeath('fall');
  for (let i = 0; i < 2/STEP; i++) sim.step({});
  assert.equal(sim.life, 'alive');
  assert.equal(sim.roofCombat.banished, 0);
  assert.ok(sim.ghosts.find(ghost => !ghost.phase).active);
});
