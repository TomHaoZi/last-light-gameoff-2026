import assert from "node:assert/strict";
import test from "node:test";
import { Simulation3D, STEP } from "../dist/3d/simulation.js";
import { mourningHiddenByPartition } from "../dist/3d/mourning-gaze.js";
import { CLERK_CAPTURE_TIME, CLERK_REVIVAL_TIME } from "../dist/3d/mourning-capture.js";

import { transferControls } from '../scripts/play-3d-transfer.mjs';
import { BACKROOMS_TRACK, chaseBlocked, chaseFloor } from '../dist/3d/backrooms-track.js';

test("office occlusion culls only a distant Clerk fully behind a solid wall strip", () => {
  const tiles = new Map([["4/3", {kind: "#", col: 4, row: 3}], ["5/3", {kind: "#", col: 5, row: 3}]]);
  const map = {get: (col, row) => tiles.get(col + "/" + row)};
  const eye = {x: 12, y: 0, z: 1.2};
  const clerk = {x: 12, y: 0, z: 19};
  assert.equal(mourningHiddenByPartition(map, eye, clerk, 2.4), true);
  assert.equal(mourningHiddenByPartition(map, {...eye, y: 1.1}, clerk, 2.4), false);
  assert.equal(mourningHiddenByPartition(map, eye, {...clerk, z: 12}, 2.4), false);
  tiles.delete("5/3");
  assert.equal(mourningHiddenByPartition(map, eye, clerk, 2.4), false);
});

function runTransfer(sim) {
  let jumping = false, shifts = 0;
  const heights = new Map();
  const bypasses = new Map();
  for (let i = 0; i < 60 / STEP && !sim.departing; i++) {
    const input = transferControls(sim);
    const wasNight = sim.night;
    const wasAt = sim.chase.distance;
    sim.step({...input, jump:input.jump && !jumping, release:jumping && !input.jump});
    jumping = input.jump;
    assert.equal(sim.life, 'alive', JSON.stringify(sim.chase));
    if (wasNight !== sim.night) {
      assert.ok(sim.y > .25, 'phase changes with feet off the floor');
      shifts++;
    }
    for (const part of BACKROOMS_TRACK.obstacles) {
      if (wasAt >= part.at || sim.chase.distance < part.at) continue;
      if (part.kind === 'gap' || part.kind === 'hurdle') heights.set(part.id, sim.y);
      if (part.kind === 'rack') bypasses.set(part.id, Math.sign(sim.x - BACKROOMS_TRACK.centerX));
    }
  }
  assert.ok(sim.departing && sim.chase.elapsed >= 40 && sim.chase.elapsed < 52);
  assert.equal(shifts, BACKROOMS_TRACK.obstacles.filter(part => part.kind === 'bridge').length);
  for (const part of BACKROOMS_TRACK.obstacles) {
    if (part.kind === 'gap' || part.kind === 'hurdle') assert.ok(heights.get(part.id) > .35, part.id);
    if (part.kind === 'rack') assert.equal(bypasses.get(part.id), part.opening === 'left' ? -1 : 1, part.id);
  }
}

const directions = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function start(levels) {
  const sim = new Simulation3D({ levels });
  sim.reset();
  sim.drain();
  return sim;
}

function corridor(name, row, details = {}) {
  const wall = "#".repeat(row.length);
  return { id: name, rows: [wall, row, wall], ...details };
}

function advance(sim, seconds) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) sim.step();
}

function nextCell(sim, direction, sprint = false) {
  const [dx, dz] = directions[direction];
  const current = sim.map.at(sim.x, sim.z);
  const target = sim.map.get(current.col + dx, current.row + dz);
  assert.ok(target, `A route leaves ${sim.level.id} at ${current.col},${current.row}`);
  sim.look(Math.atan2(target.x - sim.x, sim.z - target.z) - sim.yaw, (sim.level.mourning ? -.41 : 0) - sim.pitch);
  for (let i = 0; i < Math.ceil(1.6 / STEP); i++) {
    const distance = Math.hypot(target.x - sim.x, target.z - sim.z);
    if (distance < .054 || sim.life !== "alive") break;
    sim.step({ forward: Math.min(1, distance * 12), sprint });
  }
  assert.equal(sim.life, "alive", `${sim.level.id}: ${sim.deathCause} near ${target.col},${target.row}`);
  assert.ok(Math.hypot(target.x - sim.x, target.z - sim.z) < .06,
    `${sim.level.id}: could not reach ${target.col},${target.row}`);
}

function interact(sim, marker) {
  assert.equal(sim.getInteraction()?.tile.kind, marker, `${sim.level.id}: expected ${marker} in range`);
  sim.step({ interact: true });
}

