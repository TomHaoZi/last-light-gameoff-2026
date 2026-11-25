// The building's fixed furnishings sit behind every phase-dependent object.
// Light falls from the upper left. Each row is highlight, base, shadow, ink.
const MATERIALS = {
  boiler: [
    { wall: ['#807970', '#5e6259', '#4b534e', '#354440'], metal: ['#948c73', '#686d60', '#4b5750', '#364643'] },
    { wall: ['#546369', '#394b52', '#303f48', '#25333d'], metal: ['#718188', '#51656b', '#3c4f5b', '#2b3c47'] }
  ],
  office: [
    { wall: ['#a49b81', '#787e69', '#616955', '#475548'], metal: ['#a99a75', '#777b61', '#5e6655', '#455447'] },
    { wall: ['#5e6970', '#444f53', '#36454c', '#293941'], metal: ['#7c8181', '#535e61', '#3f4f57', '#31424b'] }
  ],
  roof: [
    { wall: ['#92a69a', '#6d877e', '#586f69', '#46625f'], metal: ['#a1ac96', '#738b80', '#566e68', '#425f5e'] },
    { wall: ['#627986', '#415966', '#344b5a', '#293e50'], metal: ['#809396', '#566d76', '#435c69', '#314a5a'] }
  ]
};
const SKIES = [
  ['#a3bab2', '#acbdb0', '#b9c6ac', '#c6caae', '#d1cfaa', '#d8cc9f', '#d3c393'],
  ['#1e3248', '#253b52', '#2e465d', '#385568', '#486575', '#597381', '#697e86']
];
const TILE_WIDTH = 480;
const TILE_HEIGHT = 270;

function sky(a, x, y, w, h, night, seed) {
  const colors = SKIES[+night];
  for (let band = 0; band < colors.length; band++) {
    const top = Math.floor(band * h / colors.length);
    const bottom = Math.floor((band + 1) * h / colors.length);
    a.rect(x, y + top, w, bottom - top, colors[band]);
    if (band === 3) for (let k = 0; k < w; k += 2) a.rect(x + k, y + top + (k / 2) % 2, 1, 1, colors[band - 1]);
  }
  const skyline = night ? ['#536d7b', '#3b5266', '#31475b', '#212f45'] : ['#a6ad96', '#859e96', '#6b877f', '#586e68'];
  const column = Math.max(16, Math.floor(w / 9));
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i < Math.ceil(w / column); i++) {
      const start = i * column + (layer ? -Math.floor(column / 2) : 0);
      const left = Math.max(0, start);
      const right = Math.min(start + column - 2, w);
      if (right <= left) continue;
      const tall = Math.min(h - 9, Math.floor(h * (.2 + ((i * 17 + seed * 13 + layer * 4) % 19) / 63)));
      const xx = x + left, yy = y + h - tall - (layer ? 0 : Math.floor(h * .06));
      a.rect(xx, yy, right - left, y + h - yy, skyline[layer ? 2 : 1]);
      a.line(xx, yy, right - left, skyline[0]);
      if (right - left > 11) {
        a.rect(xx + 4, yy - 3, 7, 3, skyline[layer ? 2 : 1]);
        if (layer && (i + seed) % 3 !== 1) a.rect(xx + 4, yy + 5, 3, 3, night ? '#ceb47f' : '#a3ab90');
        if (layer && (i + seed) % 3 === 2) a.rect(xx + 10, yy + 5, 3, 3, night ? '#9eaa99' : '#8a9b88');
      }
    }
  }
  if (night && seed % 3 === 0) {
    const mx = x + w - Math.max(17, Math.floor(w * .18)), my = y + Math.max(9, Math.floor(h * .12));
    a.rect(mx, my, 8, 12, '#b7bda2');
    a.rect(mx - 2, my + 2, 10, 8, '#c4c7a9');
    a.rect(mx + 3, my - 1, 8, 8, colors[0]);
    a.rect(mx - 1, my + 3, 2, 5, '#ddd5ad');
  }
}

