import * as THREE from 'three';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const SIDES = [-1, 1];
const CELL = .0192;
const LOWER = [-.535, -.045, -.225];
const UPPER = [.535, 1.71, .31];
const TETRAHEDRA = [[0, 1, 3, 7], [0, 1, 5, 7], [0, 2, 3, 7], [0, 2, 6, 7], [0, 4, 5, 7], [0, 4, 6, 7]];
const TORSO = [
  [.785, .118, .080, -.010], [.831, .171, .111, -.011], [.917, .184, .124, -.010],
  [1.008, .160, .105, -.011], [1.104, .149, .099, -.006], [1.210, .172, .110, -.004],
  [1.305, .195, .120, -.003], [1.391, .216, .106, -.013], [1.459, .206, .086, -.019],
  [1.501, .155, .074, -.011], [1.533, .083, .055, .002], [1.566, .057, .049, .009],
  [1.626, .052, .048, .010], [1.654, .040, .037, .012]
];
const UNIFORMS = [
  ['#61523e', '#342c25', '#414243', '#3b332c', '#7a7267'],
  ['#4c5859', '#303838', '#424943', '#373a32', '#797068'],
  ['#515b46', '#31362c', '#454a3e', '#373c35', '#787363']
];

const indexHips = 0, indexTorso = 1, indexNeck = 2;
const indexArm = 3, indexLeg = 9;

function smoothUnion(a, b, distance) {
  const blend = Math.max(distance - Math.abs(a - b), 0) / distance;
  return Math.min(a, b) - blend * blend * distance * .25;
}

function segment(ax, ay, az, bx, by, bz, startRadius, endRadius, flatness = 1) {
  // Flatten the cross-section along Z, keeping depth changes aligned with the segment.
  const originZ = az / flatness;
  const dx = bx - ax, dy = by - ay, dz = bz / flatness - originZ;
  const inverseLength = 1 / (dx * dx + dy * dy + dz * dz);
  return (x, y, z) => {
    const p = x - ax, q = y - ay, r = z / flatness - originZ;
    const t = clamp((p * dx + q * dy + r * dz) * inverseLength, 0, 1);
    return Math.hypot(p - dx * t, q - dy * t, r - dz * t) - lerp(startRadius, endRadius, t);
  };
}

function roundedBox(x, y, z, width, height, depth, radius) {
  const dx = Math.abs(x) - width + radius;
  const dy = Math.abs(y) - height + radius;
  const dz = Math.abs(z) - depth + radius;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0))
    + Math.min(Math.max(dx, dy, dz), 0) - radius;
}

function torsoDistance(x, y, z) {
  let upper = 1;
  while (upper < TORSO.length - 1 && y > TORSO[upper][0]) upper++;
  const [min, widthA, depthA, offsetA] = TORSO[upper - 1];
  const [max, widthB, depthB, offsetB] = TORSO[upper];
  const t = clamp((y - min) / (max - min), 0, 1);
  const width = lerp(widthA, widthB, t);
  const depth = lerp(depthA, depthB, t);
  const shoulder = smoothstep(y, 1.29, 1.42) * (1 - smoothstep(y, 1.48, 1.56));
  const forward = z - lerp(offsetA, offsetB, t);
  const side = Math.abs(x);
  const folds = (Math.sin(x * 34 + y * 38) * .0049 +
    Math.sin(y * 53 - side * 21) * .0031) * (1 - smoothstep(y, 1.48, 1.55));
  const collar = Math.exp(-((y - 1.447 - side * .53) ** 2) / .00049) *
    smoothstep(side, .022, .052) * (1 - smoothstep(side, .092, .134));
  const pocketWidth = 1 - smoothstep(Math.abs(side - .106), .028, .052);
  const pocketHeight = smoothstep(y, 1.157, 1.195) * (1 - smoothstep(y, 1.288, 1.313));
  const pocketTop = Math.exp(-((y - (1.286 + x * .065)) ** 2) / .00019);
  const twillRelief = (.004 * shoulder * Math.cos(x * 21) + .007 * collar
    + .006 * pocketWidth * (pocketHeight + .62 * pocketTop)) * smoothstep(z, .017, .081);
  const throat = Math.exp(-((y - 1.586) ** 2) / .0034) * smoothstep(z, .015, .043);
  const tendon = .0027 * throat * Math.cos(x * 108 + (y - 1.62) * 19);
  return Math.max((Math.hypot(x / width, (forward - twillRelief - tendon) / depth) - 1) * Math.min(width, depth) + folds,
    TORSO[0][0] - y, y - TORSO.at(-1)[0]);
}

