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

const CLERK_WRAP = ['#e7d7b6', '#bda98b', '#907765', '#575052'];
const CLERK_SKIN = ['#f3e6cc', '#c9c8af', '#899c95', '#45595a'];
const CLERK_COAT = ['#e1d9c1', '#b3b4a5', '#7e8a84', '#4d5c60'];
const CLERK_BLOUSE = ['#e5d8b6', '#b4b8ab', '#899b96', '#45585b'];
const CLERK_LEATHER = ['#ad9a84', '#877b73', '#66595b', '#423b48'];
const CLERK_STAIN = ['#b48c83', '#946360', '#704850', '#523a46'];

function pixelStroke(a, start, end, width, ramp, taper = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 1.6));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const size = Math.max(2, Math.round(width - taper * t));
    const x = Math.round(start[0] + (end[0] - start[0]) * t - size / 2);
    const y = Math.round(start[1] + (end[1] - start[1]) * t - size / 2);
    a.rect(x, y, size, size, ramp[3]);
    if (size > 2) a.rect(x, y, size - 1, size - 1, ramp[2]);
    if (size > 3) a.rect(x + 1, y, size - 3, 2, ramp[1]);
  }
}

export function drawClerkForearms(a, x, y, target, facing, grip) {
  for (const near of [false, true]) {
    const start = [x + facing * (near ? 5 : -2), y - (near ? 6 : 8)];
    const rest = [x + facing * (near ? 7 : -8), y + (near ? 10 : 8)];
    const palm = [rest[0] + (target.x + (near ? -1 : 3) * facing - rest[0]) * grip,
      rest[1] + (target.y + (near ? 0 : 6) - rest[1]) * grip];
    const elbow = [(start[0] + palm[0]) / 2 + 4 * facing, (start[1] + palm[1]) / 2 + (near ? 6 : -4)];
    pixelStroke(a, start, elbow, 6, CLERK_COAT, 1);
    pixelStroke(a, elbow, palm, 5, CLERK_COAT, 1);
    a.rect(palm[0] - 2, palm[1] - 2, 5, 5, CLERK_SKIN[3]);
    a.rect(palm[0] - 2, palm[1] - 2, 3, 3, near ? CLERK_SKIN[0] : CLERK_SKIN[2]);
    a.rect(palm[0] + facing * 2 - 1, palm[1] - 1, 2, 1, CLERK_SKIN[1]);
  }
}

export function drawJanitorCapture(a, { x, feet, direction, tilt, lift, appeal, dropCap, opacity = 1 }) {
  const stable = Math.cos(tilt);
  const sway = Math.sin(tilt) * direction;
  const raised = feet - lift;
  const torsoFloor = raised - (1 - stable) * 5;
  const hip = [x + sway * 11, torsoFloor - 11 * stable];
  const shoulders = [x + sway * 20, torsoFloor - 19 * stable];
  const head = [x + sway * 26, torsoFloor - 25 * stable];
  const c = a.c;
  c.save();
  c.globalAlpha *= opacity;
  for (const side of [-1, 1]) {
    const knee = [x + sway * 4 + side * (2 + appeal * 2), raised - (5 + side * appeal * 2) * stable];
    const heel = [x + side * 3 - direction * appeal * 2, raised - 2 + side * appeal * 2];
    pixelStroke(a, hip, knee, 5, COAT);
    pixelStroke(a, knee, heel, 5, COAT, 1);
    a.rect(heel[0] - 2, Math.min(feet - 3, heel[1] - 1), 7, 3, BOOTS[3]);
    a.rect(heel[0] - 2, Math.min(feet - 3, heel[1] - 1), 5, 1, BOOTS[0]);
  }
  const elbow = [shoulders[0] - 5 * direction, Math.min(feet - 3, shoulders[1] + 5)];
  const palm = [shoulders[0] - direction * (5 + appeal * 6), Math.min(feet - 3, shoulders[1] + 9 - appeal * 17)];
  pixelStroke(a, shoulders, elbow, 5, COAT);
  pixelStroke(a, elbow, palm, 5, COAT, 2);
  a.rect(palm[0] - 2, palm[1] - 1, 4, 3, FACE[1]);
  pixelStroke(a, hip, shoulders, 11, COAT, 2);
  a.rect(hip[0] + direction * 3 - 1, hip[1] + 2, 3, 2, CAP[2]);
  a.rect(shoulders[0] + 2, shoulders[1] + 1, 3, 2, CAP[0]);
  const farPalm = [shoulders[0] + direction * (4 + appeal * 3), Math.min(feet - 3, shoulders[1] + 11 - appeal * 13)];
  pixelStroke(a, [shoulders[0] + 4, shoulders[1] + 1], farPalm, 5, COAT, 2);
  a.rect(farPalm[0] - 1, farPalm[1] - 1, 3, 4, FACE[2]);
  a.rect(head[0] - 4, head[1] - 3, 9, 7, FACE[3]);
  a.rect(head[0] - 3, head[1] - 3, 7, 6, FACE[1]);
  a.rect(head[0] - direction * 2, head[1] - 1, 2, 1, FACE[3]);
  a.rect(head[0] - 3, head[1] - 3, 6, 1, FACE[0]);
  const capX = head[0] + direction * 11 * dropCap;
  const capY = head[1] - 5 - Math.sin(dropCap * Math.PI) * 9 + dropCap * (feet - head[1] + 1);
  a.rect(capX - 5, capY - 1, 9, 4, CAP[3]);
  a.rect(capX - 4, capY - 1, 7, 2, CAP[1]);
  a.rect(capX - 4, capY - 1, 4, 1, CAP[0]);
  a.rect(capX - 6, capY + 2, 5, 1, CAP[2]);
  c.restore();
  return { x: shoulders[0], y: shoulders[1] };
}