test("office face-to-face stare starts a real charge that stops when the gaze breaks", () => {
  const sim = start([corridor("gaze", "#SN.L..G...E#", { mourning: true, guide: ["Low eyes", "低头"] })]);
  const face = sim.ghosts[0];
  nextCell(sim, "E");
  interact(sim, "N");
  assert.equal(sim.mourningNoteRead, true);
  assert.equal(sim.progress.evidence.length, 0);
  assert.ok(sim.drain().some(event => event.type === "mourning-guide" && event.manual));
  nextCell(sim, "E");
  nextCell(sim, "E");
  interact(sim, "L");
  sim.look(Math.PI / 2 - sim.yaw, -sim.pitch);
  advance(sim, 1);
  assert.equal(sim.gaze, 0, "the emergency lamp protects the player");

  nextCell(sim, "E");
  sim.look(0, -sim.pitch);
  advance(sim, .14);
  assert.ok(sim.watching && sim.gaze > .2);
  const warning = sim.drain();
  assert.ok(warning.some(event => event.type === "mourning-glance"));
  assert.ok(warning.every(event => event.type !== "death"));
  assert.equal(face.x, face.home.x, "there is time to respond to the warning");
  advance(sim, .19);
  assert.ok(face.charging && face.x < face.home.x - .8);
  const stoppedAt = face.x;
  sim.look(0, -.46);
  advance(sim, .7);
  assert.equal(sim.gaze, 0);
  assert.equal(face.charging, false);
  assert.equal(sim.life, "alive");
  assert.equal(face.x, stoppedAt, "the statue stops at the instant you look away");

  sim.look(-.23, .46);
  advance(sim, .9);
  assert.equal(sim.gaze, 0, "peripheral vision stays clear");
  assert.equal(face.x, stoppedAt);
  sim.look(.23, 0);
  advance(sim, .24);
  sim.step({ shift: true });
  assert.equal(sim.gaze, 0, "an inactive phase clears the warning");
  assert.equal(face.active, false);
  const phaseStop = face.x;
  advance(sim, .35);
  assert.equal(face.x, phaseStop);
  sim.step({ shift: true });
  advance(sim, .8);
  assert.equal(sim.deathCause, "gaze");
  assert.ok(Math.hypot(face.x - sim.x, face.z - sim.z) < .62, "only the resulting contact is lethal");
  assert.equal(sim.pursuer, face);
  assert.equal(sim.progress.deaths, 1);
  advance(sim, CLERK_CAPTURE_TIME + CLERK_REVIVAL_TIME + STEP);
  assert.equal(sim.life, "alive");
  assert.equal(sim.gaze, 0);
  assert.equal(sim.x, sim.checkpoint.x);
  assert.equal(sim.z, sim.checkpoint.z);
});

test("office gaze does not see through a wall, but touching an active figure still kills", () => {
  const separate = start([corridor("gaze", "#S..#..G..E#", { mourning: true })]);
  nextCell(separate, "E");
  nextCell(separate, "E");
  separate.look(Math.PI / 2 - separate.yaw, -separate.pitch);
  advance(separate, 1.3);
  assert.equal(separate.gaze, 0);
  assert.equal(separate.life, "alive");

  const open = start([corridor("gaze", "#S.G.E#", { mourning: true })]);
  nextCell(open, "E");
  for (let i = 0; i < 140 && open.life === "alive"; i++) open.step({ forward: 1 });
  assert.equal(open.deathCause, "ghost");
  assert.equal(open.gaze, 0);
});

test("office charge cannot cross a phase gap even after a long stare", () => {
  const sim = start([corridor("gaze", "#S..n.G.E#", { mourning: true })]);
  nextCell(sim, "E");
  nextCell(sim, "E");
  sim.look(Math.PI / 2 - sim.yaw, -sim.pitch);
  const face = sim.ghosts[0];
  advance(sim, 1.7);
  assert.equal(sim.gaze, 1);
  assert.equal(sim.life, "alive");
  assert.ok(face.x < face.home.x - 3);
  assert.notEqual(sim.map.at(face.x, face.z).kind, "n");
});

test("3D difficulty changes the reaction delay, charge speed and hazard recovery", () => {
  const profiles = ["easy", "normal", "hard"].map(difficulty => {
    const sim = start([corridor("gaze", "#S....G.E#", { mourning: true })]);
    nextCell(sim, "E");
    nextCell(sim, "E");
    const face = sim.ghosts[0];
    sim.difficulty = difficulty;
    sim.look(Math.PI / 2 - sim.yaw, -sim.pitch);
    let reaction = 0;
    while (!face.charging && reaction < 120) {
      sim.step();
      reaction++;
    }
    const startedAt = face.x;
    advance(sim, .24);
    assert.ok(face.x < face.home.x);
    sim.hurt();
    return [reaction, startedAt - face.x, sim.shield];
  });
  assert.ok(profiles[0][0] > profiles[1][0] && profiles[1][0] > profiles[2][0]);
  assert.ok(profiles[0][1] < profiles[1][1] && profiles[1][1] < profiles[2][1]);
  assert.ok(profiles[0][2] > profiles[1][2] && profiles[1][2] > profiles[2][2]);
});

