// These values track the first-person eye and the authored model's face.
export const EYE_HEIGHT = 1.66;
const FACE_HEIGHT = 1.65;
const REACH = 10.4;
const CHARGE_SPEED = 8.8;
const CONTACT_RADIUS = .62;
const FACE_CONE = Math.cos(Math.PI * 9 / 180);
const MODEL_FOOTPRINT = 1.55;

export function firstSightWall(map, ax, az, bx, bz, tileSize) {
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
    if (Math.abs(nextX - nextZ) < 1e-8) {
      const side = map.get(col + stepX, row);
      const forward = map.get(col, row + stepZ);
      if (side?.kind === '#') return side;
      if (forward?.kind === '#') return forward;
    }
    if (nextX <= nextZ) {
      col += stepX;
      nextX += spanX;
    } else {
      row += stepZ;
      nextZ += spanZ;
    }
    const tile = map.get(col, row);
    if (tile?.kind === '#') return tile;
  }
  return null;
}

export function mourningHiddenByPartition(map, player, ghost, tileSize) {
  // Check the complete silhouette including the wings. Four corner rays
  // must all enter the same uninterrupted, full-height strip of wall.
  if (player.y > .92 || (ghost.y ?? 0) > .35 ||
      Math.hypot(player.x - ghost.x, player.z - ghost.z) < 12) return false;
  const hits = [];
  for (const dx of [-MODEL_FOOTPRINT, MODEL_FOOTPRINT]) {
    for (const dz of [-MODEL_FOOTPRINT, MODEL_FOOTPRINT]) {
      const wall = firstSightWall(map, player.x, player.z, ghost.x + dx, ghost.z + dz, tileSize);
      if (!wall) return false;
      hits.push(wall);
    }
  }
  const { col, row } = hits[0];
  if (hits.every(wall => wall.col === col)) {
    const rows = hits.map(wall => wall.row);
    for (let y = Math.min(...rows); y <= Math.max(...rows); y++) {
      if (map.get(col, y)?.kind !== '#') return false;
    }
    return true;
  }
  if (hits.every(wall => wall.row === row)) {
    const cols = hits.map(wall => wall.col);
    for (let x = Math.min(...cols); x <= Math.max(...cols); x++) {
      if (map.get(x, row)?.kind !== '#') return false;
    }
    return true;
  }
  return false;
}

export function updateMourningClerks(state, dt, tileSize, sanctuary, rules, supported) {
  const cosPitch = Math.cos(state.pitch);
  const lookX = Math.sin(state.yaw) * cosPitch;
  const lookY = Math.sin(state.pitch);
  const lookZ = -Math.cos(state.yaw) * cosPitch;

  for (const ghost of state.ghosts) {
    ghost.watching = ghost.charging = false;
    if (!ghost.active || sanctuary) {
      ghost.gaze = ghost.alert = ghost.lockTime = 0;
      ghost.gazeWarned = false;
      continue;
    }

    if (!supported(ghost.x, ghost.z)) {
      ghost.x = ghost.home.x;
      ghost.z = ghost.home.z;
    }
    const dx = ghost.x - state.x;
    const dz = ghost.z - state.z;
    const dy = (ghost.y ?? 0) + FACE_HEIGHT - (state.y + EYE_HEIGHT);
    const range = Math.hypot(dx, dz);
    const faceRange = Math.hypot(range, dy);
    const centred = faceRange > .001 &&
      (dx * lookX + dy * lookY + dz * lookZ) > FACE_CONE * faceRange;
    const lineClear = (centred || range < CONTACT_RADIUS) &&
      !firstSightWall(state.map, state.x, state.z, ghost.x, ghost.z, tileSize);
    ghost.watching = centred && faceRange <= REACH * rules.gazeRange && lineClear;
    ghost.lockTime = ghost.watching ? ghost.lockTime + dt : 0;
    ghost.gaze = Math.max(0, Math.min(1, ghost.gaze + dt * (ghost.watching ? 2 : -4)));
    ghost.alert = ghost.gaze;
    ghost.charging = ghost.watching && ghost.lockTime >= rules.gazeDelay;
    state.gaze = Math.max(state.gaze, ghost.gaze);
    state.watching ||= ghost.watching;
    state.tension = Math.max(state.tension, ghost.gaze, Math.max(0, 1 - range / 11) * .22);

    if (!ghost.gaze) ghost.gazeWarned = false;
    if (ghost.lockTime >= .075 && !ghost.gazeWarned) {
      ghost.gazeWarned = true;
      state.emit('sound', { name: 'mourning-lock', position: ghost });
      state.emit('mourning-glance');
    }
    if (ghost.charging && range > .001) {
      const move = Math.min(range, CHARGE_SPEED * rules.gazeSpeed * dt);
      const x = ghost.x - dx / range * move;
      const z = ghost.z - dz / range * move;
      if (supported(x, z) && !state.blocks(x, z, .24) && !state.ghostSanctuary(x, z)) {
        ghost.x = x;
        ghost.z = z;
      }
    }
    if (lineClear && Math.hypot(ghost.x - state.x, ghost.z - state.z) < CONTACT_RADIUS &&
        (state.y - (ghost.y ?? 0)) >= -.22 && (state.y - (ghost.y ?? 0)) < .85) {
      state.emit('sound', { name: 'mourning-strike', position: ghost });
      state.startDeath(ghost.charging ? 'gaze' : 'ghost', ghost);
      return;
    }
    if (range < 12 && state.time >= ghost.nextCry) {
      state.emit('sound', { name: 'mourning-cry', position: ghost });
      ghost.nextCry = state.time + 5.4 + ghost.index * .89;
    }
  }
}