function windowBay(a, x, y, w, h, metal, night, seed, arched) {
  if (arched) {
    a.box(x + 9, y - 6, w - 18, h + 15, metal);
    a.rect(x + 4, y - 2, w - 8, 8, metal[1]);
  }
  a.box(x, y, w, h, metal);
  a.rect(x + 4, y + 3, w - 8, h - 6, metal[3]);
  sky(a, x + 6, y + 5, w - 12, h - 11, night, seed);
  const light = night ? '#778c8c' : '#cbd0b3';
  if (!night) {
    a.line(x + 9, y + 9, Math.floor(w * .62), light);
    a.rect(x + 11, y + 10, 2, Math.floor(h * .49), light);
    for (let i = 0; i < 4; i++) a.rect(x + 14 + i * 3, y + 18 + i * 3, 3, 3, '#c3cdb5');
  }
  for (let i = 1; i <= 2; i++) {
    const col = x + Math.floor(w * i / 3);
    a.rect(col, y + 4, 3, h - 8, metal[3]);
    a.rect(col, y + 4, 1, h - 8, metal[0]);
  }
  a.rect(x + 5, y + Math.floor(h * .63), w - 10, 3, metal[3]);
  a.line(x + 5, y + Math.floor(h * .63), w - 10, metal[1]);
  a.box(x - 3, y + h - 2, w + 6, 6, metal);
}

function brickwork(a, wall, shift) {
  a.rect(0, 0, TILE_WIDTH, TILE_HEIGHT, wall[2]);
  for (let row = 0; row < 9; row++) for (let i = -1; i < 12; i++) {
    const variant = ((i + 21) * 7 + row * 5 + shift) % 4;
    const x = i * 48 + (row % 2) * 24, y = row * 30;
    a.rect(x, y, 47, 29, wall[1]);
    a.line(x + 2, y + 1, variant === 0 ? 35 : 44, wall[0]);
    a.rect(x + 46, y + 4, 1, 25, wall[3]);
    if (variant === 1) {
      a.rect(x + 29, y + 22, 13, 4, wall[2]);
      a.rect(x + 35, y + 19, 7, 7, wall[2]);
    }
    if (variant === 2) {
      a.line(x + 7, y + 6, 12, wall[0]);
      a.line(x + 9, y + 7, 7, wall[0]);
    }
  }
}

function spandrel(a, x, metal) {
  a.rect(x, 0, 13, TILE_HEIGHT, metal[3]);
  a.rect(x + 1, 0, 8, TILE_HEIGHT, metal[2]);
  a.rect(x + 1, 0, 2, TILE_HEIGHT, metal[1]);
  for (let y = 20; y < TILE_HEIGHT; y += 64) {
    a.box(x - 4, y, 20, 7, metal);
    a.rect(x - 1, y + 3, 2, 3, metal[3]);
    a.rect(x + 10, y + 6, 2, 7, metal[3]);
  }
}

function boilerTile(a, s, night) {
  const { wall, metal } = MATERIALS.boiler[+night];
  brickwork(a, wall, s.sector);
  for (const x of [15, 175, 335]) {
    const recess = s.sector === 2 || s.sector === 3 || s.sector === 5;
    a.box(x + 25, 73, 109, 135, metal);
    a.rect(x + 31, 79, 97, 124, wall[3]);
    if (recess) {
      a.pipe(x + 47, 72, 14, 128, true, metal);
      a.pipe(x + 70, 100, 12, 103, true, metal);
      a.pipe(x + 95, 72, 17, 130, true, metal);
      a.box(x + 102, 117, 17, 15, metal);
      a.line(x + 105, 121, 9, wall[0]);
      a.line(x + 105, 125, 7, wall[0]);
    } else {
      windowBay(a, x + 33, 81, 92, 107, metal, night, (x + s.sector) % 9, true);
      for (const offset of [37, 113]) a.rect(x + offset, 90, 2, 90, metal[1]);
    }
    spandrel(a, x, metal);
  }
  a.box(0, 20, TILE_WIDTH, 14, metal);
  a.line(0, 33, TILE_WIDTH, wall[3]);
  a.pipe(0, 216, TILE_WIDTH, 10, false, metal);
  a.rect(0, 231, TILE_WIDTH, 39, wall[3]);
  a.line(0, 231, TILE_WIDTH, metal[1]);
}

