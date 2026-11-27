import * as THREE from 'three';

// Authored, meter-scale set pieces. A kit merges the static pieces by material
// so a gauge bank or a picket of louvers doesn't add a draw call per screw.
const box = new THREE.BoxGeometry();
const disc = new THREE.PlaneGeometry();
const cylinder = new THREE.CylinderGeometry(.5, .5, 1, 32);
const bolt = new THREE.CylinderGeometry(.5, .5, 1, 6);
const sphere = new THREE.SphereGeometry(.5, 24, 14);
const upright = new THREE.Vector3(0, 1, 0);
const face = new THREE.Euler(Math.PI / 2, 0, 0);
const fixtureColor = {
  enamel: '#62574b', oxidized: '#476062', brass: '#a3804e', steel: '#adb7b5',
  polymer: '#252a27', rubber: '#202521', paint: '#756451', red: '#8e482f',
  wood: '#73513c', soil: '#312e27', paper: '#d4c6a5', graphite: '#5c625d'
};

function material(color, roughness, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function makeMaterials(visual) {
  const paint = {
    enamel: material(fixtureColor.enamel, .67, .18),
    oxidized: material(fixtureColor.oxidized, .51, .27),
    brass: material(fixtureColor.brass, .32, .48),
    steel: material(fixtureColor.steel, .32, .55),
    polymer: material(fixtureColor.polymer, .71),
    rubber: material(fixtureColor.rubber, .93),
    paint: material(fixtureColor.paint, .6, .1),
    red: material(fixtureColor.red, .49, .21),
    wood: material(fixtureColor.wood, .63),
    soil: material(fixtureColor.soil, .99),
    paper: material(fixtureColor.paper, .88),
    graphite: material(fixtureColor.graphite, .61, .26),
    leaf: [material('#354936', .65), material('#576142', .74), material('#758153', .72), material('#443f31', .78)]
  };
  const metal = visual.materials.steel;
  if (metal.normalMap) {
    for (const finish of [paint.enamel, paint.oxidized, paint.steel, paint.paint, paint.red]) {
      finish.normalMap = metal.normalMap;
      finish.normalScale.copy(metal.normalScale).multiplyScalar(.46);
      finish.roughnessMap = metal.roughnessMap;
    }
  }
  return paint;
}

function laminate(visual) {
  const image = document.createElement('canvas');
  image.width = image.height = 256;
  const ctx = image.getContext('2d');
  const pixels = ctx.createImageData(image.width, image.height);
  for (let row = 0; row < image.height; row++) {
    for (let col = 0; col < image.width; col++) {
      const grain = row + 5 * Math.sin(col * .024 + row * .08);
      const ring = Math.abs(Math.sin(grain * .32 + Math.sin(col * .032)));
      const rings = Math.pow(ring, 12) * .11;
      const blotch = .07 * Math.sin(Math.hypot((col - 148) * .12, (row - 84) * .4));
      const patina = .9 + .065 * Math.sin(grain * 2.92) + blotch - rings;
      const at = (row * image.width + col) * 4;
      pixels.data.set([245 * patina, 223 * patina, 201 * patina, 255], at);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  visual.localTextures.push(texture);
  return texture;
}

function copyGeometry(entries) {
  let vertices = 0;
  let indices = 0;
  for (const { geometry } of entries) {
    vertices += geometry.attributes.position.count;
    indices += geometry.index?.count ?? geometry.attributes.position.count;
  }
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  const point = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const { geometry, matrix } of entries) {
    const attrs = geometry.attributes;
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < attrs.position.count; i++) {
      const target = vertexOffset + i;
      point.fromBufferAttribute(attrs.position, i).applyMatrix4(matrix).toArray(position, target * 3);
      point.fromBufferAttribute(attrs.normal, i).applyNormalMatrix(normalMatrix).toArray(normal, target * 3);
      uv[target * 2] = attrs.uv.getX(i);
      uv[target * 2 + 1] = attrs.uv.getY(i);
    }
    const count = geometry.index?.count ?? attrs.position.count;
    for (let i = 0; i < count; i++) {
      index[indexOffset++] = vertexOffset + (geometry.index?.getX(i) ?? i);
    }
    vertexOffset += attrs.position.count;
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(position, 3));
  result.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  result.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  result.setIndex(new THREE.BufferAttribute(index, 1));
  return result;
}

class Kit {
  constructor(visual, name, x, z, yaw = 0) {
    this.visual = visual;
    this.group = new THREE.Group();
    this.group.name = name;
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    visual.stage.add(this.group);
    this.materials = makeMaterials(visual);
    this.batches = new Map();
    this.temp = new Set();
  }

  part(geometry, material, x, y, z, width = 1, height = 1, depth = 1, angles) {
    const transform = new THREE.Object3D();
    transform.position.set(x, y, z);
    transform.scale.set(width, height, depth);
    if (angles) transform.rotation.copy(angles);
    transform.updateMatrix();
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push({ geometry, matrix: transform.matrix });
  }

  rect(mat, x, y, z, w, h, d, r = 0, angle = 0) {
    const rotation = new THREE.Euler(0, 0, angle);
    if (!r) return this.part(box, mat, x, y, z, w, h, d, rotation);
    const bevel = Math.min(r, w * .2, h * .2, d * .24);
    const shape = new THREE.Shape();
    const a = w / 2 - bevel;
    const b = h / 2 - bevel;
    shape.moveTo(-a, -b);
    shape.lineTo(a, -b);
    shape.lineTo(a, b);
    shape.lineTo(-a, b);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - 2 * bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3,
      steps: 1, curveSegments: 1
    });
    this.temp.add(geometry);
    geometry.translate(0, 0, -d / 2 + bevel);
    return this.part(geometry, mat, x, y, z, 1, 1, 1, rotation);
  }

  round(mat, x, y, z, diameter, depth, orientation = face, hex = false) {
    this.part(hex ? bolt : cylinder, mat, x, y, z, diameter, depth, diameter, orientation);
  }

  tube(mat, points, radius, radialSegments = 8) {
    const vectors = points.map(p => new THREE.Vector3(...p));
    if (vectors.length === 2) {
      const direction = vectors[1].clone().sub(vectors[0]);
      const length = direction.length();
      const center = vectors[0].lerp(vectors[1], .5);
      const adjustment = new THREE.Quaternion().setFromUnitVectors(upright, direction.normalize());
      this.part(cylinder, mat, ...center, radius * 2, length, radius * 2, new THREE.Euler().setFromQuaternion(adjustment));
      return;
    }
    const curve = new THREE.CatmullRomCurve3(vectors);
    const geometry = new THREE.TubeGeometry(curve, points.length * 5, radius, radialSegments);
    this.temp.add(geometry);
    this.part(geometry, mat, 0, 0, 0);
  }

  ring(mat, x, y, z, radius, thickness, rotation = undefined) {
    const geometry = new THREE.TorusGeometry(radius, thickness, 10, 48);
    this.temp.add(geometry);
    this.part(geometry, mat, x, y, z, 1, 1, 1, rotation);
  }

  label(x, y, z, w, h, paint, rotate) {
    const image = document.createElement('canvas');
    image.width = 384;
    image.height = Math.max(64, Math.round(384 * h / w));
    paint(image.getContext('2d'), image.width, image.height);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const appearance = new THREE.MeshStandardMaterial({ map: texture, roughness: .8, alphaTest: .4, polygonOffset: true, polygonOffsetFactor: -1 });
    const surface = new THREE.Mesh(disc.clone(), appearance);
    surface.position.set(x, y, z);
    surface.scale.set(w, h, 1);
    if (rotate) surface.rotation.copy(rotate);
    this.group.add(surface);
    this.visual.localTextures.push(texture);
  }

  stamp(x, y, z, w, h, heading, detail) {
    const { steel, graphite } = this.materials;
    this.rect(graphite, x, y, z, w + .035, h + .035, .019, .009);
    this.label(x, y, z + .011, w, h, (ctx, sw, sh) => {
      ctx.fillStyle = '#2f3530';
      ctx.fillRect(0, 0, sw, sh);
      ctx.strokeStyle = '#8d8170';
      ctx.lineWidth = 4;
      ctx.strokeRect(7, 7, sw - 14, sh - 14);
      ctx.fillStyle = '#e1d4b7';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(heading, 24, detail ? sh * .51 : sh * .69, sw - 48);
      if (detail) {
        ctx.font = '19px monospace';
        ctx.fillText(detail, 24, sh * .80, sw - 48);
      }
    });
    for (const edge of [-1, 1]) this.round(steel, x + edge * w * .47, y, z + .014, .025, .006, face, true);
  }

  light(x, y, z, strength, scale = .64) {
    this.group.updateMatrixWorld(true);
    const p = this.group.localToWorld(new THREE.Vector3(x, y, z));
    this.visual.lightSource(p.x, p.y, p.z, strength, 'general', scale);
  }

  finish({ castShadow = true } = {}) {
    for (const [appearance, entries] of this.batches.entries()) {
      const object = new THREE.Mesh(copyGeometry(entries), appearance);
      object.castShadow = castShadow;
      object.receiveShadow = true;
      this.group.add(object);
    }
    for (const geometry of this.temp) geometry.dispose();
    this.temp.clear();
    this.batches.clear();
  }
}

