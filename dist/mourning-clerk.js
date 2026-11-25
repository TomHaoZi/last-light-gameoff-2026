import { phaseActive } from './phase.js';

const lookTime = .85;
const lookRange = 123;
const cryRange = 175;

export function clearOfficeGaze() {
  return { amount: 0, looking: false, eyesDown: false, ghostId: null };
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

export function updateMourningGaze(ghost, world, dt, atLamp) {
  const player = world.player;
  const eyeX = player.x + 7 + player.dir * 3, eyeY = player.y + 8;
  // The larger Clerk sprite and Eli share a corridor sight line when standing
  // on the same support. Upper walkways and jumps take Eli out of that lane.
  const dx = ghost.xNow - eyeX, dy = ghost.yNow + 13 - eyeY;
  const alive = player.lifeState === 'alive' || player.lifeState === 'hurt';
  const near = alive && Math.hypot(dx, dy) < cryRange;

  ghost.cryCooldown = Math.max(0, (ghost.cryCooldown || 0) - dt);
  if (near && ghost.cryCooldown === 0) {
    world.emit?.('sound', { name: 'mourning-cry', position: ghost.xNow });
    ghost.cryCooldown = 4.7 + (ghost.seed || 0) * .2;
  }
  const inFront = dx * player.dir >= 0;
  const atEyeLevel = Math.abs(dy) <= Math.min(32, 17 + Math.abs(dx) * .14);
  const looking = alive && !atLamp && !player.eyesDown && inFront && atEyeLevel &&
    Math.hypot(dx, dy) < lookRange && !(world.gazeBlockers || world.walls || [])
      .some(block => phaseActive(block, world.night) && crossesBlock(eyeX, eyeY, dx, dy, block));
  const amount = ghost.gaze || 0;
  ghost.gaze = looking ? Math.min(1, amount + dt / lookTime) : Math.max(0, amount - dt * 2.8);
  ghost.looking = looking;

  if (ghost.gaze === 0) ghost.gazeWarned = false;
  if (ghost.gaze >= .17 && !ghost.gazeWarned) {
    ghost.gazeWarned = true;
    world.emit?.('sound', { name: 'mourning-lock', position: ghost.xNow });
    const voice = world.time >= (world.mourningVoiceAfter || 0);
    if (voice) {
      world.mourningVoiceAfter = world.time + 4;
    }
    world.emit?.('mourning-glance', { voice });
  }
  if (looking) ghost.state = 'alert';
  else if (ghost.state === 'alert') ghost.state = 'patrol';
  return looking && ghost.gaze >= 1;
}
