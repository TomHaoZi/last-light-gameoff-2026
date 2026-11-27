import { drawJanitor } from './actor-art.js';
import { sceneText } from './cinema.js';

const PAINT = ['#819185', '#546d68', '#3b5354', '#263c44'];
const STEEL = ['#abb39a', '#718983', '#485d5d', '#253c43'];
const BRASS = ['#edd395', '#ba9a59', '#88744b', '#504c3b'];
const PAPER = ['#ede1ba', '#c6bc95', '#9e987b', '#686c60'];
const COAT = ['#9eae9b', '#748681', '#4c6465', '#2c464c'];
const GLASS = ['#6b9393', '#506e78', '#344e5e', '#223b4b'];
const STEP = [[-3, 3], [-2, 1], [0, 0], [3, -3], [1, -2], [0, 0]];

function ease(from, to, value) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

function silhouette(a, x, feet, time, move, visitor, lunch = false) {
  const frame = move ? Math.floor(time * 8) % STEP.length : Math.floor(time * 2) % 4;
  const legs = move ? STEP[frame] : [0, 0];
  const c = a.c;
  c.save();
  c.translate(Math.round(x), Math.round(feet - 28 - (move && frame % 3 === 2 ? 1 : 0)));
  if (visitor) c.globalAlpha *= .65;
  drawJanitor(a, frame, legs, move ? legs[0] : 1, 0, true, move, 1);
  if (visitor === 'gary') {
    a.box(1, 1, 13, 5, BRASS);
    if (lunch) {
      a.box(12, 19, 10, 7, BRASS);
      a.rect(15, 17, 3, 2, STEEL[0]);
    }
  } else if (visitor) {
    a.rect(2, 1, 11, 5, visitor === 'green' ? PAINT[1] : GLASS[2]);
    a.rect(2, 13, 11, 6, visitor === 'green' ? PAINT[1] : GLASS[2]);
    a.line(3, 13, 6, visitor === 'green' ? PAINT[0] : GLASS[0]);
  }
  c.restore();
}

function clockWall(a, burned, open = 0) {
  const wall = burned ? ['#7c7061', '#60584e', '#4a4943', '#333b3c'] : PAINT;
  a.rect(0, 0, 480, 246, wall[3]);
  a.box(36, 13, 411, 187, wall);
  for (let row = 0; row < 4; row++) {
    const y = 25 + row * 43;
    a.line(38, y, 407, wall[2]);
    for (let col = 0; col < 4; col++) {
      const x = 54 + col * 108 + row % 2 * 34;
      a.rect(x, y, 2, 40, wall[2]);
      if (x > 405) continue;
      a.rect(x + 3, y + 2, 2 + col % 2, 2, wall[0]);
    }
  }
  a.box(38, 21, 17, 177, STEEL); a.box(57, 20, 9, 178, STEEL);
  a.pipe(36, 57, 31, 8, false, STEEL); a.pipe(36, 144, 30, 9, false, STEEL);
  a.box(334, 48, 67, 141, burned ? wall : STEEL);
  a.box(338, 52, 58, 137, wall);
  if (open > 0) {
    const gap = Math.round(36 * open);
    a.rect(338, 54, gap, 134, '#242f37');
    a.rect(339, 60, 3, 128, '#998360');
    a.line(339, 187, gap + 6, '#af9165');
  }
  const leaf = Math.round(open * 13);
  a.box(347 + leaf, 69, 34 - leaf, 39, GLASS);
  a.rect(349 + leaf, 72, 5, 31, GLASS[0]);
  a.box(381 + (leaf >> 1), 126, 9, 27, STEEL);
  a.rect(382 + (leaf >> 1), 131, 6, 2, BRASS[0]);
  a.rect(0, 188, 480, 58, '#293f44');
  a.line(64, 188, 371, STEEL[0]);
  a.line(0, 205, 480, '#41575a');
  a.line(0, 226, 480, '#24373e');
  if (burned) {
    for (const [x, y, w, h] of [[129,31,43,9],[122,40,52,18],[118,55,44,34],[125,87,24,11],[301,24,29,9],
      [310,32,28,26],[321,48,15,41],[328,86,8,14],[407,42,14,68],[417,34,11,28]]) {
      a.rect(x, y, w, h, '#3d4040');
    }
    a.rect(328, 86, 3, 21, '#584a40');
    a.rect(136, 57, 5, 22, '#5e5046');
  }
}