function pressureDial(kit, x, y, z, size, number, title) {
  const { graphite, brass, steel, red } = kit.materials;
  kit.round(graphite, x, y, z, size * 1.13, .105);
  kit.ring(brass, x, y, z + .059, size * .49, size * .055);
  kit.label(x, y, z + .056, size * .99, size * .99, (ctx, width) => {
    const center = width / 2;
    const surface = ctx.createRadialGradient(center * .77, center * .71, width * .08, center, center, center);
    surface.addColorStop(0, '#eee4c6');
    surface.addColorStop(.78, '#c5b99b');
    surface.addColorStop(1, '#867d6c');
    ctx.beginPath();
    ctx.arc(center, center, center * .98, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 30; i++) {
      const angle = Math.PI * (.76 + 1.5 * i / 30);
      const inner = center * (i % 5 === 0 ? .73 : .83);
      const outer = center * .92;
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
      ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
      ctx.strokeStyle = i >= 25 ? '#8a3325' : '#443e32';
      ctx.lineWidth = i % 5 === 0 ? 3.4 : 1.7;
      ctx.stroke();
      if (i % 5 === 0) {
        ctx.fillStyle = '#383932';
        ctx.fillText(String(i / 5 * 2), center + Math.cos(angle) * center * .61, center + Math.sin(angle) * center * .61 + 8);
      }
    }
    ctx.font = 'bold 24px monospace';
    ctx.fillText(title, center, center * 1.54);
    ctx.font = '20px monospace';
    ctx.fillText(number, center, center * 1.73);
    const glint = ctx.createLinearGradient(width * .16, 0, width * .8, width);
    glint.addColorStop(0, '#fffbdf00');
    glint.addColorStop(.44, '#fffbdf30');
    glint.addColorStop(.46, '#fffbdf08');
    glint.addColorStop(1, '#fffbdf00');
    ctx.fillStyle = glint;
    ctx.fillRect(0, 0, width, width);
  });
  const angle = number === 'P-19' ? -.51 : 1.02;
  kit.rect(red, x - Math.sin(angle) * size * .158, y + Math.cos(angle) * size * .158,
    z + .061, .016, size * .35, .006, 0, angle);
  kit.round(steel, x, y, z + .072, size * .12, .022);
}

