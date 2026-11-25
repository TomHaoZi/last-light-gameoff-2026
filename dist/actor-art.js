const COAT = ['#a3bfad', '#6e9b9a', '#456875', '#273e4c'];
const CAP = ['#e0d59d', '#a8ad7a', '#747c58', '#475644'];
const BOOTS = ['#c19462', '#865d47', '#5b4438', '#3d3632'];
const FACE = ['#f4d5a3', '#d7a779', '#aa7859', '#6e4b43'];
const GHOST = ['#a6beb5', '#7397a0', '#4a6d82', '#2a4258'];

export function drawJanitor(a, frame, legs, arm, squash, grounded, running, dir, eyesDown = false) {
  const lag = a.capLag || 0;
  a.capLag = running ? Math.sin(a.t * 11) : 0;
  a.rect(0, 27, 15, 1, '#294342');
  for (let i = 0; i < 2; i++) {
    const x = i * 6 + 2 + legs[i], h = 6 - squash, lit = i === (dir === 1 ? 0 : 1);
    a.rect(x, 20, 5, h, COAT[3]);
    a.rect(x + 1, 20, 3, h - 1, COAT[lit ? 1 : 2]);
    a.rect(x - 1, 25 - squash, 7, 3, BOOTS[3]);
    a.rect(x - 1, 25 - squash, 6, 2, BOOTS[1]);
    a.line(x + 1, 25 - squash, 3, BOOTS[lit ? 0 : 2]);
    a.line(x, 27 - squash, 5, BOOTS[2]);
  }

  // Limbs are partially occluded by a single irregular silhouette.
  const farArm = Math.round(arm * .5), nearArm = Math.round(-arm * .5);
  a.rect(0, 15 + farArm, 4, 7, COAT[3]);
  a.rect(0, 14 + farArm, 4, 5, COAT[2]);
  a.rect(1, 20 + farArm, 2, 3, FACE[2]);
  a.rect(2, 13, 11, 8 - squash, COAT[3]);
  a.rect(3, 12, 8, 4, COAT[1]);
  a.rect(3, 15, 9, 5 - squash, COAT[1]);
  a.rect(dir === 1 ? 9 : 3, 15, 2, 5 - squash, COAT[2]);
  a.line(4, 12, 6, COAT[0]);
  a.line(4, 16, 3, COAT[0]);
  if (squash < 2) a.line(5, 18, 3, COAT[2]);
  a.rect(6, 13, 1, 7 - squash, CAP[2]);
  a.rect(8, 14, 2, 2, CAP[0]);
  a.rect(11, 14 + nearArm, 4, 7, COAT[3]);
  a.rect(11, 13 + nearArm, 3, 6, COAT[dir === 1 ? 1 : 0]);
  a.line(11, 13 + nearArm, 3, COAT[0]);
  a.line(12, 18 + nearArm, 2, CAP[2]);
  a.rect(12, 20 + nearArm, 3, 3, FACE[2]);
  a.line(12, 20 + nearArm, 2, FACE[1]);

  if (eyesDown) {
    a.c.save();
    a.c.translate(1, 2);
  }
  a.rect(3, 5, 9, 6, FACE[3]);
  a.rect(5, 4, 7, 7, FACE[1]);
  a.rect(8, 6, 5, 5, FACE[1]);
  a.rect(11, 8, 3, 2, FACE[1]);
  a.rect(4, 7, 2, 3, FACE[2]);
  a.rect(7, 11, 6, 2, FACE[2]);
  a.line(8, 10, 5, FACE[0]);
  a.line(dir === 1 ? 6 : 9, 6, 3, FACE[0]);
  if (eyesDown) a.line(10, 9, 2, FACE[3]);
  else if (!(frame === 3 && grounded && !running)) a.rect(10, 7, 2, 2, COAT[3]);
  else a.line(10, 8, 2, FACE[3]);
  a.line(10, 11, 2, FACE[3]);

  a.rect(3, 1, 8, 4, CAP[3]);
  a.rect(2, 2, 11, 3, CAP[1]);
  a.line(dir === 1 ? 3 : 6, 1, 6, CAP[0]);
  a.rect(3, 4, 9, 1, CAP[2]);
  a.rect(8 + lag, 5, 7, 2, CAP[3]);
  a.line(10 + lag, 5, 5, CAP[0]);
  a.rect(12 + lag, 3, 3, 3, BOOTS[2]);
  a.line(13 + lag, 3, 2, '#ecd597');

  if (eyesDown) a.c.restore();
  const chain = Math.round(Math.sin(a.t * (running ? 11 : 4)));
  a.rect(4, 21 - squash, 1, 3, '#a49062');
  a.rect(4 + chain, 23 - squash, 2, 3, '#dac589');
  a.line(4 + chain, 25 - squash, 3, '#a49062');
  a.rect(-1, 16 + lag, 2, 7, BOOTS[2]);
  a.rect(-3, 21 + lag, 4, 4, CAP[2]);
  a.line(-3, 21 + lag, 3, CAP[0]);
}