function punchClock(a, hour, active) {
  a.rect(156, 39, 143, 116, '#293e43');
  a.box(149, 33, 143, 114, STEEL);
  a.box(157, 41, 126, 68, GLASS);
  a.rect(164, 48, 112, 52, '#233b47');
  a.line(169, 50, 104, '#3b5e65');
  a.label(hour, 180, 84, active ? '#ead397' : '#a9bda9', 24);
  a.box(168, 117, 70, 13, STEEL);
  a.rect(174, 121, 58, 3, STEEL[3]);
  a.box(177, 125, 48, 29, PAPER);
  a.line(182, 131, 37, PAPER[2]);
  a.line(182, 136, 30, PAPER[2]);
  a.line(182, 141, 12, '#7c6250');
  a.rect(250, 119, 4, 4, active ? BRASS[0] : STEEL[2]);
  a.rect(269, 106, 2, 17, '#746650');
  a.line(266, 105, 6, '#84998c');
  a.glow(213, 69, 64, 28, '#e1b771', active ? .13 : .045);
}

function opening(a, scene, reduced) {
  const { beat, time } = scene;
  const changed = beat > 0;
  const open = beat === 2 ? ease(1.39, 1.92, time) : 0;
  clockWall(a, changed, open);
  if (beat === 1 && !reduced) {
    const edge = Math.round(480 * ease(.02, .61, time));
    if (edge < 480) {
      const c = a.c;
      c.save(); c.beginPath(); c.rect(edge, 0, 480 - edge, 246); c.clip();
      clockWall(a, false);
      c.restore();
    }
    if (edge > 0 && edge < 480) {
      a.rect(edge - 2, 0, 3, 189, '#a09471');
      a.rect(edge + 1, 0, 1, 189, '#676b58');
    }
  }
  punchClock(a, changed ? '18:00' : '17:59', changed);
  const approach = beat === 0 ? ease(.02, .85, time) : 1;
  const step = beat === 2 ? ease(.16, 1.34, time) : 0;
  const x = 96 + (reduced ? 29 : approach * 29) + (reduced && beat === 2 ? 225 : step * 225);
  a.glow(359, 133, 47, 48, '#c2a774', .07 + open * .19);
  const c = a.c;
  c.save();
  c.translate(x, 188);
  c.scale(2, 2);
  silhouette(a, 0, 0, time, !reduced && (beat === 0 && approach < 1 || beat === 2 && step < 1));
  if (beat === 2 && step > 0) {
    a.rect(15, -12, 5, 1, BRASS[0]);
    a.rect(19, -11, 1, 2, BRASS[1]);
  }
  c.restore();
}