const shoulderShape = segment(.172, 1.395, -.014, .247, 1.348, -.008, .086, .079, .92);
const upperArm = segment(.228, 1.405, -.015, .315, 1.119, .008, .079, .055, .93);
const forearm = segment(.315, 1.119, .008, .352, .884, .036, .059, .035, .89);
const palm = segment(.355, .879, .036, .374, .807, .055, .039, .041, .62);
const fingerSegments = [-1.5, -.5, .5, 1.5].map((finger, index) => {
  const x = .373 + finger * .014;
  return segment(x, .815, .049, x + .013 + finger * .006, [.748, .729, .724, .744][index], .079,
    .016, .0155, .96);
});
const thumb = segment(.346, .843, .061, .324, .786, .101, .019, .014, .95);
const thigh = segment(.088, .900, -.012, .108, .510, .021, .108, .057, 1.01);
const kneeShape = segment(.107, .528, .020, .109, .475, .007, .057, .055, 1.02);
const calf = segment(.109, .500, .012, .119, .142, -.007, .060, .045, 1.02);
const bootCollar = segment(.119, .218, -.007, .120, .076, -.001, .056, .061, 1.07);

function field(x, y, z, seed) {
  const side = Math.abs(x);
  let distance = torsoDistance(x, y, z);
  if (side > .137 && y > .67) {
    let arm = smoothUnion(shoulderShape(side, y, z), upperArm(side, y, z), .042);
    arm = smoothUnion(arm, forearm(side, y, z), .040);
    if (y < .937) {
      let hand = palm(side, y, z);
      if (y < .853) {
        hand = smoothUnion(hand, thumb(side, y, z), .013);
        for (const finger of fingerSegments) hand = smoothUnion(hand, finger(side, y, z), .009);
      }
      arm = smoothUnion(arm, hand, .020);
    }
    // Draw longitudinal cable-like wrinkles and horizontal cloth folds into the silhouette.
    const wear = Math.sin(y * 69 + z * 34 + seed) * Math.sin(side * 29 - y * 13) * .0024;
    distance = smoothUnion(distance, arm + wear, .053);
  }
  if (side < .28 && y < 1.045) {
    let leg = smoothUnion(thigh(side, y, z), kneeShape(side, y, z), .037);
    leg = smoothUnion(leg, calf(side, y, z), .037);
    if (y < .31) {
      const sole = roundedBox(side - .121, y - .032, z - .066, .069, .032, .137, .024);
      const upper = roundedBox(side - .119, y - .070 - Math.max(0, .07 - z) * .15, z - .058,
        .063, .049, .122, .040);
      const shoe = smoothUnion(smoothUnion(sole, upper, .015), bootCollar(side, y, z), .024);
      leg = smoothUnion(leg, shoe, .026);
    }
    const bunch = Math.sin(y * 72 - z * 18) * Math.sin(side * 44 + y * 16 + seed)
      * (.0018 + .0032 * Math.exp(-((y - .51) ** 2) / .023));
    distance = smoothUnion(distance, leg + bunch, .061);
  }
  return Math.max(distance, -y);
}