function fasten(kit, x, y, z, width, height, size = .05) {
  const { steel, graphite } = kit.materials;
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const cornerX = x + side * width * .5;
      const cornerY = y + end * height * .5;
      kit.round(graphite, cornerX, cornerY, z, size * 1.24, .009);
      kit.round(steel, cornerX, cornerY, z + .013, size, .023, face, true);
    }
  }
}

function pressureManifold(visual, x, z) {
  const kit = new Kit(visual, 'Pressure regulator PR-19', x, z);
  const { enamel, oxidized, brass, steel, polymer, rubber, paint, red, graphite } = kit.materials;
  kit.rect(graphite, 0, 1.40, .035, 2.51, 1.70, .10, .023);
  kit.rect(oxidized, 0, 1.47, .13, 2.38, 1.56, .17, .032);
  kit.rect(enamel, 0, 1.47, .217, 2.21, 1.43, .053, .011);
  fasten(kit, 0, 1.47, .254, 2.20, 1.36);
  kit.stamp(0, 2.03, .255, 1.07, .235, 'PR-19  MANIFOLD', 'B2 / BOILER PRESSURE');
  for (const side of [-1, 1]) {
    const dx = side * .64;
    const out = side * 1.01;
    kit.rect(graphite, dx, .32, .34, .39, .56, .48, .025);
    kit.rect(steel, dx, .055, .38, .66, .08, .64, .013);
    kit.tube(oxidized, [[dx, .34, .45], [dx, .61, .45], [out, .84, .44], [out, 1.10, .41]], .085, 16);
    kit.tube(brass, [[dx, 1.87, .31], [dx, 2.20, .32], [dx + side * .2, 2.43, .107]], .055, 14);
    kit.round(steel, dx, 2.25, .23, .176, .07, new THREE.Euler(), true);
    kit.round(red, dx, .66, .44, .243, .068, new THREE.Euler(), true);
    kit.round(polymer, out, .97, .312, .30, .17);
    kit.ring(red, out, .97, .425, .156, .026);
    for (let spoke = 0; spoke < 5; spoke++) {
      const a = spoke * Math.PI * .4;
      kit.rect(red, out - Math.sin(a) * .084, .97 + Math.cos(a) * .084, .425, .025, .135, .027, .004, a);
    }
    kit.round(brass, out, .97, .447, .094, .042, face, true);
    pressureDial(kit, dx, 1.54, .292, .53, side < 0 ? 'P-19' : 'P-20', side < 0 ? 'INLET' : 'RETURN');
  }
  kit.tube(steel, [[-.88, .79, .40], [.88, .79, .40]], .094, 14);
  kit.tube(rubber, [[-.26, .77, .254], [-.21, .44, .367], [.17, .43, .396], [.29, .76, .251]], .023);
  for (const [i, dx] of [-.16, 0, .16].entries()) {
    kit.round(graphite, dx, 1.18, .263, .11, .031);
    kit.round(i === 1 ? red : paint, dx, 1.18, .284, .068, .028);
  }
  const lamp = visual.materials.lamp;
  kit.rect(steel, -.82, 2.25, .29, .47, .08, .27, .015);
  kit.rect(lamp, -.82, 2.209, .29, .35, .024, .18, .004);
  kit.light(-.73, 2.19, .55, 12, .42);
  kit.finish();
}