function roofDoor(a, power, open, time, reduced) {
  a.rect(0, 0, 480, 246, '#243d4d');
  [0, 29, 64, 106].forEach((y, i) => a.rect(0, y, 480, 43, ['#2f4a5b', '#3d5864', '#4b6468', '#536c69'][i]));
  for (let i = 0; i < 18; i++) {
    const x = i * 18, y = 76 + (i * 57 % 34);
    a.rect(x, y, 15 + i % 3 * 3, 150 - y, '#47646a');
    if (i % 4 === 2) a.rect(x + 7, y - 9, 1, 9, '#5b7475');
  }
  for (let i = 0; i < 14; i++) {
    const x = i * 24 - 7, y = 91 + (i * 37 % 29);
    a.rect(x, y, 17 + i % 3 * 5, 77 - y + 65, i % 2 ? '#314d57' : '#3a545c');
    a.line(x, y, 9, '#789084');
    if (i % 3) a.rect(x + 6, y + 6, 3, 2, '#b8a778');
  }
  a.glow(110, 68, 61, 41, '#d6b384', .12);
  a.box(41, 146, 344, 43, GLASS);
  a.box(26, 189, 432, 45, STEEL);
  a.line(32, 199, 418, '#bcc6ac');
  for (let i = 0; i < 8; i++) {
    const x = 48 + i * 53;
    a.rect(x, 204, 22 + i % 3 * 5, 3, '#496564');
    a.line(x + 4, 205, 19, '#a1b39a');
    a.rect(x + 14, 214, 2, 2, '#506964');
    a.rect(x + 15, 214, 1, 1, '#9baa96');
  }
  a.box(315, 38, 130, 161, PAINT);
  a.box(325, 49, 109, 148, STEEL);
  a.box(340, 76, 74, 121, BRASS);
  a.rect(344, 81, 65, 115, '#233d4b');
  const gap = Math.round(63 * open);
  if (gap > 0) {
    a.rect(344, 82, gap, 113, power ? '#cbb374' : '#8f9a83');
    const c = a.c;
    c.save(); c.beginPath(); c.rect(344, 82, gap, 113); c.clip();
    a.rect(342, 150, 18, 45, '#7f8468');
    a.rect(359, 144, 28, 51, '#88876a');
    a.rect(367, 130, 2, 15, '#8d896a');
    a.rect(379, 152, 30, 44, '#91916f');
    a.line(347, 155, 59, '#ada478');
    c.restore();
    a.glow(345 + gap / 2, 164, 22 + gap, 51, power ? '#e6be75' : '#a8b99a', .20 * open);
    for (let i = 0; i < 12; i++) {
      a.line(342 - gap * (.18 + i * .041), 192 + i * 2, Math.ceil(gap * (1 + i * .035)), power ? '#a08e61' : '#7c927f');
    }
  }
  if (gap < 63) {
    a.box(344 + gap, 82, 65 - gap, 113, STEEL);
    if (gap < 54) a.box(347 + gap, 144, 6, 15, BRASS);
  }
  a.box(353, 58, 38, 9, STEEL);
  a.rect(358, 60, 25, 4, power ? '#e9cf80' : '#9ba790');
  a.glow(372, 66, 43, 28, power ? '#ebc36e' : '#c2cdb3', (power ? .39 : .11) * (reduced ? 1 : .98 + .02 * Math.sin(time)));
}

function handoverPage(a, time, zh) {
  const c = a.c;
  c.save();
  c.globalAlpha = ease(.35, .94, time);
  a.rect(140, 33, 209, 133, '#293d43');
  a.box(133, 27, 210, 134, PAPER);
  a.rect(134, 27, 8, 131, BRASS[2]);
  a.label(zh ? '交班簿' : 'HANDOVER REGISTER', 155, 51, PAPER[3], 10);
  for (let i = 0; i < 5; i++) {
    a.line(156, 62 + i * 12, 158, PAPER[2]);
    a.rect(158, 59 + i * 12, 16 + (i * 7) % 13, 1, '#766c5c');
    a.rect(280, 59 + i * 12, 26, 1, '#766c5c');
  }
  a.box(155, 125, 156, 23, BRASS);
  a.label(zh ? '所有人都已离开' : 'EVERYONE HAS LEFT', 170, 139, BRASS[3], 10);
  c.restore();
}

function ending(a, world, scene, settled) {
  const { beat, time } = scene;
  const full = scene.id === 'ending-complete';
  const reduced = world.reducedEffects;
  const power = full || world.events?.includes('emergency-light');
  const open = beat > 0 ? 1 : ease(.18, 1.04, time);
  roofDoor(a, power, open, time, reduced);
  const entry = beat === 0 ? 298 + ease(.06, .58, time) * 16 : 314;
  const leave = beat === scene.beats - 1 ? ease(.55, 3.0, time) : 0;
  const c = a.c;
  const eli = entry + (reduced ? 24 : 70) * leave;
  c.save();
  c.globalAlpha = 1 - leave * .76;
  silhouette(a, eli, 191, time, leave > 0 && leave < 1 && !reduced);
  c.restore();
  if (beat === 0) {
    a.rect(eli + 11, 174, 22, 3, COAT[2]);
    a.line(eli + 15, 174, 15, COAT[0]);
    a.rect(eli + 31, 174, 3, 3, BRASS[1]);
  }
  if (full && beat === 1) {
    const movement = ease(.05, 3.91, time);
    for (let i = 0; i < 4; i++) {
      const x = (reduced ? 237 : 111 + movement * 236) + i * 23;
      if (x > 407) continue;
      c.save(); c.globalAlpha = x > 363 ? Math.max(0, (404 - x) / 41) : 1;
      silhouette(a, x, 191, time + i * .16, !reduced && movement < 1, i % 2 ? 'green' : 'blue');
      c.restore();
    }
  }
  if (full && beat === 2) {
    const k = ease(.93, 3.65, time);
    const x = 274 + (reduced ? 26 : 111) * k;
    c.save(); c.globalAlpha = 1 - k * .6;
    silhouette(a, x, 191, time, !reduced && k > 0 && k < 1, 'gary', time >= .88);
    c.restore();
    if (time < .88) {
      const take = ease(.12, .88, time);
      const boxX = 310 - take * 24;
      a.box(boxX, 181 - Math.sin(take * Math.PI) * 4, 10, 7, BRASS);
      a.rect(boxX + 3, 179 - Math.sin(take * Math.PI) * 4, 3, 2, STEEL[0]);
    }
  }
  if (full && beat === 3) handoverPage(a, time, world.lang === 'zh');
  if (settled) a.rect(0, 0, 480, 246, '#182c3a55');
}