function pointColor(color, x, y, z, colors, seed) {
  const [jacket, lining, trousers, boots, skin] = colors;
  const side = Math.abs(x);
  const inArm = smoothstep(side, .235, .30) * smoothstep(y, .69, .89);
  const fabric = smoothstep(y + .006 * Math.sin(x * 98), .893, .934);
  color.copy(trousers).lerp(jacket, Math.max(fabric, inArm));
  const cuff = .896 + .018 * Math.sin(x * 112 + z * 108);
  const hand = smoothstep(side, .304, .341) * (1 - smoothstep(y, cuff - .011, cuff + .008));
  const neckline = 1.529 + side * .31 - .013 * Math.sin(x * 22 + z * 26);
  const neck = smoothstep(y, neckline - .007, neckline + .009) * (1 - smoothstep(side, .046, .079));
  color.lerp(skin, Math.max(hand, neck));
  const handGrain = Math.sin(x * 183 + z * 157) * Math.sin(y * 134 + seed);
  const throatGrain = Math.sin(x * 63 + y * 122 + z * 39) * Math.cos(y * 59 - x * 95 + seed);
  color.multiplyScalar(1 - neck * (.07 - .17 * throatGrain) - hand * (.07 - .10 * handGrain));
  const bootTop = .156 + Math.max(0, .055 - z) * .28 + .011 * Math.sin(x * 184);
  const boot = (1 - smoothstep(y, bootTop - .008, bootTop + .008)) * (1 - smoothstep(side, .191, .219));
  color.lerp(boots, boot);
  const sole = boot * (1 - smoothstep(y, .037, .050));
  const beltCenter = .918 - x * .055 + .011 * Math.sin(x * 12 + z * 9);
  const belt = (1 - smoothstep(Math.abs(y - beltCenter), .012, .021)) * (1 - smoothstep(side, .166, .251));
  const beltWear = belt * Math.sin(x * 104 + z * 110) * Math.cos(y * 87 + seed);
  const cuffHem = Math.exp(-((y - cuff - .022) ** 2) / .00017) * smoothstep(side, .290, .324);
  const lapel = Math.exp(-((y - 1.449 - side * .53) ** 2) / .00095) *
    smoothstep(side, .018, .052) * (1 - smoothstep(side, .09, .133)) * smoothstep(z, .031, .084);
  const zipper = Math.exp(-((x - .012 * Math.sin(y * 8)) ** 2) / .000028)
    * smoothstep(z, .070, .097) * smoothstep(y, .916, .961) * (1 - smoothstep(y, 1.406, 1.464));
  const kneeWear = Math.exp(-((y - .53) ** 2) / .0035) * smoothstep(z, .026, .070);
  const patch = Math.exp(-((x + .095) ** 6) / .0000000035 - ((y - 1.281) ** 6) / .000000014)
    * smoothstep(z, .075, .112);
  color.lerp(lining, clamp(.76 * belt + .59 * sole + zipper * .61 + .27 * cuffHem, 0, 1));
  color.multiplyScalar(1 + .17 * patch + .18 * kneeWear + .21 * lapel + .16 * beltWear);
  const soot = .5 + .5 * Math.sin(y * 27 + z * 41 + seed) * Math.cos(x * 49 - y * 17);
  const mottling = Math.sin(x * 189 + z * 121) * Math.cos(y * 183 - seed) * .057;
  const stain = Math.max(
    Math.exp(-((x + .090 + (y - 1.30) * .131 + .011 * Math.sin(y * 33)) ** 2) / .00021
      - ((y - 1.242) ** 2) / .021),
    Math.exp(-((x - .166 + .036 * Math.sin(y * 15)) ** 2) / .00014 - ((y - .89) ** 2) / .032)
  ) * smoothstep(z, .040, .090) * (1 - Math.max(hand, neck));
  const clots = clamp(.62 + .31 * Math.sin(x * 218 + y * 133 + seed) * Math.cos(y * 187 - z * 83), .22, .86);
  color.multiplyScalar(.78 + .31 * soot + mottling);
  color.r = lerp(color.r, .112, stain * clots);
  color.g *= 1 - stain * clots * .87;
  color.b *= 1 - stain * clots * .86;
  return color;
}

