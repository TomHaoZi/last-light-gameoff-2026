// These values track the first-person eye and the authored model's face.
export const EYE_HEIGHT = 1.66;
const FACE_HEIGHT = 1.65;
const REACH = 10.4;
const LOCK_TIME = .78;
const FACE_CONE = Math.cos(Math.PI * 9 / 180);

function wallInSight(map, ax, az, bx, bz, tileSize) {
  const dx = bx - ax;
  const dz = bz - az;
  const stepX = Math.sign(dx);
  const stepZ = Math.sign(dz);
  let col = Math.floor(ax / tileSize);
  let row = Math.floor(az / tileSize);
  let nextX = dx ? ((col + Number(dx > 0)) * tileSize - ax) / dx : Infinity;
  let nextZ = dz ? ((row + Number(dz > 0)) * tileSize - az) / dz : Infinity;
  const spanX = dx ? tileSize / Math.abs(dx) : Infinity;
  const spanZ = dz ? tileSize / Math.abs(dz) : Infinity;
  // Trace tile boundaries instead of sampling at fixed intervals. A narrow
  // crossing of the corner of an office partition still blocks the stare.
  while (Math.min(nextX, nextZ) < 1) {
    if (Math.abs(nextX - nextZ) < 1e-8 &&
        (map.get(col + stepX, row)?.kind === '#' || map.get(col, row + stepZ)?.kind === '#')) return true;
    if (nextX <= nextZ) {
      col += stepX;
      nextX += spanX;
    } else {
      row += stepZ;
      nextZ += spanZ;
    }
    if (map.get(col, row)?.kind === '#') return true;
  }
  return false;
}

export function updateMourningClerks(state, dt, tileSize, sanctuary) {
  const cosPitch = Math.cos(state.pitch);
  const lookX = Math.sin(state.yaw) * cosPitch;
  const lookY = Math.sin(state.pitch);
  const lookZ = -Math.cos(state.yaw) * cosPitch;

  for (const ghost of state.ghosts) {
    ghost.watching = false;
    if (!ghost.active || sanctuary) {
      ghost.gaze = ghost.alert = 0;
      continue;
    }

    const dx = ghost.x - state.x;
    const dz = ghost.z - state.z;
    const dy = (ghost.y ?? 0) + FACE_HEIGHT - (state.y + EYE_HEIGHT);
    const range = Math.hypot(dx, dz);
    const faceRange = Math.hypot(range, dy);
    const centred = faceRange > .001 &&
      (dx * lookX + dy * lookY + dz * lookZ) > FACE_CONE * faceRange;
    ghost.watching = centred && faceRange <= REACH &&
      !wallInSight(state.map, state.x, state.z, ghost.x, ghost.z, tileSize);

    const previousGaze = ghost.gaze;
    ghost.gaze = Math.max(0, Math.min(1, ghost.gaze + dt * (ghost.watching ? 1 / LOCK_TIME : -4)));
    ghost.alert = ghost.gaze;
    state.gaze = Math.max(state.gaze, ghost.gaze);
    state.watching ||= ghost.watching;
    state.tension = Math.max(state.tension, ghost.gaze, Math.max(0, 1 - range / 11) * .22);

    if (previousGaze < .18 && ghost.gaze >= .18) {
      state.emit('sound', { name: 'mourning-lock', position: ghost });
      state.emit('mourning-glance');
    }
    if (ghost.gaze >= 1 || (range < .62 && state.y < .85)) {
      state.emit('sound', { name: 'mourning-strike', position: ghost });
      state.startDeath(ghost.gaze >= 1 ? 'gaze' : 'ghost', ghost);
      return;
    }
    if (range < 12 && state.time >= ghost.nextCry) {
      state.emit('sound', { name: 'mourning-cry', position: ghost });
      ghost.nextCry = state.time + 5.4 + ghost.index * .89;
    }
  }
}
