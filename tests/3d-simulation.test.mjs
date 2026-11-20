import assert from "node:assert/strict";
import test from "node:test";
import { Simulation3D, STEP } from "../dist/3d/simulation.js";

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
  sim.look(Math.atan2(target.x - sim.x, sim.z - target.z) - sim.yaw, 0);
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
  }
  assert.equal(sim.mode, "won");
  assert.equal(sim.progress.powered, true);
  assert.equal(sim.progress.deaths, 0);
  assert.equal(sim.ending, "complete");
  const restored = new Simulation3D({ progress: sim.saveData() });
  assert.equal(restored.mode, "won");
  assert.equal(restored.ending, "complete");
});