function weightsFor(indices, weights, x, y, z) {
  const side = x < 0 ? 0 : 1;
  const sideX = Math.abs(x);
  const armIndex = indexArm + side * 3;
  const legIndex = indexLeg + side * 3;
  const arm = smoothstep(sideX, .181, .277) * smoothstep(y, .657, .768);
  const crotch = smoothstep(y, .64, .77) * (1 - smoothstep(sideX, .018, .075));
  const leg = (1 - smoothstep(y, .783, .935)) * (1 - arm) * (1 - crotch);
  const trunk = 1 - arm - leg;
  const torso = smoothstep(y, .900, 1.135);
  const neck = smoothstep(y, 1.518, 1.640) * (1 - smoothstep(sideX, .066, .108));
  const forearm = 1 - smoothstep(y + z * .051, 1.047, 1.184);
  const hand = 1 - smoothstep(y, .842, .935);
  const calf = 1 - smoothstep(y, .436, .590);
  const feet = 1 - smoothstep(y - Math.max(0, z) * .25, .075, .194);
  const mix = [
    [indexHips, trunk * (1 - torso)],
    [indexTorso, trunk * torso * (1 - neck)],
    [indexNeck, trunk * torso * neck],
    [armIndex, arm * (1 - forearm)],
    [armIndex + 1, arm * forearm * (1 - hand)],
    [armIndex + 2, arm * forearm * hand],
    [legIndex, leg * (1 - calf)],
    [legIndex + 1, leg * calf * (1 - feet)],
    [legIndex + 2, leg * calf * feet]
  ].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = mix.reduce((sum, pair) => sum + pair[1], 0);
  for (const [index, weight] of mix) {
    indices.push(index);
    weights.push(weight / total);
  }
}

function sampleGrid(seed) {
  const counts = UPPER.map((max, axis) => Math.ceil((max - LOWER[axis]) / CELL) + 1);
  const [nx, ny, nz] = counts;
  const slab = nx * ny;
  const values = new Float32Array(slab * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    values[x + y * nx + z * slab] = field(LOWER[0] + x * CELL, LOWER[1] + y * CELL, LOWER[2] + z * CELL, seed);
  }
  return { nx, ny, nz, slab, values };
}