export function drawMourningClerk(a, ghost, x, y) {
  const {gaze = 0, looking, charging, capture, recoil = 0} = ghost;
  const direction = ghost.facing === -1 ? -1 : 1;
  const lean = capture ? 0 : charging ? direction * 4 : recoil > .07 ? -direction * 2 : looking ? direction : 0;
  const stride = charging && !capture ? Math.round(Math.sin(a.t * 26) * 3) : 0;
  const faceY = looking ? -25 : -22 + (recoil > .07 ? 2 : 0);
  const rect = (dx, dy, w, h, color) => a.rect(x + dx, y + dy, w, h, color);
  const face = (dx, dy, w, h, color) => rect(lean + dx, faceY + dy, w, h, color);
  const forward = (dx, dy, w, h, color) => rect(direction === 1 ? dx : 1 - dx - w, dy, w, h, color);

  a.glow(x, y - 3, 30, 37, charging ? '#c58573' : '#a3bdb4', .07 + gaze * .1);
  // Tailored ward uniform, stocking seams, and practical shoes.
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

  if (charging && !capture) {
    forward(4, -7, 8, 5, CLERK_COAT[3]);
    forward(8, -9, 9, 4, CLERK_COAT[2]);
    forward(12, -9, 4, 1, CLERK_COAT[1]);
    forward(15, -10, 4, 3, CLERK_SKIN[2]);
    forward(17, -10, 3, 1, CLERK_SKIN[1]);
  } else if (!capture) {
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

  if (charging && !capture) {
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
  } else if (!capture) {
    rect(-10, -7, 4, 15, CLERK_COAT[3]);
    rect(-10, -7, 3, 12, CLERK_COAT[1]);
    rect(-10, -7, 1, 6, CLERK_COAT[0]);
    rect(-10, 5, 3, 2, CLERK_BLOUSE[1]);
    rect(-10, 7, 4, 6, CLERK_SKIN[3]);
    rect(-10, 7, 2, 5, CLERK_SKIN[1]);
    rect(-8, 9, 1, 3, CLERK_SKIN[2]);
  }

  // Wrapped silhouette, offset coils and a folded ward cap at native pixel scale.
  face(-6, 0, 12, 6, CLERK_WRAP[3]);
  face(-5, 0, 10, 4, CLERK_COAT[1]);
  face(-4, 0, 8, 1, CLERK_COAT[0]);
  face(-1, 2, 2, 2, CLERK_STAIN[2]);
  face(-7, 4, 14, 10, CLERK_WRAP[3]);
  face(-6, 5, 13, 3, CLERK_WRAP[1]);
  face(-5, 5, 9, 1, CLERK_WRAP[0]);
  face(-7, 8, 12, 3, CLERK_WRAP[2]);
  face(-6, 8, 10, 1, CLERK_WRAP[0]);
  face(-5, 11, 11, 3, CLERK_WRAP[1]);
  face(-4, 12, 8, 1, CLERK_WRAP[0]);
  face(-4, 14, 8, 2, CLERK_WRAP[2]);
  face(-3, 16, 6, 2, CLERK_SKIN[2]);
  face(-2, 16, 4, 1, CLERK_SKIN[1]);
  face(2, 8, 2, 2, CLERK_STAIN[2]);
  face(2, 11, 2, 2, CLERK_STAIN[1]);
  face(-5, 10, 3, 3, '#4d292e');
  face(-4, 13, 2, 3, '#653237');
  face(-3, 15, 2, charging || capture ? 3 : 1, '#862d36');
  if (charging || capture) {
    const clench = Math.sin(a.t * 19) > .4 ? 2 : 1;
    face(-1, 16, 4, clench, '#33181e');
    face(0, 16, 2, 1, '#b6a480');
    face(-3, 17, 1, 1, '#b94440');
  }
}

export function drawApparition(a, ghost, x, y) {
  if (ghost.kind === 'mourner') {
    drawMourningClerk(a, ghost, x, y);
    return;
  }
  const chase = ghost.state === 'chase', alert = ghost.state === 'alert', search = ghost.state === 'search';
  const dir = ghost.facing === -1 ? -1 : 1;
  const clock = a.t * (chase ? 19 : search ? 6 : 4) + (ghost.seed || 0);
  const step = Math.sin(clock);
  const pulse = alert ? .9 : .76 + step * (chase ? .095 : .12);
  const face = chase ? '#e8a286' : alert ? '#e2d7a7' : '#c5c5a3';
  const sway = alert ? 0 : Math.round(step * (chase ? 4 : 2));
  const lean = chase ? dir*3 : alert ? dir : search ? Math.round(step*2) : 0;
  const lift = alert ? -2 : chase ? Math.round(Math.abs(step)*2) : 0;
  const blink = !chase && !alert && Math.sin(clock*.55)>.975;
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

  const arm = chase ? -6 : alert && ghost.kind === 'listener' ? -8 : search ? -3 : 0;
  const left = dir < 0 ? arm : -sway;
  const right = dir > 0 ? arm : sway;
  a.rect(x - 10, y - 5 + Math.min(0,left), 4, 12, GHOST[2]);
  a.rect(x - 12, y + 6 + left, 5, 3, GHOST[1]);
  a.rect(x - 13, y + 8 + left, 3, 2, GHOST[2]);
  a.rect(x + 8, y - 3 + right, 4, 10, GHOST[2]);
  a.rect(x + 10, y + 5 + right, 4, 2, GHOST[1]);
  a.rect(x + 13, y + 4 + right, 2, 2, GHOST[2]);

  a.rect(x - 5 + lean, y - 15 + lift, 10, 7, GHOST[1]);
  a.line(x - 4 + lean, y - 16 + lift, 5, GHOST[0]);
  a.rect(x - 4 + lean, y - 13 + lift, 3, 3, GHOST[3]);
  a.rect(x + 2 + lean, y - 13 + lift, 3, 3, GHOST[3]);
  if (!blink) {
    a.line(x - 4 + lean, y - 13 + lift, 2, face);
    a.line(x + 2 + lean, y - 13 + lift, 2, face);
  }
  a.rect(x - 1 + lean, y - 9 + lift, 3, chase ? 4 : 2, GHOST[3]);
  if (chase) {
    a.line(x - 1 + lean, y - 9 + lift, 2, '#b8ad91');
    a.rect(x + lean + dir, y - 7 + lift, 2, 3, '#701f2c');
    a.rect(x + lean + dir, y - 7 + lift, 1, 1, '#bd4a49');
  }
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
    a.rect(x - 9 + lean, y - 16 + lift, 4, 7, GHOST[2]);
    a.rect(x + 5 + lean, y - 17 + lift, 4, 7, GHOST[2]);
    a.line(x - 9 + lean, y - 16 + lift, 3, GHOST[0]);
    a.line(x + 5 + lean, y - 17 + lift, 3, GHOST[1]);
  } else if (ghost.kind === 'watcher') {
    a.rect(x - 6 + lean, y - 20 + lift, 13, 3, GHOST[1]);
    a.line(x - 7 + lean, y - 18 + lift, 15, GHOST[0]);
    a.rect(x + lean + (dir === 1 ? 4 : -7), y - 18 + lift, 3, 2, face);
  }
  c.restore();
}

export function drawContactDrops(a, x, y, time, direction = 1, reduced = false) {
  if (reduced || time <= 0 || time > .52) return;
  const age = time/.52;
  a.c.save();
  a.c.globalAlpha = Math.min(1,age*14)*(1-age*age);
  for(let i=0;i<9;i++) {
    const angle = (i+.4)*2.399;
    const dx = (Math.cos(angle)*12+direction*14)*age;
    const dy = -(17+Math.sin(angle)*10)*age+28*age*age;
    a.rect(x+dx-1,y+dy,2+i%3,1+(i%3===0),'#68212e');
    if(i%2===0) a.rect(x+dx,y+dy,1,1,'#b5484b');
  }
  a.c.restore();
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