function servicePortal(visual, x, z) {
  const kit = new Kit(visual, 'B2 riveted service portal', x, z);
  const { steel, oxidized, graphite, brass, rubber, red } = kit.materials;
  kit.rect(graphite, 0, 3.12, 0, 4.87, .20, .25, .015);
  kit.rect(oxidized, 0, 3.01, .105, 4.87, .135, .075, .012);
  for (const side of [-1, 1]) {
    const end = side * 2.397;
    kit.rect(graphite, end, 1.54, .06, .19, 3.08, .25, .022);
    kit.rect(oxidized, end, 1.44, .19, .125, 2.82, .052, .010);
    kit.rect(steel, end, .096, .186, .175, .185, .066, .008);
    kit.rect(steel, end, 2.89, .193, .18, .26, .062, .008);
    for (const y of [.055, .134, 2.79, 2.98]) kit.round(brass, end, y, .234, .048, .019, face, true);
  }
  kit.stamp(-.46, 3.000, .16, 1.0, .124, 'B2   /   SERVICE');
  kit.tube(oxidized, [[2.37, 2.14, .21], [2.37, 2.66, .21], [2.24, 2.87, .21], [1.98, 2.90, .21],
    [1.21, 2.90, .21], [.99, 2.94, .21], [.86, 3.22, .21]], .048, 16);
  kit.tube(rubber, [[2.38, 2.00, .24], [2.36, 2.54, .29], [2.30, 2.77, .28], [1.97, 2.81, .26],
    [1.07, 2.84, .29], [.97, 3.22, .29]], .023);
  for (const pipeX of [1.29, 1.88]) {
    kit.rect(steel, pipeX, 2.914, .18, .061, .217, .096, .009);
    kit.round(red, pipeX, 2.985, .234, .034, .015, face, true);
  }
  kit.finish();
}

function coolingBank(visual, x, z) {
  const kit = new Kit(visual, 'Cooling return A and B', x, z);
  const { graphite, oxidized, steel, brass, red } = kit.materials;
  kit.rect(graphite, 0, 1.11, .11, 1.81, 1.88, .18, .035);
  kit.rect(oxidized, 0, 1.15, .25, 1.68, 1.75, .19, .027);
  kit.rect(steel, 0, .35, .35, 1.47, .13, .21, .021);
  kit.stamp(0, 1.82, .373, 1.37, .19, 'RETURN MANIFOLD', 'LOW PRESSURE · KEEP CLEAR');
  fasten(kit, 0, 1.16, .365, 1.52, 1.61, .044);
  for (const side of [-1, 1]) {
    const x = side * .47;
    kit.tube(brass, [[x, .30, .43], [x, .76, .43], [x, 1.42, .43], [x, 1.62, .38],
      [x, 1.67, .18], [x, 2.36, .18]], .058, 10);
    kit.round(steel, x, 1.04, .45, .22, .101);
    kit.ring(red, x, 1.04, .518, .133, .018);
    kit.rect(red, x, 1.04, .512, .258, .025, .029, .004, side * .53);
    kit.round(brass, x, 1.04, .54, .062, .02, face, true);
    kit.rect(graphite, x, .57, .38, .095, .061, .15, .011);
  }
  kit.finish({ castShadow: false });
}

