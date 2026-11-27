import { phaseActive } from './phase.js';
import { difficultyRules } from './player-settings.js';

const chargeSpeed = 216;
const floorOffset = 33;
const lookRange = 123;
const cryRange = 175;

export const MOURNING_CAPTURE = Object.freeze({
  close: .23,
  recoil: .72,
  impact: .99,
  blackout: 1.07,
  duration: 1.32,
  revival: .86
});

export function clearOfficeGaze() {
  return { amount: 0, looking: false, charging: false, eyesDown: false, ghostId: null };
}

function crossesBlock(x, y, dx, dy, block) {
  let near = 0, far = 1;
  for (const [origin, delta, min, max] of [
    [x, dx, block.x, block.x + block.w],
    [y, dy, block.y, block.y + (block.h || 18)]
  ]) {
    if (Math.abs(delta) < .0001) {
      if (origin < min || origin > max) return false;
    } else {
      const a = (min - origin) / delta, b = (max - origin) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return false;
    }
  }
  return true;
}

export function resetMourningGaze(ghost) {
  Object.assign(ghost, { gaze: 0, looking: false, charging: false, recoil: 0, lockTime: 0, gazeWarned: false });
}

function charge(ghost, world, dt, speed, solids) {
  const target = world.player.x + 7;
  const delta = target - ghost.xNow;
  const x = ghost.xNow + Math.sign(delta) * Math.min(Math.abs(delta), speed * dt);
  const y = ghost.yNow;
  const floorY = y + floorOffset;
  const platforms = world.collisionIndex?.query(x - 8, floorY - 3, x + 8, floorY + 3) ?? world.platforms ?? [];
  const planted = [x - 3, x + 3].every(foot => platforms.some(platform =>
    phaseActive(platform, world.night) && Math.abs(platform.y - floorY) < 2 &&
    foot >= platform.x && foot <= platform.x + platform.w));
  const blocked = solids.some(block => phaseActive(block, world.night) &&
    x + 8 > block.x && x - 8 < block.x + block.w &&
    y + 22 > block.y && y - 17 < block.y + (block.h || 18));
  if (!planted || blocked || x === ghost.xNow) return;
  ghost.facing = Math.sign(delta);
  ghost.xNow = x;
}

export function updateMourningGaze(ghost, world, dt, atLamp) {
  const player = world.player;
  const rules = difficultyRules(world.difficulty);
  const solids = world.gazeBlockers || world.walls || [];
  const eyeX = player.x + 7 + player.dir * 3, eyeY = player.y + 8;
  // The larger Clerk sprite and Eli share a corridor sight line when standing
  // on the same support. Upper walkways and jumps take Eli out of that lane.
  const dx = ghost.xNow - eyeX, dy = ghost.yNow + 13 - eyeY;
  const alive = player.lifeState === 'alive' || player.lifeState === 'hurt';
  const near = alive && Math.hypot(dx, dy) < cryRange;

  const wasCharging = ghost.charging;
  ghost.cryCooldown = Math.max(0, (ghost.cryCooldown || 0) - dt);
  const inFront = dx * player.dir >= 0;
  const atEyeLevel = Math.abs(dy) <= Math.min(32, 17 + Math.abs(dx) * .14);
  const looking = alive && !atLamp && !player.eyesDown && inFront && atEyeLevel &&
    Math.hypot(dx, dy) < lookRange * rules.gazeRange &&
    !solids.some(block => phaseActive(block, world.night) && crossesBlock(eyeX, eyeY, dx, dy, block));
  ghost.lockTime = looking ? (ghost.lockTime || 0) + dt : 0;
  ghost.gaze = atLamp ? 0 : Math.max(0, Math.min(1, (ghost.gaze || 0) + dt * (looking ? 2 : -4)));
  ghost.looking = looking;
  ghost.charging = looking && ghost.lockTime >= rules.gazeDelay;
  ghost.recoil = ghost.charging ? 0 : wasCharging ? .25 : Math.max(0,(ghost.recoil || 0)-dt);
  if (ghost.charging && !wasCharging) {
    world.emit?.('sound', { name: 'mourning-rush', position: ghost.xNow });
    ghost.cryCooldown = Math.max(ghost.cryCooldown,.9);
  } else if (near && wasCharging && !ghost.charging) {
    world.emit?.('sound', { name: 'mourning-break', position: ghost.xNow });
    ghost.cryCooldown = Math.max(ghost.cryCooldown,.55);
  }
  if (near && !looking && ghost.cryCooldown === 0) {
    world.emit?.('sound', { name: 'mourning-cry', position: ghost.xNow });
    ghost.cryCooldown = 4.7 + (ghost.seed || 0) * .2;
  }

  if (ghost.gaze === 0) ghost.gazeWarned = false;
  if (ghost.lockTime >= .075 && !ghost.gazeWarned) {
    ghost.gazeWarned = true;
    world.emit?.('sound', { name: 'mourning-lock', position: ghost.xNow });
    const voice = world.time >= (world.mourningVoiceAfter || 0);
    if (voice) {
      world.mourningVoiceAfter = world.time + 4;
    }
    world.emit?.('mourning-glance', { voice });
  }
  ghost.state = looking ? 'alert' : 'patrol';
  if (ghost.charging) charge(ghost, world, dt, chargeSpeed * rules.gazeSpeed, solids);

  // A short collider overlap across a thin partition is still blocked by cover.
  const fromX = player.x + 7, fromY = player.y + 14;
  return !atLamp && alive && !solids.some(block => phaseActive(block, world.night) &&
    crossesBlock(fromX, fromY, ghost.xNow - fromX, ghost.yNow - fromY, block));
}
