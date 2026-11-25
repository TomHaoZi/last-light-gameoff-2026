import { TILE } from './levels.js';

// Both the renderer and collision simulation use these edges, measured from
// the lift threshold towards the fire door. Forward travel decreases world Z.
const spawnRow = 142;
const exitRow = 3;
const centerX = 2.5 * TILE;
const width = 7.2;
const halfWidth = width / 2;
const startZ = (spawnRow + .5) * TILE;
const endZ = (exitRow + .5) * TILE;
const fullWidth = { left: -halfWidth, right: halfWidth };
const hurdle = (at, height = .47) => ({ kind: 'hurdle', at, length: .39, ...fullWidth, height });
const gap = (at, length = 1.85) => ({ kind: 'gap', at, length, ...fullWidth, height: 0 });
const bridge = (at, phase, length) => ({ kind: 'bridge', at, length, ...fullWidth, height: 0, phase });
const rack = (at, opening, openingWidth = 2.45, length = 1.7) => ({
  kind: 'rack', at, length, opening, height: 2.05,
  left: opening === 'left' ? openingWidth - halfWidth : -halfWidth,
  right: opening === 'right' ? halfWidth - openingWidth : halfWidth
});

export function rackLane(part) {
  return centerX + (part.opening === 'left' ? (part.left - halfWidth) / 2 : (part.right + halfWidth) / 2);
}

export const BACKROOMS_TRACK = Object.freeze({
  centerX, width, startZ, endZ, length: startZ - endZ, speed: 7.7,
  obstacles: [
    // Intake. Introduce two consecutive jumps and then the first offset aisles.
    hurdle(13, .38), gap(22, 1.95), bridge(33, 'night', 6.4),
    rack(48, 'left', 2.65), rack(57.8, 'right', 2.55, 2.16),
    // Copy room. A low hurdle and the break beyond it lead into the next phase span.
    hurdle(69, .43), gap(77, 2.3), bridge(88, 'day', 5.5), rack(105, 'left'),
    gap(116, 2.2), hurdle(125, .49), bridge(137, 'night', 6.0),
    // Microfilm. Steer through opposite tracks before the double jump.
    rack(153, 'right', 2.35, 2.22), rack(164, 'left', 2.45),
    hurdle(176, .40), gap(184, 2.45), bridge(196, 'day', 7.25),
    rack(210, 'right', 2.6), hurdle(222, .51), gap(230, 2.5), bridge(243, 'night', 6.5),
    // Dispatch. Cross the records aisles, jump twice and switch once more before the exit.
    rack(258, 'left', 2.35), rack(269, 'right', 2.45, 2.05), hurdle(279, .46), gap(287, 2.45),
    bridge(298, 'day', 7.5), rack(310, 'left', 2.5), hurdle(319, .42)
  ].map((part, index) => Object.freeze({ ...part, id: 'transfer-' + (index + 1) }))
});

const rows = Array.from({ length: spawnRow + 8 }, (_, row) => row === 0 || row === spawnRow + 7 ? '#####' : '#...#');
rows[spawnRow] = '#.S.#';
rows[exitRow] = '#.E.#';
rows[spawnRow + 4] = '#.J.#';

export const BACKROOMS_LEVEL = {
  id: 'backrooms', theme: 'office', title: 'THE TRANSFER FLOOR', zh: '后室 · 中转层',
  subtitle: 'B½ / OUTGOING FILES', subtitleZh: '地下夹层 / 待转交档案',
  objective: 'Keep moving to the fire door. Jump low barriers and gaps, steer around shelving, and switch for missing bridges.',
  objectiveZh: '沿走廊持续奔向防火门。跳过矮栏和断口，绕过高架，切换昼夜接通长桥。',
  rows, spawnYaw: 0
};

export const runDistance = z => startZ - z;

export function chaseFloor(distance, night) {
  for (const part of BACKROOMS_TRACK.obstacles) {
    if (distance < part.at) break;
    if (distance >= part.at + part.length) continue;
    return part.kind !== 'gap' && (part.kind !== 'bridge' || (part.phase === 'night') === night);
  }
  return true;
}

export function chaseBlocked(x, z, y, radius) {
  const localX = x - centerX;
  const travelled = runDistance(z);
  if (Math.abs(localX) + radius > halfWidth || travelled < -4) return true;
  // Outside the actual doorway the far wall stops the runner. At the central
  // threshold the hinged leaf starts opening one stride before contact.
  if (travelled >= BACKROOMS_TRACK.length && Math.abs(localX) + radius > .86) return true;
  return BACKROOMS_TRACK.obstacles.some(part =>
    part.height > y + .012 && travelled + radius > part.at && travelled - radius < part.at + part.length &&
    localX + radius > part.left && localX - radius < part.right);
}

export function nextChaseObstacle(distance) {
  return BACKROOMS_TRACK.obstacles.find(part => part.at + part.length + .28 > distance);
}

export function beginPursuit(sim) {
  const lead = 10.5;
  sim.chase = { started: false, elapsed: 0, distance: 0, danger: 0, headStart: lead };
  sim.ghosts = [{
    key: 'transfer-pursuer', index: 0, phase: 'both', active: true, alert: .9,
    x: centerX, z: startZ + lead, y: 0, home: sim.checkpoint
  }];
}

export function advancePursuit(sim, dt) {
  const run = sim.chase;
  run.distance = Math.max(0, runDistance(sim.z));
  if (!run.started && run.distance < .025) return;
  run.started = true;
  run.elapsed += dt;

  const ghost = sim.ghosts[0];
  // A clean runner can regain ground; the pursuer stays within earshot.
  const runSpeed = BACKROOMS_TRACK.speed;
  const speed = Math.min(runSpeed + .61, runSpeed - .48 + Math.max(0, ghost.z - sim.z - 7.1) * .35);
  ghost.z = Math.max(sim.z + .13, ghost.z - speed * dt);
  const lead = ghost.z - sim.z;
  const ghostDistance = runDistance(ghost.z);
  const ahead = BACKROOMS_TRACK.obstacles.find(part => ghostDistance < part.at + part.length + 1.4);

  // When viewed over the shoulder it takes the shelving opening and vaults gaps.
  let targetX = sim.x;
  ghost.y = 0;
  if (ahead?.kind === 'rack' && ghostDistance > ahead.at - 9 && lead >= 1.2) {
    targetX = rackLane(ahead);
  } else if (ahead?.kind === 'gap' || ahead?.kind === 'hurdle') {
    const arc = (ghostDistance - ahead.at + 1.1) / (ahead.length + 2.4);
    if (arc > 0 && arc < 1) ghost.y = Math.sin(Math.PI * arc) * .86;
  }
  ghost.x += (targetX - ghost.x) * Math.min(1, dt * (lead < 1.2 ? 6 : 2.5));
  run.headStart = lead;
  run.danger = Math.max(0, Math.min(1, (12 - lead) / 11));
  sim.tension = .55 + .45 * run.danger;
  if (Math.hypot(lead, ghost.x - sim.x) <= .68) sim.startDeath('ghost', ghost);
}
