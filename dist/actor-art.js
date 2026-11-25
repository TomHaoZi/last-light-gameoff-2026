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

const CLERK_HAIR = ['#8c9390', '#626e70', '#46575c', '#273a40'];
const CLERK_SKIN = ['#f3e6cc', '#c9c8af', '#899c95', '#45595a'];
const CLERK_COAT = ['#a4acaf', '#788893', '#52626f', '#303f4b'];
const CLERK_BLOUSE = ['#e5d8b6', '#b4b8ab', '#899b96', '#45585b'];
const CLERK_LEATHER = ['#ad9a84', '#877b73', '#66595b', '#423b48'];
const CLERK_STAIN = ['#b48c83', '#946360', '#704850', '#523a46'];

export function drawMourningClerk(a, ghost, x, y) {
  const {gaze = 0, looking, charging} = ghost;
  const direction = ghost.facing === -1 ? -1 : 1;
  const lean = charging ? direction * 4 : 0;
  const stride = charging ? Math.round(Math.sin(a.t * 26) * 2) : 0;
  const hairLag = charging ? -direction * 3 : Math.round(Math.sin(a.t * 2.4 + (ghost.seed || 0)));
  const faceY = looking ? -25 : -22;
  const rect = (dx, dy, w, h, color) => a.rect(x + dx, y + dy, w, h, color);
  const face = (dx, dy, w, h, color) => rect(lean + dx, faceY + dy, w, h, color);
  const forward = (dx, dy, w, h, color) => rect(direction === 1 ? dx : 1 - dx - w, dy, w, h, color);

  a.glow(x, y - 3, 30, 37, charging ? '#c58573' : '#a3bdb4', .07 + gaze * .1);
  // The hanging hair remains behind her shoulders. The ends lag the lunge.
  face(-9, 4, 18, 17, CLERK_HAIR[3]);
  face(-10, 8, 5, 15, CLERK_HAIR[2]);
  face(-9, 10, 2, 13, CLERK_HAIR[1]);
  face(7, 11, 3, 15, CLERK_HAIR[3]);
  face(-8 + hairLag, 20, 4, 8, CLERK_HAIR[2]);
  face(-8 + hairLag, 21, 1, 6, CLERK_HAIR[1]);
  face(6 + hairLag, 22, 3, 7, CLERK_HAIR[2]);

  // Tailored archive uniform, stocking seams, and practical shoes.
  rect(-5 - stride, 22, 4, 8, CLERK_SKIN[3]);
  rect(-5 - stride, 23, 2, 6, CLERK_SKIN[2]);
  rect(2 + stride, 22, 4, 8, CLERK_SKIN[3]);
  rect(3 + stride, 23, 2, 6, CLERK_SKIN[2]);
  rect(-7 - stride, 29, 7, 4, CLERK_LEATHER[3]);
  rect(-7 - stride, 29, 5, 2, CLERK_LEATHER[1]);
  rect(-7 - stride, 31, 2, 1, CLERK_LEATHER[0]);
  rect(2 + stride, 29, 6, 4, CLERK_LEATHER[3]);
  rect(3 + stride, 29, 4, 2, CLERK_LEATHER[2]);

  rect(-6, 8, 12, 16, CLERK_COAT[3]);
  rect(-8, 12, 16, 10, CLERK_COAT[3]);
  rect(-7, 11, 14, 10, CLERK_COAT[2]);
  rect(-6, 10, 7, 12, CLERK_COAT[1]);
  rect(-5, 11, 2, 10, CLERK_COAT[0]);
  rect(2, 12, 1, 10, CLERK_COAT[3]);
  rect(3, 13, 2, 8, CLERK_COAT[2]);
  rect(-7, 22, 6, 1, CLERK_COAT[1]);
  rect(1, 22, 3, 2, CLERK_COAT[2]);
  rect(-5, 18, 3, 3, CLERK_STAIN[1]);
  rect(-3, 18, 2, 4, CLERK_STAIN[2]);

  if (charging) {
    forward(4, -7, 8, 5, CLERK_COAT[3]);
    forward(8, -9, 9, 4, CLERK_COAT[2]);
    forward(12, -9, 4, 1, CLERK_COAT[1]);
    forward(15, -10, 4, 3, CLERK_SKIN[2]);
    forward(17, -10, 3, 1, CLERK_SKIN[1]);
  } else {
    rect(6, -7, 5, 17, CLERK_COAT[3]);
    rect(7, -6, 3, 11, CLERK_COAT[2]);
    rect(7, 8, 3, 6, CLERK_SKIN[3]);
    rect(7, 8, 2, 4, CLERK_SKIN[2]);
  }

  rect(-9 + lean, -10, 18, 12, CLERK_COAT[3]);
  rect(-7 + lean, -11, 13, 10, CLERK_COAT[1]);
  rect(-7 + lean, -11, 6, 1, CLERK_COAT[0]);
  rect(4 + lean, -9, 4, 10, CLERK_COAT[2]);
  rect(-6, 1, 12, 6, CLERK_COAT[3]);
  rect(-5, 1, 9, 5, CLERK_COAT[2]);
  rect(-4, 0, 4, 6, CLERK_COAT[1]);
  rect(-5, 6, 10, 2, CLERK_LEATHER[3]);
  rect(-5, 6, 6, 1, CLERK_LEATHER[1]);
  rect(-1, 6, 2, 2, CLERK_LEATHER[0]);
  rect(-2 + lean, -13, 5, 5, CLERK_SKIN[3]);
  rect(-2 + lean, -13, 4, 4, CLERK_SKIN[1]);
  rect(-3 + lean, -10, 7, 3, CLERK_BLOUSE[0]);
  rect(-2 + lean, -7, 6, 3, CLERK_BLOUSE[1]);
  rect(-1 + lean, -4, 4, 3, CLERK_BLOUSE[2]);
  rect(-4 + lean, -9, 2, 7, CLERK_COAT[2]);
  rect(4 + lean, -8, 1, 6, CLERK_COAT[3]);
  rect(-6 + lean, -4, 4, 3, CLERK_LEATHER[2]);
  rect(-6 + lean, -4, 3, 1, CLERK_LEATHER[0]);
  rect(-8 + lean, 0, 3, 3, CLERK_STAIN[1]);
  rect(-8 + lean, 1, 2, 3, CLERK_STAIN[2]);

  if (charging) {
    // The nearer arm extends from her shoulder, with a planted cuff and fingers.
    forward(6, -4, 8, 6, CLERK_COAT[3]);
    forward(7, -4, 6, 4, CLERK_COAT[1]);
    forward(11, -6, 6, 5, CLERK_COAT[3]);
    forward(11, -6, 5, 3, CLERK_COAT[2]);
    forward(12, -6, 4, 1, CLERK_COAT[0]);
    forward(15, -6, 2, 4, CLERK_BLOUSE[1]);
    forward(17, -7, 4, 4, CLERK_SKIN[2]);
    forward(17, -7, 5, 1, CLERK_SKIN[0]);
    forward(18, -5, 5, 1, CLERK_SKIN[1]);
    forward(18, -3, 3, 1, CLERK_SKIN[2]);
    forward(17, -4, 2, 3, CLERK_SKIN[1]);
  } else {
    rect(-10, -7, 4, 15, CLERK_COAT[3]);
    rect(-10, -7, 3, 12, CLERK_COAT[1]);
    rect(-10, -7, 1, 6, CLERK_COAT[0]);
    rect(-10, 5, 3, 2, CLERK_BLOUSE[1]);
    rect(-10, 7, 4, 6, CLERK_SKIN[3]);
    rect(-10, 7, 2, 5, CLERK_SKIN[1]);
    rect(-8, 9, 1, 3, CLERK_SKIN[2]);
  }

  // Asymmetrical part and stepped cheekbones keep the eyes legible at 480×270.
  face(-5, 0, 10, 2, CLERK_HAIR[2]);
  face(-8, 2, 15, 5, CLERK_HAIR[3]);
  face(-8, 3, 8, 3, CLERK_HAIR[1]);
  face(-6, 1, 6, 2, CLERK_HAIR[0]);
  face(-9, 4, 4, 8, CLERK_HAIR[2]);
  face(-9, 6, 2, 5, CLERK_HAIR[1]);
  face(3, 3, 5, 7, CLERK_HAIR[2]);
  face(-5, 5, 10, 11, CLERK_SKIN[2]);
  face(-4, 6, 8, 9, CLERK_SKIN[1]);
  face(-4, 6, 4, 2, CLERK_SKIN[0]);
  face(-5, 10, 2, 3, CLERK_SKIN[0]);
  face(-3, 15, 7, 3, CLERK_SKIN[2]);
  face(-2, 16, 5, 1, CLERK_SKIN[1]);
  face(-7, 4, 4, 5, CLERK_HAIR[1]);
  face(-7, 7, 2, 7, CLERK_HAIR[2]);
  face(-7, 8, 1, 5, CLERK_HAIR[0]);
  face(4, 6, 3, 8, CLERK_HAIR[3]);
  face(5, 7, 2, 7, CLERK_HAIR[1]);
  face(6, 11, 2, 7, CLERK_HAIR[2]);
  face(-5, 11, 1, 2, CLERK_LEATHER[0]);

  face(-4, 8, 3, 1, CLERK_SKIN[3]);
  face(2, 8, 2, 1, CLERK_SKIN[3]);
  face(-4, 9, 3, looking ? 2 : 1, CLERK_SKIN[3]);
  face(2, 9, 3, looking ? 2 : 1, CLERK_SKIN[3]);
  if (looking) {
    face(-3, 9, 2, 1, '#e2baa4');
    face(2, 9, 2, 1, '#cba18f');
  }
  face(-3, 11, 1, 3, CLERK_STAIN[1]);
  face(3, 11, 1, 4, CLERK_STAIN[2]);
  face(0, 10, 1, 3, CLERK_SKIN[0]);
  face(0, 13, 2, 1, CLERK_SKIN[2]);
  if (charging) {
    face(-1, 14, 4, 2, CLERK_STAIN[3]);
    face(0, 14, 2, 1, CLERK_BLOUSE[1]);
  } else face(-1, 15, 3, 1, CLERK_STAIN[2]);
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