const LIMESTONE = ['#e8e1bf', '#c7c9ad', '#899c8f', '#34474a'];
const SERGE = ['#929e92', '#718880', '#495d5e', '#2e4145'];
const SLATE = ['#a8aca0', '#788486', '#515f66', '#36454d'];

export function drawMourningClerk(a, ghost, x, y) {
  const danger = ghost.gaze || 0;
  const rise = Math.round(danger * 7);
  const spread = Math.round(danger * 3);
  const agitated = danger > .53;
  const tremble = danger > .18 ? Math.round(Math.sin(a.t * 17) * danger) : 0;
  const braidSwing = Math.round(Math.sin(a.t * 2.8 + (ghost.seed || 0)));
  const faceX = x + tremble;
  const faceY = y - 13 - rise;
  a.glow(x, y - 6, 33, 32, agitated ? '#dba17b' : '#a7bab3', .085 + danger * .13);
  a.c.save();

  // The relief was once an arch of feathers. The right tip broke off.
  a.rect(x - 19 - spread, y - 22 - spread, 5 + spread, 12 + spread, LIMESTONE[3]);
  a.rect(x - 18 - spread, y - 21 - spread, 2, 11, LIMESTONE[1]);
  a.line(x - 18 - spread, y - 21 - spread, 3, LIMESTONE[0]);
  a.rect(x - 16 - spread, y - 17 - spread, 6 + spread, 17 + spread, LIMESTONE[2]);
  a.rect(x - 16 - spread, y - 14 - spread, 2, 10 + spread, LIMESTONE[1]);
  a.rect(x - 13 - spread, y - 12 - spread, 2, 14 + spread, LIMESTONE[2]);
  a.rect(x - 15, y - 10, 9, 26, LIMESTONE[3]);
  a.rect(x - 14, y - 9, 4, 18, LIMESTONE[2]);
  a.rect(x - 14, y - 8, 1, 11, LIMESTONE[1]);
  a.rect(x - 11, y - 4, 1, 8, LIMESTONE[3]);
  a.rect(x - 13, y + 5, 4, 8, LIMESTONE[2]);
  a.line(x - 16, y - 10, 3, LIMESTONE[0]);
  a.rect(x - 11, y + 8, 2, 8, LIMESTONE[1]);
  a.rect(x - 8, y + 6, 2, 7, LIMESTONE[2]);
  a.rect(x + 6, y - 9 - spread, 8 + spread, 20 + spread, LIMESTONE[3]);
  a.rect(x + 10, y - 13 - spread, 5, 8, LIMESTONE[3]);
  a.rect(x + 11, y - 12 - spread, 3, 7, LIMESTONE[1]);
  a.line(x + 12, y - 12 - spread, 2, LIMESTONE[0]);
  a.rect(x + 8, y - 7, 5, 12, LIMESTONE[2]);
  a.rect(x + 13, y - 4, 4 + spread, 9, LIMESTONE[2]);
  a.rect(x + 14, y - 2, 1, 6, LIMESTONE[3]);
  a.line(x + 12, y - 5, 3, LIMESTONE[0]);
  a.rect(x + 15, y, 2 + spread, 5, LIMESTONE[3]);
  a.rect(x + 9, y + 5, 3, 8, LIMESTONE[3]);
  a.rect(x + 12, y + 5, 2, 4, LIMESTONE[1]);

  // High collar, pinned archive badge and a single sculpted skirt.
  a.rect(x - 9, y - 6 - rise / 2, 18, 14 + rise / 2, SERGE[3]);
  a.rect(x - 7, y - 5 - rise / 2, 14, 11 + rise / 2, SERGE[2]);
  a.rect(x - 6, y - 5, 4, 11, SERGE[1]);
  a.line(x - 7, y - 6, 7, SERGE[0]);
  a.rect(x - 6, y + 4, 12, 7, SERGE[3]);
  a.rect(x - 7, y + 8, 14, 7, SERGE[2]);
  a.rect(x - 9, y + 13, 18, 11, SERGE[3]);
  a.rect(x - 8, y + 13, 7, 9, SERGE[2]);
  a.rect(x - 5, y + 11, 3, 10, SERGE[1]);
  a.rect(x + 2, y + 11, 4, 11, SERGE[2]);
  a.line(x - 5, y + 7, 10, '#777463');
  a.rect(x - 5, y + 23, 3, 2, SERGE[3]);
  a.rect(x + 4, y + 23, 3, 2, SERGE[3]);
  for (let i = 0; i < 4; i++) {
    a.rect(x - 4 + i * 2, y - 5 - rise / 2, 1, 2, LIMESTONE[i > 1 ? 2 : 1]);
  }
  a.rect(x + 3, y + 1, 5, 3, '#97875c');
  a.line(x + 3, y + 1, 4, '#c1ab75');

  // Carved braid, bent chin and weathered tears track the raising head.
  a.rect(faceX - 6, faceY - 8, 11, 13, SLATE[3]);
  a.line(faceX - 4, faceY - 8, 6, SLATE[1]);
  a.rect(faceX - 7, faceY - 5, 4, 12, SLATE[2]);
  for (let lock = 0; lock < 4; lock++) {
    const bx = faceX - 6 - lock % 2 + braidSwing * Number(lock > 1);
    const by = faceY + 3 + lock * 3;
    a.rect(bx, by, 4, 4, SLATE[3]);
    a.rect(bx, by, 2, 3, SLATE[1 + lock % 2]);
  }
  a.rect(faceX - 3, faceY - 5, 8, 10, LIMESTONE[2]);
  a.rect(faceX - 3, faceY - 4, 7, 7, LIMESTONE[1]);
  a.line(faceX - 2, faceY - 4, 3, LIMESTONE[0]);
  a.rect(faceX - 2, faceY - 1, 2, 1, LIMESTONE[3]);
  a.rect(faceX + 2, faceY - 1, 2, 1, LIMESTONE[3]);
  a.rect(faceX - 2, faceY, 1, 3, '#596c66');
  a.rect(faceX + 2, faceY, 1, 3, '#596c66');
  a.rect(faceX + 4, faceY - 3, 1, 4, LIMESTONE[3]);
  a.line(faceX + 2, faceY - 2, 2, LIMESTONE[2]);
  a.rect(faceX, faceY + 1, 1, 1, LIMESTONE[0]);

  if (agitated) {
    a.rect(faceX - 1, faceY + 3, 4, 2, LIMESTONE[3]);
    a.rect(faceX - 2, faceY - 1, 2, 1, '#f1c3a0');
    a.rect(faceX + 2, faceY - 1, 2, 1, '#ce8b70');
    a.rect(x - 13, y - 3 - rise, 5, 15, SERGE[2]);
    a.rect(x + 8, y - 2 - rise, 5, 14, SERGE[2]);
    a.rect(x - 14, y - 6 - rise, 4, 7, LIMESTONE[2]);
    a.rect(x + 11, y - 5 - rise, 4, 7, LIMESTONE[2]);
    a.line(x - 14, y - 7 - rise, 4, LIMESTONE[0]);
    a.line(x + 11, y - 6 - rise, 4, LIMESTONE[1]);
  } else {
    a.rect(x - 8, y - 3, 5, 9, SERGE[2]);
    a.rect(x + 5, y - 4, 4, 9, SERGE[2]);
    a.rect(faceX - 4, faceY + 3, 5, 4, LIMESTONE[3]);
    a.rect(faceX - 4, faceY + 3, 4, 2, LIMESTONE[1]);
    a.rect(faceX + 1, faceY + 4, 5, 3, LIMESTONE[2]);
    a.line(faceX + 2, faceY + 4, 3, LIMESTONE[1]);
  }

  a.c.restore();
}