function archiveCeiling(visual, x, z) {
  const kit = new Kit(visual, 'F4 suspended fixtures and cable tray', x, z);
  const { steel, graphite, oxidized, paint, rubber, brass } = kit.materials;
  for (const distance of [0, -4.8]) {
    kit.rect(graphite, 0, 3.183, distance, 5.66, .111, .33, .019);
    kit.rect(oxidized, 0, 3.111, distance, 5.48, .058, .255, .009);
    for (const side of [-1, 1]) {
      const dx = side * 1.78;
      kit.rect(steel, dx, 3.133, distance, .151, .28, .057, .006);
      kit.rect(paint, dx, 2.953, distance, 1.53, .129, .38, .021);
      kit.rect(graphite, dx, 2.880, distance, 1.44, .026, .277, .006);
      kit.rect(visual.materials.lamp, dx, 2.86, distance + .05, 1.29, .020, .063, .003);
      kit.rect(visual.materials.lamp, dx, 2.86, distance - .05, 1.29, .020, .063, .003);
      for (const end of [-1, 1]) {
        const terminal = dx + end * .69;
        kit.round(steel, terminal, 2.933, distance + .193, .05, .019, face, true);
        kit.rect(graphite, terminal, 2.878, distance, .06, .024, .27, .004);
      }
      kit.light(dx, 2.801, distance, 9, .43);
    }
    kit.tube(rubber, [[-2.66, 3.21, distance + .15], [-1.38, 3.18, distance + .14],
      [-.50, 3.21, distance + .13], [.05, 3.17, distance + .15], [2.62, 3.18, distance + .15]], .025);
    for (const cableX of [-.9, 0, .9]) kit.rect(brass, cableX, 3.19, distance + .137, .046, .10, .058, .006);
  }
  kit.finish();
}

function deskRegister(visual, x, z) {
  const kit = new Kit(visual, 'F4 records desk', x, z);
  const { wood, steel, graphite, brass, paint, polymer, paper, red, enamel } = kit.materials;
  wood.map = laminate(visual);
  kit.rect(graphite, 0, .075, .06, 1.99, .13, .75, .019);
  kit.rect(wood, 0, .49, .06, 1.92, .77, .74, .055);
  kit.rect(wood, 0, .95, .07, 2.21, .12, .88, .026);
  kit.rect(graphite, 0, .908, .09, 2.18, .033, .89, .005);
  for (const side of [-1, 1]) {
    kit.rect(steel, side * .9, .43, .443, .108, .67, .062, .012);
    kit.rect(graphite, side * .81, .42, .446, .055, .64, .034, .005);
  }
  for (let row = 0; row < 3; row++) {
    const y = .27 + row * .20;
    kit.rect(wood, -.48, y, .446, .53, .175, .041, .009);
    kit.rect(graphite, -.48, y + .014, .476, .21, .039, .047, .009);
    kit.rect(steel, -.48, y + .020, .500, .15, .017, .024, .003);
  }
  kit.stamp(.42, .67, .451, .52, .152, 'F4 · RECORDS', 'DAY STAFF');
  kit.rect(graphite, -.63, 1.04, -.05, .64, .08, .38, .014);
  kit.rect(enamel, -.63, 1.34, -.03, .71, .51, .42, .056);
  kit.rect(polymer, -.63, 1.34, .188, .60, .398, .044, .009);
  kit.rect(graphite, -.63, 1.356, .212, .51, .331, .011, .002);
  const glass = material('#687b6e', .21, .16);
  kit.rect(glass, -.63, 1.356, .219, .484, .300, .028, .006);
  kit.label(-.63, 1.356, .235, .453, .275, (ctx, w, h) => {
    const shade = ctx.createLinearGradient(0, 0, w, h);
    shade.addColorStop(0, '#324238');
    shade.addColorStop(.42, '#202c24');
    shade.addColorStop(1, '#111b16');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#66847229';
    for (let row = 0; row < h; row += 8) { ctx.beginPath(); ctx.moveTo(0, row); ctx.lineTo(w, row); ctx.stroke(); }
    ctx.fillStyle = '#acba91';
    ctx.font = '24px monospace';
    ctx.fillText('F4  /  RECORDS', 23, 48);
    ctx.font = '16px monospace';
    ctx.fillText('LAST SYNC   17:59', 23, 91);
    ctx.fillText('> REGISTER PENDING_', 23, 120);
  });
  kit.round(visual.materials.safe, -.80, 1.11, .192, .022, .012);
  kit.rect(enamel, -.57, 1.025, .29, .64, .044, .175, .010);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      kit.rect(col === 0 ? paint : polymer, -.83 + col * .047, 1.050, .24 + row * .041, .040, .012, .032, .002);
    }
  }
  kit.tube(polymer, [[-.25, 1.04, .25], [-.17, 1.05, .17], [-.21, 1.06, .05], [-.34, 1.084, -.14]], .012);
  kit.rect(graphite, .57, 1.039, .13, .51, .056, .46, .012);
  kit.rect(red, .57, 1.07, .13, .49, .034, .44, .007);
  for (let i = 0; i < 4; i++) {
    kit.rect(paper, .57 + Math.sin(i * 2.7) * .029, 1.085 + i * .014, .13 - .007 * i, .441, .014, .406);
  }
  kit.label(.57, 1.131, .143, .388, .355, (ctx, w, h) => {
    ctx.fillStyle = '#d8cfb7';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#575347';
    ctx.font = 'bold 28px serif';
    ctx.fillText('DAILY REGISTER', 29, 50);
    ctx.strokeStyle = '#747363';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(29, 88 + i * 20); ctx.lineTo(w - 29, 88 + i * 20); ctx.stroke();
      if (i > 1) continue;
      ctx.font = '19px serif';
      ctx.fillText(i === 0 ? 'Eli | Clocked in' : 'Gary |', 32, 102 + i * 20);
    }
  }, new THREE.Euler(-Math.PI / 2, 0, .11));
  kit.rect(graphite, .66, 1.144, .245, .16, .009, .014, .001, -.12);
  kit.rect(brass, .74, 1.145, .234, .028, .012, .016);
  kit.round(steel, .95, 1.025, -.24, .255, .065, new THREE.Euler());
  kit.tube(graphite, [[.95, 1.04, -.24], [.95, 1.33, -.24], [.94, 1.73, -.21], [.85, 1.79, -.11], [.79, 1.67, -.054]], .027);
  kit.round(paint, .78, 1.65, -.07, .245, .112, new THREE.Euler(.29, 0, .36));
  kit.round(visual.materials.lamp, .81, 1.591, -.086, .181, .014, new THREE.Euler(.29, 0, .36));
  kit.light(.70, 1.54, .092, 8, .31);
  kit.finish();
}

