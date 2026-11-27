import { ROOF_WALL_HEIGHT, TILE } from './levels.js';
import { EYE_HEIGHT, firstSightWall } from './mourning-gaze.js';

// Fictional rescue-tool melee. Simulation, not the viewmodel, owns contact.
export const ROOF_STRIKE = Object.freeze({ windup: .17, cycle: .66, stagger: .77, range: 2.44 });
const BODY_LOW = .32, BODY_HIGH = 1.88;
const HITS = { easy: 1, normal: 2, hard: 3 };

export function createRoofCombat() {
  return { elapsed: 0, swinging: false, feedback: null, feedbackTime: 0, banished: 0, hits: 0 };
}

export function roofTarget(state, supported) {
  const forwardX = Math.sin(state.yaw), forwardZ = -Math.cos(state.yaw);
  const eye = EYE_HEIGHT + state.y;
  const slope = Math.tan(state.pitch);
  let best = null, bestRange = Infinity;
  for (const ghost of state.ghosts) {
    if (!ghost.active || ghost.banished || !supported(ghost.x, ghost.z)) continue;
    const dx = ghost.x - state.x, dz = ghost.z - state.z;
    const range = Math.hypot(dx, dz);
    if (range > ROOF_STRIKE.range || range >= bestRange) continue;
    if (dx * forwardX + dz * forwardZ < range * .87) continue;
    const rise = range * slope;
    const height = eye + rise;
    if (height < BODY_LOW || height > BODY_HIGH) continue;
    const wall = firstSightWall(state.map, state.x, state.z, ghost.x, ghost.z, TILE,
      (enter, exit) => eye + rise * (rise < 0 ? exit : enter) <= ROOF_WALL_HEIGHT);
    if (wall) continue;
    best = ghost;
    bestRange = range;
  }
  return best;
}

export function updateRoofCombat(state, dt, attack, supported) {
  const tool = state.roofCombat;
  if (!tool) return;
  for (const ghost of state.ghosts) ghost.stagger = Math.max(0, (ghost.stagger ?? 0) - dt);
  tool.feedbackTime = Math.max(0, tool.feedbackTime - dt);
  if (attack && !tool.swinging && state.y > -.10) {
    tool.swinging = true;
    tool.elapsed = 0;
    state.emit('sound', { name: 'roof-swing' });
  }
  if (!tool.swinging) return;
  const prior = tool.elapsed;
  tool.elapsed = Math.min(ROOF_STRIKE.cycle, prior + dt);
  if (prior < ROOF_STRIKE.windup && tool.elapsed >= ROOF_STRIKE.windup) {
    const target = state.y > -.10 ? roofTarget(state, supported) : null;
    tool.feedbackTime = .57;
    tool.feedback = 'miss';
    if (target) {
      target.strikes = (target.strikes ?? 0) + 1;
      target.banished = target.strikes >= (HITS[state.difficulty] ?? HITS.normal);
      target.stagger = ROOF_STRIKE.stagger;
      target.alert = 1;
      target.target = null;
      target.refresh = 0;
      tool.hits++;
      if (target.banished) tool.banished++;
      tool.feedback = target.banished ? 'banished' : 'hit';
      state.emit('sound', { name: target.banished ? 'roof-banish' : 'roof-contact', position: target });
      state.emit('roof-impact', { x: target.x, z: target.z, banished: target.banished });
    }
  }
  if (tool.elapsed >= ROOF_STRIKE.cycle) tool.swinging = false;
}