export function drawApparition(a, ghost, x, y) {
  if (ghost.kind === 'mourner') {
    drawMourningClerk(a, ghost, x, y);
    return;
  }
  const pulse = .73 + Math.sin(a.t * 4 + (ghost.seed || 0)) * .14;
  const chase = ghost.state === 'chase';
  const face = chase ? '#e8a286' : '#c5c5a3';
  const sway = Math.round(Math.sin(a.t * 4 + (ghost.seed || 0)) * 2);
  const c = a.c;
  a.glow(x, y - 6, 26, 36, '#8bb0bc', .11 + pulse * .045);
  c.save();
  c.globalAlpha = pulse;

  a.rect(x - 7, y - 15, 14, 27, GHOST[3]);
  a.rect(x - 5, y - 19, 11, 14, GHOST[2]);
  a.rect(x - 3, y - 20, 7, 5, GHOST[1]);
  a.rect(x - 9, y - 8, 18, 21, GHOST[2]);
  a.rect(x - 6, y - 10, 11, 24, GHOST[2]);
  a.rect(x - 9, y - 6, 5, 15, GHOST[1]);
  a.rect(x + 4, y - 3, 5, 18, GHOST[3]);
  a.rect(x - 6, y + 6, 4, 9, GHOST[1]);
  a.rect(x - 2, y + 6, 5, 10, GHOST[3]);
  a.rect(x - 10 + sway, y + 11, 16, 7, GHOST[2]);
  a.rect(x - 11 + sway, y + 16, 6, 7, GHOST[3]);
  a.rect(x - 2 + sway, y + 16, 6, 9, GHOST[3]);
  a.rect(x + 5 + sway, y + 17, 4, 5, GHOST[2]);
  a.rect(x - 12 + sway, y + 21, 3, 3, GHOST[2]);

  a.rect(x - 10, y - 5, 4, 12, GHOST[2]);
  a.rect(x - 12, y + 6, 5, 3, GHOST[1]);
  a.rect(x - 13, y + 8, 3, 2, GHOST[2]);
  a.rect(x + 8, y - 3 + sway, 4, 10, GHOST[2]);
  a.rect(x + 10, y + 5 + sway, 4, 2, GHOST[1]);
  a.rect(x + 13, y + 4 + sway, 2, 2, GHOST[2]);

  a.rect(x - 5, y - 15, 10, 7, GHOST[1]);
  a.line(x - 4, y - 16, 5, GHOST[0]);
  a.rect(x - 4, y - 13, 3, 3, GHOST[3]);
  a.rect(x + 2, y - 13, 3, 3, GHOST[3]);
  a.line(x - 4, y - 13, 2, face);
  a.line(x + 2, y - 13, 2, face);
  a.rect(x - 1, y - 9, 3, 2, GHOST[3]);
  a.rect(x - 3, y - 7, 3, 9, GHOST[1]);
  a.rect(x - 2, y - 2, 1, 7, GHOST[0]);

  // Two- and three-pixel clusters keep the damaged side readable at 1×.
  const clot = '#633d42', dried = '#81534c', slough = '#9e9d80';
  if (ghost.kind === 'listener') {
    a.rect(x + 3, y - 10, 3, 3, dried);
    a.rect(x + 4, y - 8, 2, 4, clot);
    a.line(x + 3, y - 10, 2, slough);
    a.rect(x + 3, y - 4, 4, 2, dried);
  } else if (ghost.kind === 'watcher') {
    a.rect(x - 3, y - 9, 4, 2, clot);
    a.rect(x - 2, y - 7, 2, 4, dried);
    a.rect(x - 3, y - 4, 4, 2, clot);
    a.line(x - 5, y - 11, 2, slough);
  } else {
    a.rect(x - 5, y - 12, 2, 4, dried);
    a.line(x - 5, y - 11, 2, slough);
    a.rect(x - 4, y - 9, 2, 3, clot);
    a.rect(x - 7, y - 5, 3, 3, dried);
  }
  if (ghost.kind === 'listener') {
    a.rect(x - 9, y - 16, 4, 7, GHOST[2]);
    a.rect(x + 5, y - 17, 4, 7, GHOST[2]);
    a.line(x - 9, y - 16, 3, GHOST[0]);
    a.line(x + 5, y - 17, 3, GHOST[1]);
  } else if (ghost.kind === 'watcher') {
    a.rect(x - 6, y - 20, 13, 3, GHOST[1]);
    a.line(x - 7, y - 18, 15, GHOST[0]);
    a.rect(x + (ghost.facing === 1 ? 4 : -7), y - 18, 3, 2, face);
  }
  c.restore();
}

export function drawPhaseRipple(a, s) {
  const t = 1 - s.shiftFx / .22;
  const x = s.player.x - a.cam + 7, y = s.player.y - (s.cameraY || 0) + 14;
  const r = 10 + t * 62;
  const c = a.c;
  const palette = s.night ? ['#9cc7d6', '#638ca4'] : ['#ead099', '#b1825f'];
  c.save();
  c.globalAlpha = Math.max(0, 1 - t) * .55;
  for (let arc = 0; arc < 4; arc++) {
    const turn = arc * Math.PI * .5 + t * .21;
    for (let i = 0; i < 8; i++) {
      const theta = turn + i * .083;
      a.rect(x + Math.cos(theta) * r, y + Math.sin(theta) * r * .68, 3, 2, palette[i < 4 ? 0 : 1]);
    }
  }
  if (t < .6) {
    c.globalAlpha = (.6 - t) * .3;
    for (let i = 0; i < 4; i++) a.line(x - r * .9 + i * 6, y - 15 + i * 9, r * (1.3 - (i % 2) * .4), palette[1]);
  }
  c.restore();
}
