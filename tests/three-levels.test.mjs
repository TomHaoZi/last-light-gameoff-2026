import assert from "node:assert/strict";
import test from "node:test";
import { decodeLevel, LEVELS, TILE } from "../dist/3d/levels.js";

const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const phases = ["day", "night"];

function walkable(tile, night, omit) {
  if (!tile || tile.kind === "#" || omit(tile)) return false;
  if (tile.kind === "d") return !night;
  if (tile.kind === "n") return night;
  return true;
}

/** A player can swap phase only when standing on ground that survives the swap. */
function search(level, { collectClues = false, switchPhases = true, omit = () => false } = {}) {
  const objectives = collectClues
    ? [...level.stations, ...level.clues, ...(level.power ? [level.power] : [])]
    : level.stations;
  const flags = new Map(objectives.map((tile, i) => [tile, 1 << i]));
  const complete = (1 << objectives.length) - 1;
  const queue = [{ tile: level.spawn, night: false, collected: 0, steps: 0, shifts: 0 }];
  const seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const { tile, night, collected, steps, shifts } = queue[i];
    const accessible = !tile.requiredPhase || tile.requiredPhase === phases[Number(night)];
    const nextFlags = collected | (accessible ? flags.get(tile) ?? 0 : 0);
    const key = `${tile.col},${tile.row}:${Number(night)}:${nextFlags}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tile === level.exit && nextFlags === complete) return { steps, shifts };
    if (switchPhases && walkable(tile, !night, omit)) {
      queue.push({ tile, night: !night, collected: nextFlags, steps, shifts: shifts + 1 });
    }
    for (const [dx, dz] of directions) {
      const adjacent = level.get(tile.col + dx, tile.row + dz);
      if (walkable(adjacent, night, omit)) {
        queue.push({ tile: adjacent, night, collected: nextFlags, steps: steps + 1, shifts });
      }
    }
  }
  return null;
}

test("3D level coordinates match centered cells and the authored markers are unique", () => {
  for (const spec of LEVELS) {
    const level = decodeLevel(spec);
    const markers = spec.rows.join("");
    assert.equal(markers.split("S").length, 2, spec.id);
    assert.equal(markers.split("E").length, 2, spec.id);
    assert.equal(level.worldWidth, level.width * TILE);
    assert.equal(level.worldDepth, level.depth * TILE);
    assert.deepEqual(level.stations.map(t => t.kind).sort(), ["A", "B", "C"]);
    assert.deepEqual(level.clues.map(t => t.kind).sort(), ["1", "2"]);
    assert.ok(level.lamps.length >= 3, spec.id);
    assert.ok(level.ghosts.length >= 2, spec.id);
    assert.ok(level.hazards.some(hazard => hazard.phase === "day"), spec.id);
    assert.ok(level.hazards.some(hazard => hazard.phase === "night"), spec.id);
    assert.equal(level.at(-TILE, 4), null);
    for (const tile of level.tiles) {
      assert.equal(level.at(tile.x, tile.z), tile);
      assert.equal(level.get(tile.col, tile.row), tile);
    }
  }
});

test("all stations, evidence and the rooftop power switch can be reached using phase routes", () => {
  for (const spec of LEVELS) {
    const level = decodeLevel(spec);
    const route = search(level, { collectClues: true });
    assert.ok(route, `${spec.id} full route must be reachable`);
    assert.ok(route.steps > 30 && route.shifts > 2, `${spec.id} must require exploration and repeated shifts`);
    assert.equal(search(level, { switchPhases: false }), null, `${spec.id} should require shifting`);
  }
  const roof = decodeLevel(LEVELS.at(-1));
  assert.equal(roof.power.kind, "P");
  assert.equal(roof.power.row, roof.exit.row);
  for (let col = roof.power.col; col <= roof.exit.col; col++) {
    const tile = roof.get(col, roof.power.row);
    assert.ok(walkable(tile, false, () => false) && walkable(tile, true, () => false));
  }
});

test("each chapter's alternate corridor allows a complete route", () => {
  const mainCorridors = [
    tile => tile.kind === "d" && tile.col >= 9 && tile.col <= 11 && tile.row <= 8,
    tile => tile.kind === "n" && tile.col >= 5 && tile.col <= 6,
    tile => tile.kind === "n" && tile.col >= 16 && tile.col <= 18,
  ];
  for (const [index, spec] of LEVELS.entries()) {
    const level = decodeLevel(spec);
    assert.ok(level.tiles.some(mainCorridors[index]), `${spec.id} omission must block part of the main route`);
    assert.ok(search(level, { omit: mainCorridors[index], collectClues: true }), `${spec.id} alternate route is blocked`);
  }
});

test("active hazards and ghost spawns give each emergency lamp a neutral buffer", () => {
  for (const spec of LEVELS) {
    const level = decodeLevel(spec);
    for (const lamp of level.lamps) {
      const threats = [...level.ghosts, ...level.hazards];
      assert.ok(threats.every(t => Math.hypot(t.col - lamp.col, t.row - lamp.row) >= 2), spec.id);
      assert.ok(directions.some(([dx, dz]) => {
        const tile = level.get(lamp.col + dx, lamp.row + dz);
        return walkable(tile, false, () => false) && walkable(tile, true, () => false);
      }), spec.id);
    }
  }
});