test("a shift flips support, and station interaction respects the active phase", () => {
  const sim = start([corridor("phase", "#Sd.An.E#", { requiredPhase: { A: "night" } })]);
  nextCell(sim, "E");
  assert.equal(sim.grounded, true, "the day route supports walking");
  nextCell(sim, "E");
  nextCell(sim, "E");
  interact(sim, "A");
  assert.equal(sim.completed.size, 0);
  assert.ok(sim.drain().some(event => event.id === "needNight"));

  sim.step({ shift: true });
  assert.equal(sim.night, true);
  assert.equal(sim.shiftFx, 1);
  sim.step({ shift: true });
  assert.equal(sim.night, true, "the same transition cannot be reversed immediately");
  advance(sim, .18);
  assert.equal(sim.shiftFx, 0);
  interact(sim, "A");
  assert.deepEqual([...sim.completed], ["A"]);
  nextCell(sim, "E");
  assert.equal(sim.grounded, true, "the night route supports walking");

  sim.step({ jump: true });
  assert.ok(sim.y > 0);
  advance(sim, .7);
  assert.equal(sim.grounded, true);
  sim.step({ shift: true });
  assert.equal(sim.night, false);
  assert.equal(sim.grounded, false);
  assert.equal(sim.atRisk, true);
  advance(sim, .6);
  assert.equal(sim.life, "dying");
  assert.equal(sim.deathCause, "fall");
});

test("machinery costs health, a lamp restores it, and ghost contact kills immediately", () => {
  const levels = [corridor("checkpoint", "#S~L...H...E#")];
  const sim = start(levels);
  nextCell(sim, "E");
  for (let i = 0; i < 360 && sim.hp === 3; i++) sim.step();
  assert.equal(sim.hp, 2);
  assert.ok(sim.drain().some(event => event.type === "hurt"));

  nextCell(sim, "E");
  interact(sim, "L");
  assert.equal(sim.hp, 3);
  assert.equal(sim.checkpoint.kind, "L");
  assert.equal(sim.ghosts[0].active, false);
  sim.step({ shift: true });
  assert.equal(sim.ghosts[0].active, true);
  nextCell(sim, "E");
  nextCell(sim, "E");
  for (let i = 0; i < 480 && sim.life === "alive"; i++) sim.step();
  assert.equal(sim.life, "dying");
  assert.equal(sim.deathCause, "ghost");
  assert.equal(sim.pursuer, sim.ghosts[0]);
  assert.equal(sim.hp, 0);
  assert.equal(sim.progress.deaths, 1);
  assert.ok(sim.drain().some(event => event.type === "warning"));
  assert.ok(sim.saveData().checkpoint);

  advance(sim, 1.13);
  assert.equal(sim.life, "respawning");
  assert.equal(sim.night, false);
  assert.equal(sim.map.at(sim.x, sim.z), sim.checkpoint);
  assert.ok(sim.drain().some(event => event.type === "revive"));
  advance(sim, .7);
  assert.equal(sim.life, "alive");
  assert.equal(sim.hp, 3);
  assert.equal(sim.progress.deaths, 1);
  const restored = new Simulation3D({ levels, progress: sim.saveData() });
  assert.equal(restored.map.at(restored.x, restored.z)?.kind, "L");
  assert.equal(restored.progress.deaths, 1);
});

for (const optional of ["power", "evidence"]) {
  test(`the normal ending remains available with only ${optional}`, () => {
    const sim = start([corridor("ending", "#SE1AP.#")]);
    nextCell(sim, "E");
    interact(sim, "E");
    assert.equal(sim.departing, false);
    assert.ok(sim.drain().some(event => event.id === "locked"));
    nextCell(sim, "E");
    if (optional === "evidence") interact(sim, "1");
    nextCell(sim, "E");
    interact(sim, "A");
    if (optional === "power") {
      nextCell(sim, "E");
      interact(sim, "P");
      nextCell(sim, "W");
    }
    nextCell(sim, "W");
    nextCell(sim, "W");
    interact(sim, "E");
    assert.equal(sim.departing, true);
    assert.equal(sim.door, 0);
    advance(sim, .5);
    assert.ok(sim.door > 0 && sim.door < 1);
    advance(sim, .8);
    assert.equal(sim.mode, "won");
    assert.equal(sim.saveData().finished, true);
    assert.equal(sim.ending, "normal");
  });
}