export function drawStoryScene(a, world) {
  const scene = world.scene;
  const settled = world.mode === 'won' && world.expanded;
  if (!settled && scene?.id !== 'clock' && !scene?.id.startsWith('ending-')) return false;
  if (settled) {
    const complete = world.ending === 'complete';
    ending(a, world, { id: complete ? 'ending-complete' : 'ending-normal', beats: complete ? 4 : 3, beat: complete ? 3 : 2, time: 4.2 }, true);
    a.rect(0, 246, 480, 24, '#20343c');
    return true;
  }
  if (scene.id === 'clock') opening(a, scene, world.reducedEffects);
  else ending(a, world, scene, false);
  a.rect(0, 0, 480, 13, '#20343c');
  a.rect(0, 245, 480, 25, '#20343c');
  const lines = a.wrap(sceneText(world), 426, 9);
  const height = lines.length * 13 + 16;
  const y = 251 - height;
  a.rect(15, y, 450, height, '#19313cef');
  a.line(15, y, 450, '#a79a71');
  lines.forEach((line, i) => a.label(line, 27, y + 15 + i * 13, '#eee1b7', 9));
  return true;
}

export function lifeSprite(player, reduced) {
  const time = player.deathTime ?? 0;
  const stagedTilt = reduced ? .57 : 1;
  if (player.anim === 'ghostDeath') {
    const catchBeat = ease(0, .19, time);
    const released = ease(.35, .69, time);
    return { bob: -7 * catchBeat + released * 11, arm: -9 * catchBeat + released * 11,
      legs: [-4 * catchBeat, 3 * catchBeat], rot: (.19 * catchBeat + released * .86) * stagedTilt,
      alpha: 1 - ease(.69, .90, time) * .72 };
  }
  if (player.anim === 'death') {
    const recoil = ease(.02, .16, time);
    const collapse = ease(.17, .63, time);
    return { bob: -4 * recoil + 10 * collapse, arm: -6 * recoil + 10 * collapse,
      legs: [3 * collapse, -2 * recoil], rot: (recoil * .22 + collapse * .96) * stagedTilt,
      alpha: 1 - .38 * ease(.68, .9, time) };
  }
  if (player.anim === 'fallDeath') {
    const grab = ease(0, .18, time);
    const drop = ease(.10, .72, time);
    return { bob: 36 * drop, arm: -12 * grab + 7 * drop, legs: [-3 * grab, 4 * grab],
      rot: (.14 * grab - .55 * drop) * stagedTilt, alpha: 1 - ease(.28, .80, time) };
  }
  if (player.anim === 'revive') {
    const stand = ease(.09, .60, player.lifeTime);
    return { bob: 8 * (1 - stand), arm: 7 * (1 - stand), legs: [-2 * (1 - stand), 2 * (1 - stand)],
      rot: -.36 * stagedTilt * (1 - stand), alpha: .48 + .52 * ease(0, .27, player.lifeTime) };
  }
  return null;
}

export function drawLifeShading(a, world) {
  const player = world.player;
  const dying = player.lifeState === 'dying';
  if (!dying && player.lifeState !== 'respawning') return;
  const c = a.c;
  const time = player.lifeTime ?? 0;
  const strength = dying ? .84 * ease(.38, .91, time) : .76 * (1 - ease(.02, .39, time));
  c.save();
  c.globalAlpha = strength;
  a.rect(0, 0, 480, 246, '#1b2f3b');
  c.restore();
}