function filingCabinet(visual, x, z) {
  const kit = new Kit(visual, 'Personnel drawers', x, z, Math.PI);
  const { graphite, steel, paint, brass } = kit.materials;
  kit.rect(graphite, 0, .925, .034, 1.29, 1.81, .48, .038);
  kit.rect(paint, 0, .98, .073, 1.27, 1.66, .48, .025);
  for (const column of [-.31, .31]) {
    for (let row = 0; row < 5; row++) {
      const y = .36 + row * .29;
      kit.rect(graphite, column, y, .329, .58, .244, .047, .009);
      kit.rect(paint, column, y, .351, .55, .22, .031, .007);
      kit.rect(steel, column, y - .021, .382, .20, .024, .047, .006);
      kit.rect(brass, column, y + .059, .371, .118, .044, .012, .003);
    }
  }
  kit.stamp(0, 1.68, .367, .70, .12, 'F4   1980 – 99');
  kit.finish();
}

function handoverBoard(visual, x, z) {
  const kit = new Kit(visual, 'Public register handover board', x, z);
  const { wood, graphite, steel } = kit.materials;
  kit.rect(graphite, 0, 1.69, .08, 1.94, 1.28, .104, .023);
  kit.rect(wood, 0, 1.70, .132, 1.84, 1.04, .084, .02);
  kit.label(0, 1.70, .18, 1.75, .94, (ctx, w, h) => {
    ctx.fillStyle = '#574735';
    ctx.fillRect(0, 0, w, h);
    const sheets = [
      { x: 36, y: 42, turn: -.065, fill: '#c9bea0', title: 'EVENING SHIFT', rule: 5 },
      { x: 148, y: 49, turn: .05, fill: '#c7d0bc', title: 'KEY SIGNOUT', rule: 6 },
      { x: 267, y: 43, turn: -.031, fill: '#d2c39a', title: '17:59', rule: 4 }
    ];
    for (const sheet of sheets) {
      ctx.save();
      ctx.translate(sheet.x, sheet.y);
      ctx.rotate(sheet.turn);
      ctx.fillStyle = '#352e25';
      ctx.fillRect(3, 5, 83, 124);
      ctx.fillStyle = sheet.fill;
      ctx.fillRect(0, 0, 83, 124);
      ctx.fillStyle = '#392f23';
      ctx.font = '700 8px monospace';
      ctx.fillText(sheet.title, 8, 26, 70);
      ctx.fillStyle = '#686052';
      for (let row = 0; row < sheet.rule; row++) ctx.fillRect(8, 37 + row * 11, 62 - row % 3 * 6, 2);
      ctx.fillStyle = '#644333';
      ctx.beginPath();
      ctx.arc(41, 11, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  kit.rect(steel, 0, 2.22, .18, 1.71, .053, .10, .009);
  kit.finish({ castShadow: false });
}

function bentBlade() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    .052, -.032, .023, .099, .086, .023, .289, .112, -.037,
    .337, .006, -.072, .223, -.102, -.01, .108, -.076, .028
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

function rooftopIntake(visual, x, z) {
  const kit = new Kit(visual, 'Rooftop exhaust HVAC-03', x, z);
  const { graphite, oxidized, steel, paint, brass, rubber, enamel } = kit.materials;
  kit.rect(graphite, 0, .126, 0, 2.49, .25, .89, .026);
  kit.rect(oxidized, 0, .722, 0, 2.34, 1.17, .84, .060);
  kit.rect(enamel, 0, .770, .423, 2.21, 1.05, .092, .018);
  kit.rect(steel, 0, 1.304, 0, 2.41, .105, .92, .023);
  kit.rect(oxidized, 0, 1.357, -.005, 2.39, .035, .88, .008);
  fasten(kit, 0, .766, .479, 2.04, .91, .05);
  kit.rect(graphite, -.52, .78, .472, .99, .87, .056, .011);
  kit.round(rubber, -.52, .785, .505, .784, .043);
  kit.ring(steel, -.52, .785, .553, .385, .035);
  const rotor = new THREE.Group();
  rotor.position.set(-.52, .785, .555);
  kit.group.add(rotor);
  const blade = bentBlade();
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: '#7c8580', roughness: .44, metalness: .38, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const tip = new THREE.Mesh(blade, bladeMaterial);
    tip.rotation.z = i * Math.PI * 2 / 7;
    tip.castShadow = true;
    tip.receiveShadow = true;
    rotor.add(tip);
  }
  const hub = new THREE.Mesh(sphere.clone(), brass);
  hub.scale.set(.192, .192, .105);
  rotor.add(hub);
  visual.kinetics.push({ rotor, speed: 10 });
  for (const r of [.116, .198, .280, .36]) kit.ring(graphite, -.52, .785, .611, r, .009);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    kit.rect(graphite, -.52 - Math.sin(angle) * .196, .785 + Math.cos(angle) * .196,
      .61, .016, .364, .014, .003, angle);
  }
  kit.rect(graphite, .55, .83, .474, .84, .68, .054, .014);
  for (let row = 0; row < 11; row++) {
    kit.part(box, oxidized, .55, .549 + row * .054, .523, .76, .032, .079, new THREE.Euler(-.43, 0, 0));
  }
  kit.stamp(.55, .42, .503, .55, .109, 'HVAC–03');
  kit.tube(brass, [[1.13, .39, -.15], [1.23, .39, -.15], [1.37, .33, -.209], [1.37, .16, -.33], [1.16, .082, -.43]], .027);
  kit.round(steel, 1.12, .39, -.15, .101, .058, new THREE.Euler(0, 0, Math.PI / 2), true);
  kit.tube(rubber, [[1.11, .527, -.15], [1.36, .513, -.16], [1.54, .32, -.28], [1.48, .105, -.51]], .025);
  kit.rect(paint, -.66, .168, .465, .63, .046, .021, .005);
  kit.finish();
}

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, .13, .05, .07, .04, .12, .085, .21, .20, .067, .09, .31, -.028,
    0, .40, -.019, -.09, .31, -.025, -.21, .20, .061, -.13, .06, .07
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    .5, 0, .81, .15, .55, .30, 1, .50, .72, .78, .5, 1, .28, .78, 0, .50, .18, .15
  ], 2));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 2, 4, 5, 2, 5, 6, 2, 6, 7, 2, 7, 8, 2, 8, 0]);
  geometry.computeVertexNormals();
  return geometry;
}

