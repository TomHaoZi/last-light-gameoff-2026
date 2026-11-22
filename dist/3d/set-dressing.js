import {
  BufferGeometry, CanvasTexture, Float32BufferAttribute, Mesh, MeshBasicMaterial, SRGBColorSpace
} from 'three';

const CELL = [384, 144];
const SETS = [
  {
    ink: '#e6c58e', board: '#29302c', edge: '#9d784c', tag: 'B2',
    signs: [
      { tile: [7, 13], face: [0, 1], title: 'SHIFT HANDOVER', detail: 'LOG PRESSURE BEFORE LEAVING', mark: 'B-17' },
      { tile: [9, 6], face: [-1, 0], title: 'LOW PRESSURE', detail: 'ISOLATE BEFORE SERVICING', mark: '01' },
      { tile: [17, 9], face: [-1, 0], title: 'COOLING LOOP', detail: 'MANUAL CONTROL OPEN', mark: '02' },
      { tile: [18, 0], face: [0, 1], title: 'FIRE INTERLOCK', detail: 'OVERRIDE INSIDE THE DOOR', mark: '03' },
    ]
  },
  {
    ink: '#e0d8bd', board: '#35423d', edge: '#857f67', tag: 'F4',
    signs: [
      { tile: [7, 14], face: [1, 0], title: 'TIME & ATTENDANCE', detail: 'RETURN KEYS TO THE RECORDS DESK', mark: '401' },
      { tile: [14, 11], face: [-1, 0], title: 'PERSONNEL INDEX', detail: 'FILES ARRANGED BY SURNAME', mark: '402' },
      { tile: [11, 0], face: [0, 1], title: 'PUBLIC REGISTER', detail: 'EMERGENCY ROLL CALL', mark: '403' },
      { tile: [23, 8], face: [-1, 0], title: 'GARY / RECORDS', detail: 'EVENING HANDOVER', mark: '409' },
      { tile: [5, 12], face: [-1, 0], title: 'STAFF ROOM', detail: 'PLEASE CLEAR THE TABLE', mark: '405' },
    ]
  },
  {
    ink: '#d9dbc9', board: '#354344', edge: '#7b8e86', tag: 'R3',
    signs: [
      { tile: [9, 7], face: [1, 0], title: 'ROOF GARDEN', detail: 'IRRIGATION / FIRST BED', mark: 'A' },
      { tile: [2, 6], face: [1, 0], title: 'WEST BEDS', detail: 'WATER VALVE BELOW', mark: 'B' },
      { tile: [21, 8], face: [-1, 0], title: 'TANK FEED', detail: 'KEEP OVERFLOW CLEAR', mark: 'C' },
    ]
  }
];

function printSign(ctx, w, h, set, sign) {
  ctx.fillStyle = set.board;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = set.edge;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = set.ink;
  ctx.font = '700 31px sans-serif';
  ctx.fillText(sign.title, 26, 80, w - 50);
  ctx.font = '700 14px monospace';
  ctx.fillText(set.tag + ' / ' + sign.mark, 27, 40, w - 50);
  ctx.font = '15px monospace';
  ctx.fillText(sign.detail, 27, 112, w - 52);
  ctx.beginPath();
  for (const x of [19, w - 19]) for (const y of [19, h - 19]) {
    ctx.moveTo(x + 2, y);
    ctx.arc(x, y, 2, 0, Math.PI * 2);
  }
  ctx.fill();
  // Missing ink sits along the pressed edge and around the two lower fasteners.
  ctx.globalAlpha = .55;
  ctx.fillStyle = set.board;
  for (const [x, y, width] of [[39, 8, 14], [266, 6, 43], [22, 132, 24], [302, 134, 47], [359, 123, 8]]) {
    ctx.fillRect(x, y, width, 4);
  }
  ctx.globalAlpha = 1;
}

/** One small atlas and one mesh per floor. No decal is placed on a phase-dependent surface. */
export function mountWallSigns(visual, tileSize) {
  const { decoded, stage, theme, localTextures } = visual;
  const set = SETS[theme];
  const [w, h] = CELL;
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * Math.ceil(set.signs.length / 2);
  const ctx = canvas.getContext('2d');
  const positions = [];
  const uv = [];
  const triangulation = [0, 1, 2, 0, 2, 3];
  for (const [index, sign] of set.signs.entries()) {
    const [col, row] = sign.tile;
    const [dx, dz] = sign.face;
    const support = decoded.get(col, row);
    const front = decoded.get(col + dx, row + dz);
    if (support?.kind !== '#' || !front || ['#', 'd', 'n'].includes(front.kind)) continue;
    const left = (index % 2) * w;
    const top = Math.floor(index / 2) * h;
    ctx.save();
    ctx.translate(left, top);
    printSign(ctx, w, h, set, sign);
    ctx.restore();

    const outset = tileSize * .5 + .165;
    const width = theme === 2 ? 1.58 : 1.73;
    const height = width * h / w;
    const center = theme === 2 ? .88 : 2.16;
    const corners = [
      [-width / 2, -height / 2, left + 1, top + h - 1],
      [width / 2, -height / 2, left + w - 1, top + h - 1],
      [width / 2, height / 2, left + w - 1, top + 1],
      [-width / 2, height / 2, left + 1, top + 1]
    ];
    for (const corner of triangulation) {
      const [x, y, u, v] = corners[corner];
      positions.push(support.x + dx * outset + dz * x, center + y, support.z + dz * outset - dx * x);
      uv.push(u / canvas.width, 1 - v / canvas.height);
    }
  }
  if (!positions.length) return;
  const atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.anisotropy = Math.min(4, visual.renderer.capabilities.getMaxAnisotropy());
  localTextures.push(atlas);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const signs = new Mesh(geometry, new MeshBasicMaterial({ map: atlas, color: '#b2a992' }));
  signs.name = 'Hand printed wall signs';
  signs.matrixAutoUpdate = false;
  stage.add(signs);
}