// One route per chapter with ordinary controls and active enemies.
// Each line ends at a named interaction. * flips the phase and ! means sprint.
const completeRoutes = [
  `* N6 * W N W N @A
    N4 @1
    S E S E S E S E S E S E11 @B
    S W2 S3 E S E @2
    * W N W N W N11 E N E @C
    E3 @E`,
  `N E N12 @A
    W3 @1
    E2 S4 * W S W7 @C
    E5 S E6 E! S E3 N2 E2 S E @B
    N E @2
    N W N3 E N @E`,
  `* N E N5 E N N! @A
    W N6 @P
    W3 @2
    S E2 S3 * W S2 W2 N W2! S W N W2 @B
    S3 @1
    E N E N E3 * E2 N E9 * E4 @C
    * W2 W2! S! W N W3 N W3 N3 E N E2 @E`,
];

function playRoute(sim, route) {
  for (const command of route.trim().split(/\s+/)) {
    if (command === "*") {
      const wasNight = sim.night;
      assert.equal(sim.shiftCooldown, 0, "the route must allow enough time between shifts");
      sim.step({ shift: true });
      assert.equal(sim.night, !wasNight);
    } else if (command.startsWith("@")) {
      interact(sim, command[1]);
    } else {
      const [, dir, count, sprint] = /^([NESW])(\d+)?(!)?$/.exec(command);
      for (let i = 0; i < Number(count ?? 1); i++) nextCell(sim, dir, Boolean(sprint));
    }
  }
}

test("an authored route clears all three chapters and reaches the complete ending", () => {
  const sim = start();
  for (const [chapter, route] of completeRoutes.entries()) {
    assert.equal(sim.levelIndex, chapter);
    playRoute(sim, route);
    assert.deepEqual([...sim.completed].sort(), ["A", "B", "C"]);
    assert.equal(sim.progress.evidence.length, (chapter + 1) * 2);
    assert.equal(sim.departing, true);
    advance(sim, 1.3);
    if (chapter === 1) {
      assert.equal(sim.level.id, 'backrooms');
      runTransfer(sim);
      advance(sim, 1.3);
    }
  }
  assert.equal(sim.mode, "won");
  assert.equal(sim.progress.powered, true);
  assert.equal(sim.progress.deaths, 0);
  assert.equal(sim.ending, "complete");
  const restored = new Simulation3D({ progress: sim.saveData() });
  assert.equal(restored.mode, "won");
  assert.equal(restored.ending, "complete");
});

test('the archive pursuit preserves work across captures and refresh, then releases the roof', () => {
  const saved = {schema:1,chapter:1,work:{1:['A','B','C']},evidence:['1/1'],backrooms:true};
  const sim = new Simulation3D({progress:saved});
  sim.mode = 'playing';
  advance(sim,5);
  assert.equal(sim.chase.started,false);
  sim.step({forward:1});
  advance(sim,2);
  assert.equal(sim.life,'dying');
  assert.equal(sim.deathCause,'ghost');
  assert.ok(sim.ghosts[0].z > sim.z);
  advance(sim,2);
  assert.equal(sim.life,'alive');
  assert.equal(sim.chase.started,false);
  assert.equal(sim.progress.deaths,1);
  for(let i=0;i<60;i++) sim.step({forward:1});
  const restored = new Simulation3D({progress:sim.saveData()});
  assert.equal(restored.chase.started,false);
  assert.deepEqual([...restored.completed].sort(),['A','B','C']);
  restored.mode='playing';
  runTransfer(restored);
  advance(restored,1.3);
  assert.equal(restored.level.id,'roof');
  assert.equal(restored.saveData().backrooms,false);
  assert.equal(new Simulation3D({progress:{schema:1,chapter:2}}).chase,null);
});

test('long phase bridges cannot be jumped or walked in the wrong phase', () => {
  for (const part of BACKROOMS_TRACK.obstacles.filter(p=>p.kind==='bridge')) {
    const night=part.phase==='night';
    for (const at of [part.at+.01,part.at+part.length/2,part.at+part.length-.01]) {
      assert.equal(chaseFloor(at,night),true);
      assert.equal(chaseFloor(at,!night),false);
    }
    assert.ok(part.length>5);
  }
  assert.ok(BACKROOMS_TRACK.length/BACKROOMS_TRACK.speed > 40);
});

test('the far wall stops runners beside the physical exit frame', () => {
  const { centerX, endZ } = BACKROOMS_TRACK;
  for (const side of [-1, 1]) assert.equal(chaseBlocked(centerX + side * 2, endZ - .01, 0, .23), true);
  assert.equal(chaseBlocked(centerX, endZ - .01, 0, .23), false);
});