function rooftopBed(visual, x, z) {
  const kit = new Kit(visual, 'Rooftop rain-fed herb bed', x, z, -.12);
  const { graphite, wood, soil, brass, steel, leaf } = kit.materials;
  for (const side of [-1, 1]) {
    kit.rect(graphite, .63 * side, .14, 0, .145, .28, .61, .015);
    kit.rect(steel, .82 * side, .355, 0, .068, .19, .63, .009);
  }
  kit.rect(wood, 0, .294, 0, 1.59, .26, .61, .026);
  kit.rect(soil, 0, .418, 0, 1.47, .055, .462, .009);
  for (const side of [-1, 1]) kit.rect(wood, 0, .419, .268 * side, 1.63, .071, .096, .016);
  kit.tube(brass, [[-.82, .26, .289], [-.90, .26, .289], [-.91, .34, .316], [-.74, .427, .31], [.72, .423, .30]], .014);
  kit.stamp(0, .344, .325, .64, .114, 'ROOF   /   BED 01');
  const sprig = leafGeometry();
  kit.temp.add(sprig);
  for (const appearance of leaf) appearance.side = THREE.DoubleSide;
  for (let i = 0; i < 11; i++) {
    const dx = (i - 5) * .125;
    const dz = Math.cos(i * 1.2) * .128;
    const H = .22 + Math.sin(i * 2.87) * .09;
    kit.tube(leaf[1], [[dx, .44, dz], [dx + .017, .53, dz + .018], [dx + .03, .45 + H, dz + .069]], .009);
    for (let j = 0; j < 3; j++) {
      const a = i * 2.4 + j * 2.18;
      const h = H * (.41 + j * .27);
      const s = .46 + Math.cos(i + j * 3) * .17;
      kit.part(sprig, leaf[(i + j) % leaf.length], dx + .03, .437 + h, dz + .051, s, s, s,
        new THREE.Euler(.72 + .37 * Math.sin(a), a, .8 * Math.cos(a)));
    }
  }
  kit.finish();
}