function buildGeometry(theme, seed) {
  const { nx, ny, nz, slab, values } = sampleGrid(seed);
  const offsets = [0, 1, nx, nx + 1, slab, slab + 1, slab + nx, slab + nx + 1];
  const points = [], indices = [], normals = [], paint = [], skinIndices = [], skinWeights = [];
  const intersections = new Map();
  const colors = (UNIFORMS[theme] ?? UNIFORMS[0]).map(color => new THREE.Color(color));
  const color = new THREE.Color();
  const step = .002;
  const cells = new Array(8);
  const inside = [], outside = [];

  function crossing(from, to) {
    const first = Math.min(from, to), last = Math.max(from, to);
    const key = first * values.length + last;
    if (intersections.has(key)) return intersections.get(key);
    const t = values[from] / (values[from] - values[to]);
    const x = LOWER[0] + lerp(from % nx, to % nx, t) * CELL;
    const y = LOWER[1] + lerp(Math.floor(from / nx) % ny, Math.floor(to / nx) % ny, t) * CELL;
    const z = LOWER[2] + lerp(Math.floor(from / slab), Math.floor(to / slab), t) * CELL;
    const dx = field(x + step, y, z, seed) - field(x - step, y, z, seed);
    const dy = field(x, y + step, z, seed) - field(x, y - step, z, seed);
    const dz = field(x, y, z + step, seed) - field(x, y, z - step, seed);
    const length = Math.hypot(dx, dy, dz) || 1;
    pointColor(color, x, y, z, colors, seed);
    paint.push(color.r, color.g, color.b);
    weightsFor(skinIndices, skinWeights, x, y, z);
    const index = points.length / 3;
    points.push(x, y, z);
    normals.push(dx / length, dy / length, dz / length);
    intersections.set(key, index);
    return index;
  }

  function triangle(a, b, c) {
    const p = a * 3, q = b * 3, r = c * 3;
    const ux = points[q] - points[p], uy = points[q + 1] - points[p + 1], uz = points[q + 2] - points[p + 2];
    const vx = points[r] - points[p], vy = points[r + 1] - points[p + 1], vz = points[r + 2] - points[p + 2];
    const faceX = uy * vz - uz * vy, faceY = uz * vx - ux * vz, faceZ = ux * vy - uy * vx;
    const sign = faceX * (normals[p] + normals[q] + normals[r])
      + faceY * (normals[p + 1] + normals[q + 1] + normals[r + 1])
      + faceZ * (normals[p + 2] + normals[q + 2] + normals[r + 2]);
    indices.push(a, sign >= 0 ? b : c, sign >= 0 ? c : b);
  }

  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const base = x + y * nx + z * slab;
    let enclosed = 0;
    for (let corner = 0; corner < 8; corner++) {
      cells[corner] = base + offsets[corner];
      if (values[cells[corner]] < 0) enclosed++;
    }
    if (!enclosed || enclosed === 8) continue;
    for (const tetra of TETRAHEDRA) {
      inside.length = outside.length = 0;
      for (const corner of tetra) {
        const id = cells[corner];
        (values[id] < 0 ? inside : outside).push(id);
      }
      if (inside.length === 1) triangle(...outside.map(id => crossing(id, inside[0])));
      else if (inside.length === 3) triangle(...inside.map(id => crossing(id, outside[0])));
      else if (inside.length === 2) {
        const a = crossing(inside[0], outside[0]), b = crossing(inside[0], outside[1]);
        const c = crossing(inside[1], outside[1]), d = crossing(inside[1], outside[0]);
        triangle(a, b, c);
        triangle(a, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(paint, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  return geometry;
}

function bodyMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 bindPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nbindPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 bindPosition;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 p = bindPosition;
        vec3 threads = p * vec3(612.0, 700.0, 680.0);
        float frequency = max(max(length(dFdx(threads)), length(dFdy(threads))), .02);
        float sleeves = 1.0 - smoothstep(.31, .35, abs(p.x)) * (1.0 - smoothstep(.84, .94, p.y));
        float cloth = (1.0 - smoothstep(1.52, 1.58, p.y)) * smoothstep(.125, .18, p.y) * sleeves;
        float twill = cos(threads.y + sin(threads.x + threads.z * .3) * .6)
          * cos(threads.x * .43 + threads.z * .48 - threads.y * .29);
        float repeat = twill * (1.0 - smoothstep(.8, 4.3, frequency));
        float dirt = sin(p.x * 78. + p.z * 29. + cos(p.y * 54.)) * cos(p.y * 26. + p.z * 70.);
        float zipperOffset = (p.x - .012 * sin(p.y * 8.)) * 176.;
        float zipper = exp(-zipperOffset * zipperOffset)
          * smoothstep(.077, .10, p.z) * smoothstep(.927,.97,p.y)
          * (1. - smoothstep(1.39, 1.44, p.y));
        float zipperTeeth = smoothstep(.14,.3,fract(p.y*172.)) * (1. - smoothstep(.62,.85,fract(p.y*172.)));
        float horizontal = abs(abs(p.x) - .105);
        float pocketTop = 1.286 + p.x * .065;
        float vertical = min(abs(p.y - 1.176), abs(p.y - pocketTop));
        float pocketSide = (1. - smoothstep(.003,.008,abs(horizontal-.042)))
          * smoothstep(1.175,1.188,p.y) * (1. - smoothstep(pocketTop-.01,pocketTop,p.y));
        float pocketHem = (1. - smoothstep(.003,.008,vertical)) * (1. - smoothstep(.035,.048,horizontal));
        float pocketFront = smoothstep(.064,.091,p.z);
        float pocketFlap = (1. - smoothstep(.007,.023,abs(p.y-pocketTop))) *
          (1. - smoothstep(.032,.045,horizontal)) * pocketFront;
        float stitches = max(pocketSide, pocketHem) * pocketFront;
        float stitchPores = mix(fract(p.y*169.),fract(p.x*184.),pocketHem > pocketSide ? 1.0 : 0.0);
        float waistWear = (1. - smoothstep(.010,.023,abs(p.y-.918+p.x*.055))) *
          (1. - smoothstep(.15,.23,abs(p.x))) * (.5 + .5 * dirt);
        diffuseColor.rgb *= 1. + repeat * cloth * .21 + dirt * .077 - stitches*.29 + pocketFlap*.27 + waistWear*.10;
        diffuseColor.rgb += vec3(.024,.020,.013) * (zipper * zipperTeeth + stitches * step(.58, stitchPores));
        float clothRelief = cloth * (repeat * .00034 + dirt * .00051 + pocketFlap * .00029);
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        vec3 fabricX = dFdx(-vViewPosition);
        vec3 fabricY = dFdy(-vViewPosition);
        vec3 fabricAcross = cross(fabricY, normal);
        vec3 fabricVertical = cross(normal, fabricX);
        float fabricDet = dot(fabricX, fabricAcross);
        vec3 fabricBump = dFdx(clothRelief) * fabricAcross + dFdy(clothRelief) * fabricVertical;
        normal = normalize(max(abs(fabricDet),1.e-8) * normal - sign(fabricDet) * fabricBump);
      `);
  };
  material.customProgramCacheKey = () => 'last-light-continuous-creature';
  return material;
}

function joint(parent, x, y, z) {
  const bone = new THREE.Bone();
  bone.position.set(x, y, z);
  parent.add(bone);
  return bone;
}

export function makeCreatureBody(theme = 0, seed = 1) {
  const group = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(buildGeometry(theme, seed), bodyMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // A reach pose can exceed the factory bind bounds. The owning actor handles range culling.
  mesh.frustumCulled = false;
  group.add(mesh);
  const hips = joint(mesh, 0, .915, 0);
  const torso = joint(hips, 0, .052, -.005);
  const neck = joint(torso, 0, .633, .017);
  const arms = SIDES.map(side => {
    const shoulder = joint(torso, side * .205, .459, -.013);
    const elbow = joint(shoulder, side * .110, -.307, .026);
    const wrist = joint(elbow, side * .037, -.235, .028);
    return { shoulder, elbow, wrist, side };
  });
  const legs = SIDES.map(side => {
    const hip = joint(hips, side * .088, -.015, -.012);
    const knee = joint(hip, side * .020, -.390, .033);
    const ankle = joint(knee, side * .011, -.368, -.028);
    return { hip, knee, ankle, side };
  });
  const bones = [hips, torso, neck, ...arms.flatMap(arm => [arm.shoulder, arm.elbow, arm.wrist]),
    ...legs.flatMap(leg => [leg.hip, leg.knee, leg.ankle])];
  mesh.bind(new THREE.Skeleton(bones));
  return { group, mesh, hips, torso, neck, arms, legs, seed };
}

export function animateCreatureBody(body, { time, threat = 0, reach = 0, moving = true, reduced = false,
  movementTime = time }) {
  const { hips, torso, arms, legs, seed } = body;
  const urgency = smoothstep(threat, .23, .87);
  const stride = (moving ? 1 : .13) * (reduced ? .62 : 1);
  const beat = movementTime * 8 + seed * 2;
  const drift = Math.sin(time * 3.4 + seed);
  const twitch = reduced ? 0 : Math.sin(time * 18 + seed) * (.014 + urgency * .025);
  const lurch = .55 * Math.sin(beat) + .45 * Math.sin(beat * 2 + .6);
  const breath = Math.sin(time * (2.5 + urgency * 1.9) + seed);
  hips.position.y = .906 + Math.abs(lurch) * stride * (.021 + .013 * urgency) - reach * .035;
  hips.rotation.z = stride * .027 * lurch;
  hips.rotation.y = stride * Math.sin(beat) * (.072 - urgency * .023);
  torso.rotation.x = .095 + urgency * .17 + reach * .22 + breath * .018;
  torso.rotation.z = -.095 + drift * .045 + twitch + stride * lurch * .012;
  torso.position.z = .012 + reach * .080;

  for (const { shoulder, elbow, wrist, side } of arms) {
    const walk = side * Math.sin(beat + .55) * stride;
    const lead = side === 1 ? 1 : .76;
    shoulder.rotation.x = -.105 + walk * (.23 + urgency * .22) - reach * (.96 * lead);
    shoulder.rotation.z = side * (-.13 + .076 * urgency - reach * .13) + lurch * .048;
    shoulder.rotation.y = side * (-.062 + reach * .34);
    elbow.rotation.x = -.139 - lead * urgency * .35 - reach * .48 + walk * .12 + twitch * .65;
    wrist.rotation.set(-.14 + .068 * drift - reach * .25, side * .12 + .040 * lurch,
      side * (-.075 + reach * .25) + twitch);
  }
  for (const { hip, knee, ankle, side } of legs) {
    const forward = side * Math.sin(beat) * stride;
    hip.rotation.x = -.063 + side * .049 + forward * (.18 + urgency * .28);
    hip.rotation.z = side * (.043 + reach * .060);
    knee.rotation.x = .104 + Math.max(0, -.18 + forward) * (.33 + urgency * .24);
    ankle.rotation.x = -.064 - forward * .14;
  }
}