function officeTile(a, s, night) {
  const { wall, metal } = MATERIALS.office[+night];
  a.rect(0, 0, TILE_WIDTH, TILE_HEIGHT, wall[1]);
  const paneled = s.sector === 2 || s.sector === 4 || s.sector === 5;
  for (let i = 0; i < 3; i++) {
    const x = i * 160 + 14;
    a.rect(x - 6, 25, 2, 216, wall[0]);
    if (paneled) {
      a.box(x + 15, 55, 118, 126, metal);
      a.rect(x + 22, 60, 103, 115, wall[2]);
      for (let k = 0; k < 5; k++) {
        a.line(x + 23, 78 + k * 21, 100, metal[1]);
        a.line(x + 23, 79 + k * 21, 100, metal[3]);
        if (s.sector === 2) {
          for (let z = 0; z < 6; z++) {
            const bx = x + 26 + z * 15;
            a.box(bx, 65 + k * 21, 12, 13, metal);
            a.line(bx + 3, 73 + k * 21, 6, wall[0]);
          }
        }
      }
      if (s.sector === 4 && night) {
        a.rect(x + 40, 84, 31, 87, metal[3]);
        a.rect(x + 53, 74, 22, 51, metal[3]);
        a.rect(x + 34, 137, 19, 33, metal[3]);
        a.line(x + 53, 83, 11, wall[2]);
      }
    } else {
      windowBay(a, x + 15, 51, 116, 128, metal, night, 3 + i + s.sector, false);
      for (let u = 0; u < 5; u++) a.line(x + 20, 61 + u * 6, 107, metal[3]);
      if (night) {
        a.rect(x + 21, 177, 8, 13 + i, wall[2]);
        a.rect(x + 23, 182, 4, 10 + i * 2, wall[3]);
        a.rect(x + 100, 175, 17, 4, metal[3]);
        a.rect(x + 108, 179, 5, 9, wall[2]);
      }
    }
    a.box(x + 5, 201, 138, 48, metal);
    a.box(x + 12, 208, 55, 31, wall);
    a.box(x + 76, 208, 55, 31, wall);
  }
  a.box(0, 25, TILE_WIDTH, 10, metal);
  a.box(0, 192, TILE_WIDTH, 7, metal);
  a.line(0, 250, TILE_WIDTH, metal[0]);
  a.rect(0, 251, TILE_WIDTH, 19, metal[3]);
}

function roofTile(a, s, night) {
  const { wall, metal } = MATERIALS.roof[+night];
  a.rect(0, 0, TILE_WIDTH, TILE_HEIGHT, wall[2]);
  sky(a, 0, 0, TILE_WIDTH, 230, night, 6);
  if (s.sector < 3) {
    a.rect(0, 0, TILE_WIDTH, 38, metal[3]);
    for (let i = 0; i < 4; i++) {
      const x = i * 120;
      a.box(x + 8, 30, 104, 205, metal);
      if (s.sector === 2) {
        windowBay(a, x + 15, 40, 91, 168, metal, night, 6 + i, true);
        const light = night ? '#607b84' : '#adc1a9';
        for (let k = 0; k < 7; k++) a.rect(x + 39 + k * 6, 58 + k * 9, 2, 9, light);
      } else {
        for (let k = 0; k < 6; k++) a.box(x + 18, 43 + k * 27, 84, 14, wall);
      }
      spandrel(a, x, metal);
    }
  } else {
    const buildings = night ? '#25394b' : '#5c7971';
    for (let i = 0; i < 4; i++) {
      const x = i * 120;
      a.rect(x + 15, 203, 90, 67, buildings);
      a.rect(x + 15, 202, 90, 3, wall[1]);
      for (let k = 0; k < 5; k++) {
        a.rect(x + 21 + k * 16, 206, 3, 44, metal[3]);
        a.rect(x + 21 + k * 16, 206, 1, 42, wall[2]);
      }
    }
  }
  a.box(0, 231, TILE_WIDTH, 7, metal);
  a.rect(0, 238, TILE_WIDTH, 32, wall[3]);
  a.line(0, 241, TILE_WIDTH, wall[2]);
}

const TILE_PAINTERS = [boilerTile, officeTile, roofTile];

function buildTile(a, s, night) {
  const canvas = a.canvas.ownerDocument.createElement('canvas');
  canvas.width = TILE_WIDTH;
  canvas.height = TILE_HEIGHT;
  const art = new a.constructor(canvas);
  TILE_PAINTERS[s.floor](art, s, night);
  return canvas;
}

function paintTile(a, tile, x, y, alpha = 1) {
  const c = a.c;
  c.globalAlpha = alpha;
  c.drawImage(tile, x, y);
  if (x < 0) c.drawImage(tile, x + TILE_WIDTH, y);
  if (y < -24) {
    c.drawImage(tile, x, y + TILE_HEIGHT);
    if (x < 0) c.drawImage(tile, x + TILE_WIDTH, y + TILE_HEIGHT);
  }
  c.globalAlpha = 1;
}