function rooftopIrrigation(visual, x, z) {
  const kit = new Kit(visual, 'Roof irrigation header', x, z, Math.PI / 2);
  const { oxidized, graphite, brass, red, steel } = kit.materials;
  kit.rect(oxidized, 0, .60, .09, 1.36, 1.05, .15, .021);
  kit.rect(graphite, 0, .58, .18, 1.20, .89, .064, .016);
  // Routing follows the planter line, with a second pipe into the roof.
  kit.tube(brass, [[-.82, .28, .24], [-.60, .28, .24], [-.41, .42, .24],
    [-.27, .59, .24], [.32, .59, .24], [.45, .47, .24], [.49, .06, .24]], .035, 10);
  kit.tube(steel, [[-.67, .14, .21], [-.50, .17, .25], [-.23, .18, .255],
    [.33, .17, .25], [.77, .14, .21]], .047, 10);
  for (const side of [-1, 1]) {
    kit.rect(steel, side * .49, .25, .25, .081, .303, .08, .009);
    kit.round(brass, side * .202, .59, .248, .123, .069);
  }
  kit.ring(red, 0, .59, .306, .121, .018);
  kit.rect(red, 0, .59, .303, .227, .021, .025, .004, -.49);
  kit.round(steel, 0, .59, .324, .056, .04, face, true);
  kit.finish({ castShadow: false });
}

export function decorateModels(visual) {
  const { x, z } = visual.decoded.spawn;
  if (visual.theme === 0) {
    pressureManifold(visual, x - 3.96, z - 5.72);
    servicePortal(visual, x + 1.20, z - 5.96);
    const wall = visual.decoded.get(20, 5);
    if (wall?.kind === '#') coolingBank(visual, wall.x, wall.z + 1.23);
  } else if (visual.theme === 1) {
    deskRegister(visual, x - 2.52, z - 4.63);
    archiveCeiling(visual, x - .52, z - 7.40);
    const cabinet = visual.decoded.get(9, 16);
    if (cabinet?.kind === '.') filingCabinet(visual, cabinet.x, cabinet.z + .76);
    const wall = visual.decoded.get(9, 0);
    if (wall?.kind === '#') handoverBoard(visual, wall.x, wall.z + 1.25);
  } else {
    rooftopIntake(visual, x + 4.82, z - 5.13);
    rooftopBed(visual, x - 3.58, z - 4.42);
    const wall = visual.decoded.get(9, 6);
    if (wall?.kind === '#') rooftopIrrigation(visual, wall.x + 1.23, wall.z);
  }
}