export function sceneryBackdrop(a, s) {
  if (!a.canvas.ownerDocument) {
    // Offline composition fixtures have a native Canvas with no owner document.
    TILE_PAINTERS[s.floor](a, s, s.night);
    return;
  }
  const name = s.sectorData.id;
  if (a.scenery?.name !== name) a.scenery = { name, day: buildTile(a, s, false), night: buildTile(a, s, true) };
  const x = Math.round(-a.cam * .19) % TILE_WIDTH;
  const y = ((Math.round(-(s.cameraY || 0) * .12) % TILE_HEIGHT) + TILE_HEIGHT) % TILE_HEIGHT - TILE_HEIGHT;
  const openRoof = s.floor === 2 && s.sector >= 3;
  const top = openRoof || y === -TILE_HEIGHT ? 0 : y;
  const mix = a.n;
  if (mix < .995) paintTile(a, a.scenery.day, x, top);
  if (mix > .005) paintTile(a, a.scenery.night, x, top, mix > .995 ? 1 : mix);

  if (openRoof) {
    const clouds = s.night ? ['#617582', '#6b7e88', '#526b7b'] : ['#c9ccaf', '#d6d4b2', '#b2beab'];
    for (let i = 0; i < 3; i++) {
      const cx = (i * 189 + a.t * (2 + i) - a.cam * .07 + 540) % 570 - 60;
      const cy = 34 + i * 25;
      a.rect(cx + 12, cy, 31 + i * 5, 3, clouds[1]);
      a.rect(cx + 5, cy + 3, 52 + i * 7, 4, clouds[0]);
      a.rect(cx + 18, cy + 7, 41 + i * 4, 2, clouds[2]);
    }
  }
  if (s.reducedEffects) return;

  // These silhouettes live behind the platforms and keep the playfield clear.
  const c = a.c;
  c.save();
  if (openRoof && mix > .12) {
    const wind = Math.sin(a.t * .61);
    c.globalAlpha = mix * .44;
    for (let i = 0; i < 21; i++) {
      const time = a.t * (86 + i % 4 * 11) + i * 71;
      const y = time % 202 - 12;
      const x = Math.floor(((i * 73 - a.cam * .12 + 2 * y + y * wind * .26) % 510 + 510) % 510) - 14;
      a.rect(x, y, 2, 2, '#7394a4');
      a.rect(x + 1, y + 2, 2, 3, '#4a6e80');
    }
  } else if (s.floor === 0) {
    const warm = mix < .65;
    for (let i = 0; i < 4; i++) {
      const vent = (i * 139 + 520 - ((a.cam * .31) % 550)) % 550 - 36;
      for (let puff = 0; puff < 3; puff++) {
        const age = (a.t * .27 + i * .21 + puff / 3) % 1;
        const px = vent + Math.floor(age * age * 26), py = 188 - Math.floor(52 * age);
        const w = 4 + Math.floor(age * 17);
        c.globalAlpha = Math.sin(age * Math.PI) * (warm ? .24 : .17);
        a.rect(px, py, w, 4, warm ? '#a99875' : '#6a8c99');
        a.rect(px + 3, py - 3, w - 3, 3, warm ? '#c9bd9d' : '#8babb0');
      }
    }
  }
  c.restore();
}

export function sceneryCanopy(a, s) {
  const { metal } = [MATERIALS.boiler, MATERIALS.office, MATERIALS.roof][s.floor][+s.night];
  const x = -(Math.round(a.cam * 1.1) % 117);
  for (let i = 0; i < 5; i++) {
    const left = x + i * 117;
    a.rect(left, 0, 70, 5, metal[3]);
    a.line(left, 0, 66, metal[2]);
    if (s.floor === 0) {
      const bend = 4 + Math.sin(a.t * .8 + i) * 2;
      a.rect(left + 52, 3, 3, bend, metal[3]);
      a.rect(left + 50, 5 + bend, 8, 3, metal[3]);
    } else if (s.floor === 2 && s.sector >= 3) {
      a.rect(left + 5, 4, 5, 5, metal[2]);
    } else if (s.floor === 1 && i % 2 === 1) {
      const bulb = left + 34;
      a.rect(bulb - 1, 0, 2, 15, metal[3]);
      a.box(bulb - 12, 13, 24, 7, metal);
      a.rect(bulb - 9, 17, 17, 2, s.night ? '#c9aa78' : metal[0]);
      if (a.n > .02) {
        const c = a.c;
        c.save();
        c.globalCompositeOperation = 'lighter';
        const light = c.createLinearGradient(bulb, 19, bulb, 145);
        const gain = s.reducedEffects ? .07 : .065 + Math.sin(a.t * 2.1 + i) * .014;
        light.addColorStop(0, '#d4b982');
        light.addColorStop(1, '#d4b98200');
        c.globalAlpha = gain * a.n;
        c.fillStyle = light;
        c.beginPath();
        c.moveTo(bulb - 9, 19);c.lineTo(bulb + 8, 19);
        c.lineTo(bulb + 56, 150);c.lineTo(bulb - 42, 150);
        c.closePath();c.fill();
        c.restore();
        a.glow(bulb, 23, 27, 22, '#e0ba7f', gain * a.n * .9);
      }
    }
  }
}
