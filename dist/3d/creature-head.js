import * as THREE from 'three';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const TAU = Math.PI * 2;
const SIDES = 104;
const ROWS = 94;
const NECK = -.022;
const CROWN = .337;
const RADII = [
  // height, half-width, depth toward the face, depth toward the back, depth center
  [-.022, .040, .044, .041, -.004],
  [-.006, .046, .047, .044, -.004],
  [.009, .048, .048, .043, -.006],
  [.023, .048, .045, .047, -.010],
  [.044, .061, .067, .057, -.016],
  [.062, .064, .089, .063, -.012],
  [.079, .069, .095, .070, -.006],
  [.095, .074, .094, .079, -.006],
  [.122, .081, .094, .092, -.008],
  [.154, .092, .091, .107, -.009],
  [.177, .100, .092, .111, -.009],
  [.200, .097, .091, .114, -.009],
  [.229, .095, .095, .110, -.007],
  [.258, .094, .097, .103, -.008],
  [.279, .089, .090, .093, -.006],
  [.301, .074, .078, .077, -.004],
  [.320, .050, .058, .054, -.006],
  [.337, .0004, .0004, .0004, -.007]
];

const COLORS = {
  ash: new THREE.Color('#777167'),
  light: new THREE.Color('#9b8b78'),
  char: new THREE.Color('#413d33'),
  shadow: new THREE.Color('#413730'),
  lips: new THREE.Color('#6d483d'),
  irritation: new THREE.Color('#695144'),
  deep: new THREE.Color('#322924'),
  driedBlood: new THREE.Color('#63251d'),
  bloodCenter: new THREE.Color('#422018'),
  hair: new THREE.Color('#3c372e'),
  gums: new THREE.Color('#3b2522'),
  tooth: new THREE.Color('#978871')
};
const tint = new THREE.Color();
const shapeVector = new THREE.Vector3();

function gaussian(x, y, atX, atY, sx, sy) {
  return Math.exp(-(((x - atX) / sx) ** 2 + ((y - atY) / sy) ** 2));
}

function ridge(distance, radius) {
  return Math.exp(-(((distance - 1) / radius) ** 2));
}

function cubic(start, end, m0, m1, t) {
  return ((2 * (start - end) + m0 + m1) * t +
    3 * (end - start) - 2 * m0 - m1) * t * t + m0 * t + start;
}

function radii(y) {
  let segment = 0;
  while (segment < RADII.length - 2 && y > RADII[segment + 1][0]) segment++;
  const [low, ...from] = RADII[segment];
  const [high, ...to] = RADII[segment + 1];
  const before = RADII[Math.max(0, segment - 1)];
  const after = RADII[Math.min(segment + 2, RADII.length - 1)];
  const u = clamp((y - low) / (high - low), 0, 1);
  return from.map((value, index) => {
    const field = index + 1;
    const m0 = (to[index] - before[field]) / (high - before[0]) * (high - low);
    const m1 = (after[field] - value) / (after[0] - low) * (high - low);
    return cubic(value, to[index], m0, m1, u);
  });
}

const height = row => lerp(NECK, CROWN, row / ROWS);
const angle = column => (column / SIDES - .5) * TAU;
const rowAt = y => Math.round((y - NECK) * ROWS / (CROWN - NECK));
const colAt = radians => Math.round((radians / TAU + .5) * SIDES);

function cut(name, from, to, bottom, top, side = 0) {
  return { name, left: colAt(from), right: colAt(to), bottom: rowAt(bottom), top: rowAt(top), side };
}

const EYES = [
  cut('eye', -.764, -.308, .180, .218, -1),
  cut('eye', .311, .748, .181, .218, 1)
];
const MOUTH = cut('mouth', -.434, .434, .079, .136);
const OPENINGS = [...EYES, MOUTH];

function aperture(opening, column, amount) {
  const t = (column - opening.left) / (opening.right - opening.left);
  const u = clamp(t * 2 - 1, -1, 1);
  const lobe = Math.sqrt(Math.max(0, 1 - u * u));
  if (opening.name === 'eye') {
    const outer = opening.side * u;
    const squeeze = opening.side === 1 ? .84 : 1;
    const center = .202 + outer * .0025 - .0015 * opening.side;
    return [
      center - (.00035 + .0043 * lobe ** 1.25) * squeeze,
      center + (.00047 + .0065 * lobe ** 1.1) * squeeze
    ];
  }
  const corners = .105 + u * .0017 + .0011 * u * u;
  const cusp = ridge(Math.abs(u) / .30, .42) * .0027;
  // The upper face stays almost still. The lower lip follows the mandible.
  return [
    corners - .0006 - lobe ** .88 * (.0016 + amount * .032),
    corners + .0006 + lobe ** .96 * (.0012 + amount * .0042) + cusp * lobe
  ];
}

function remapHeight(row, column, original, amount) {
  let y = original;
  let selected = null;
  let nearEdge = 0;
  // Collapse the AV channels to an almond lid and tuck the two lip surfaces
  // into the same opening. Rows at the border remain welded to the face.
  for (const opening of OPENINGS) {
    const { left, right, bottom, top } = opening;
    const blendColumns = opening.name === 'eye' ? 4.4 : 4.8;
    if (column < left - blendColumns || column > right + blendColumns) continue;
    const lowY = height(bottom), highY = height(top);
    const weight = 1 - smoothstep(Math.max(left - column, column - right, 0), 0, blendColumns);
    const [lower, upper] = aperture(opening, column, amount);
    const u = (original - lowY) / (highY - lowY);
    const bleedDown = opening.name === 'eye' ? .030 : .071;
    const bleedUp = opening.name === 'eye' ? .026 : .049;
    let delta = 0;
    if (row >= bottom && row <= top) delta = lerp(lower, upper, u) - original;
    else if (row < bottom) delta = (lower - lowY) * (1 - smoothstep(lowY - original, 0, bleedDown));
    else delta = (upper - highY) * (1 - smoothstep(original - highY, 0, bleedUp));
    y += delta * weight;
    const near = Math.min(Math.abs(original - lowY), Math.abs(original - highY));
    const lipWeight = weight * (1 - smoothstep(near, .001, opening.name === 'eye' ? .012 : .018));
    if (lipWeight > nearEdge) {
      nearEdge = lipWeight;
      selected = opening.name;
    }
  }
  return { y, selected, nearEdge };
}

function invisibleQuad(row, column) {
  return OPENINGS.some(cut => row >= cut.bottom && row < cut.top && column >= cut.left && column < cut.right);
}

function sculpt(y, theta, seed, amount, selected, nearEdge) {
  const [width, frontDepth, backDepth, center] = radii(y);
  const forward = Math.cos(theta);
  const front = smoothstep(forward, -.04, .91);
  const side = Math.sign(theta) || 1;
  const local = Math.sin(theta) * width;
  const x0 = local + .0030 * Math.sin(8 * y + seed);
  const x = Math.abs(x0);
  let z = forward * (forward >= 0 ? frontDepth : backDepth) + center;
  const eyeX = .053 + side * .0016;
  const eyeY = .203 - side * .002;
  const orbit = gaussian(x, y, eyeX, eyeY + .001, .033, .025);
  const groove = gaussian(x, y, .056, .220, .030, .009);
  const eyebrow = gaussian(x, y, .046 + side * .002, .228, .037, .011);
  const temple = gaussian(x, y, .087, .225, .017, .041);
  const cheek = gaussian(x, y, .065, .170, .031, .015);
  const gaunt = gaussian(x, y, .058, .133, .026, .019);
  const muzzle = gaussian(x0, y, -.003, .117, .036, .024);
  const chin = gaussian(x0, y, -.002, .060 + .010 * amount, .037, .026);

  // A nasal bridge that transitions into a flattened tip, paired alae and two
  // recessed nostrils. One wing is lower, and the bridge bends subtly left.
  const bridge = gaussian(x0, y, -.003 - .024 * (.17 - y), .179, .012, .038);
  const tip = gaussian(x0, y, -.006, .157, .017, .014);
  const ala = gaussian(x, y, .016, .151, .008, .0085);
  const nostril = gaussian(x, y, .0129, .147 - .00095 * side, .0058, .0044);
  const philtrum = gaussian(x0, y, -.004, .133, .0045, .011);
  const nasiX = .024 + Math.max(0, .15 - y) * .63;
  const fold = gaussian(x, y, nasiX, .129, .0057, .030);
  const lip = selected === 'mouth' ? nearEdge : 0;
  const lid = selected === 'eye' ? nearEdge : 0;
  z += front * (-.0175 * orbit - .0042 * groove + .0081 * eyebrow - .0076 * temple +
    .0082 * cheek - .0100 * gaunt + .0044 * muzzle + .0054 * chin + .017 * bridge +
    .024 * tip + .0105 * ala - .0097 * nostril - .0055 * philtrum - .0037 * fold +
    .0033 * lip + .0031 * lid);
  const jawWeight = smoothstep(y, .041, .064) * (1 - smoothstep(y, .085, .126)) *
    smoothstep(forward, .1, .97);
  z -= amount * .015 * jawWeight;
  const jawDrop = amount * .010 * jawWeight;
  const neckWeight = (1 - smoothstep(y, .010, .055)) * (1 - front * .62);
  z += .004 * neckWeight * Math.sin(theta * 3);

  // Sculpt each helix into the skin instead of adding a separate ear primitive.
  const earTheta = Math.abs(theta) - (1.50 + .039 * side);
  const earY = y - (.173 + .005 * side);
  const earRadius = Math.hypot(earTheta / .227, earY / .0396);
  const shell = Math.exp(-(earRadius ** 4));
  const cartilage = ridge(earRadius, .19) * shell * .0078;
  const concha = Math.exp(-(((earTheta + .047) / .082) ** 2 + (earY / .020) ** 2));
  const lobe = Math.exp(-((earTheta / .128) ** 2 + ((earY + .028) / .013) ** 2));
  const ear = .014 * shell + cartilage - .0084 * concha + .0051 * lobe;
  const earAsymmetry = side === -1 ? 1 : .79;
  const fine = .00064 * Math.sin(theta * 61 + y * 421 + seed) * Math.cos(theta * 42 - y * 366);
  const broad = .0012 * Math.sin(theta * 11 - y * 24 + seed) * Math.sin(theta * 13 + y * 77);
  const browTension = smoothstep(y, .224, .244) * (1 - smoothstep(y, .268, .288)) *
    (.46 + .54 * gaussian(x0, y, -.021, .246, .059, .041));
  const wrinkledArc = y + x0 * x0 * .71 + .005 * Math.sin(theta * 6 + seed) + .002 * Math.cos(theta * 13);
  const wrinkle = front * browTension *
    (.00058 * Math.sin(457 * wrinkledArc + theta * 1.2) + .00019 * Math.sin(y * 753 - theta * 9));
  shapeVector.set(x0 + side * ear * earAsymmetry + fine * Math.sin(theta), y - jawDrop,
    z + fine * forward + wrinkle + broad + .0026 * shell);
  return { point: shapeVector, x: x0, front, orbit, eyebrow, cheek, gaunt, nostril, lip, lid, concha,
    tone: .5 + .5 * Math.sin(theta * 8 + y * 67 + seed) * Math.cos(theta * 13 - y * 49) };
}

function paint(result, y, theta, theme, seed, to, index) {
  const { x, front, orbit, eyebrow, cheek, gaunt, nostril, lip, lid, concha, tone } = result;
  const cap = .267 + .024 * Math.cos(theta) + .0058 * Math.sin(theta * 7 + seed);
  const stubble = smoothstep(y, cap - .003, cap + .010) * (.64 + .27 * tone);
  const dust = .50 + .50 * Math.sin(theta * 21 + seed * 2 + y * 105) * Math.sin(theta * 11 - y * 169);
  const ash = gaussian(x, y, -.034, .237, .087, .120);
  const cheekHollow = gaunt * .168;
  const colorBlend = .12 + front * (.16 * ash + .15 * eyebrow + .19 * cheek) + .07 * tone;
  tint.copy(COLORS.ash).lerp(COLORS.light, colorBlend);
  tint.lerp(COLORS.char, clamp(.12 * dust + .12 * tone + cheekHollow + stubble * .74, 0, 1));
  tint.lerp(COLORS.irritation, clamp(front * (.16 * cheek + .44 * lid) + concha * .40, 0, 1));
  tint.lerp(COLORS.shadow, clamp(front * ((orbit * .46) + nostril * .55), 0, 1));
  tint.lerp(COLORS.lips, lip * front * .60);
  const neck = (1 - smoothstep(y, .007, .043)) * (.25 + .21 * Math.sin(theta * 4 + y * 62));
  tint.lerp(COLORS.shadow, neck);
  tint.lerp(COLORS.deep, nostril * front * .38 + orbit ** 3 * front * .17);

  // A dried trail from the temple and a smaller, darker stain at the mouth.
  // Wet specular highlights have already gone from these thin, irregular areas.
  const mirror = theme === 0 ? 1 : -1;
  const fx = x * mirror;
  const drop = .286 - y;
  const hairline = .051 + .125 * drop + .0039 * Math.sin(drop * 57 + seed);
  const bloodWidth = .0034 + .009 * Math.exp(-(((drop - .019) / .028) ** 2));
  const tornMargin = .0017 * Math.sin(y * 790 + theta * 9) * Math.cos(y * 223 + seed);
  const streak = gaussian(fx + tornMargin, y, hairline, .245, bloodWidth, .055) *
    smoothstep(drop, -.011, .007) * (1 - smoothstep(drop, .078, .131));
  const browSmear = gaussian(fx, y, .068, .244, .0157, .0108) * .29;
  const mouthSmear = gaussian(fx, y, -.027, .102, .010, .013) *
    (.27 + .54 * dust);
  const cornerTrail = gaussian(fx, y, -.031 - (.10 - y) * .48, .086, .005, .017) * .37;
  const pigment = front * clamp(streak * 1.1 + browSmear + mouthSmear + cornerTrail, 0, 1);
  tint.lerp(COLORS.driedBlood, pigment * (.63 + .32 * tone));
  tint.lerp(COLORS.bloodCenter, pigment * pigment * .42);

  to[index] = tint.r;
  to[index + 1] = tint.g;
  to[index + 2] = tint.b;
}

function positionAt(row, column, seed, amount) {
  const base = height(row);
  const detail = remapHeight(row, column, base, amount);
  const theta = angle(column);
  return sculpt(detail.y, theta, seed, amount, detail.selected, detail.nearEdge);
}

function blendSeam(normals) {
  const scratch = new THREE.Vector3();
  for (let row = 0; row <= ROWS; row++) {
    const first = row * (SIDES + 1), last = first + SIDES;
    scratch.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last),
      normals.getZ(first) + normals.getZ(last)).normalize();
    normals.setXYZ(first, scratch.x, scratch.y, scratch.z);
    normals.setXYZ(last, scratch.x, scratch.y, scratch.z);
  }
}

function buildSkin(theme, seed) {
  const vertices = (ROWS + 1) * (SIDES + 1);
  const neutral = new Float32Array(vertices * 3);
  const open = new Float32Array(vertices * 3);
  const colors = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const indices = [];
  for (let row = 0; row <= ROWS; row++) {
    for (let column = 0; column <= SIDES; column++) {
      const vertex = row * (SIDES + 1) + column;
      const index = vertex * 3;
      const unmoved = positionAt(row, column, seed, 0);
      unmoved.point.toArray(neutral, index);
      paint(unmoved, unmoved.point.y, angle(column), theme, seed, colors, index);
      positionAt(row, column, seed, 1).point.toArray(open, index);
      uv[vertex * 2] = column / SIDES;
      uv[vertex * 2 + 1] = row / ROWS;
      if (row < ROWS && column < SIDES && !invisibleQuad(row, column)) {
        indices.push(vertex, vertex + 1, vertex + SIDES + 1,
          vertex + 1, vertex + SIDES + 2, vertex + SIDES + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(open, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const openNormals = geometry.attributes.normal.clone();
  blendSeam(openNormals);
  geometry.setAttribute('position', new THREE.BufferAttribute(neutral, 3));
  geometry.computeVertexNormals();
  blendSeam(geometry.attributes.normal);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.morphAttributes.position = [new THREE.BufferAttribute(open, 3)];
  geometry.morphAttributes.normal = [openNormals];
  return geometry;
}

function skinMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: .82,
    metalness: 0,
    specularIntensity: .34,
    clearcoat: .045,
    clearcoatRoughness: .82
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSkinUV;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSkinUV = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vSkinUV;
        float skinHash(vec2 point) {
          vec3 p = fract(point.xyx * vec3(.11369, .13787, .0991));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }
        float skinNoise(vec2 point) {
          vec2 grid = floor(point);
          vec2 t = fract(point);
          vec2 s = t * t * (3.0 - 2.0 * t);
          return mix(mix(skinHash(grid), skinHash(grid + vec2(1.0, 0.0)), s.x),
            mix(skinHash(grid + vec2(0.0, 1.0)), skinHash(grid + vec2(1.0)), s.x), s.y);
        }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 microUV = vSkinUV * vec2(191.0, 121.0);
        float skinFleck = skinNoise(microUV) * .70 + skinNoise(microUV * 2.13 + vec2(48.3)) * .30;
        float maculation = skinNoise(vSkinUV * vec2(37.0, 49.0));
        float scalp = smoothstep(.82, .89, vSkinUV.y - .035*sin(vSkinUV.x*51.0));
        float stubble = scalp * smoothstep(.53, .80, skinNoise(microUV * 2.13 + vec2(19.0)));
        diffuseColor.rgb *= (.83 + .16 * maculation + .17 * skinFleck) * (1.0 - .24 * stubble);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float lipZone = (1.0 - smoothstep(.026,.086,abs(vSkinUV.x-.5))) *
          smoothstep(.27,.288,vSkinUV.y) * (1.0 - smoothstep(.44,.48,vSkinUV.y));
        roughnessFactor = clamp(roughnessFactor - .16 * maculation + .18 * skinFleck -
          lipZone * .11 * smoothstep(.33,.68,diffuseColor.r/(diffuseColor.g+.001)), .57, .98);
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float textureFade = 1.0 - smoothstep(.3, 1.3, max(fwidth(microUV.x), fwidth(microUV.y)));
        float poreDepth = (skinFleck - .5) * .00023 * textureFade;
        vec3 surfaceDX = dFdx(-vViewPosition);
        vec3 surfaceDY = dFdy(-vViewPosition);
        vec3 tangentX = cross(surfaceDY, normal);
        vec3 tangentY = cross(normal, surfaceDX);
        float orientation = dot(surfaceDX, tangentX);
        vec3 disturbance = tangentX * dFdx(poreDepth) + tangentY * dFdy(poreDepth);
        normal = normalize(abs(orientation) * normal - sign(orientation) * disturbance + normal * 1e-8);
      `);
  };
  material.customProgramCacheKey = () => 'last-light-asymmetric-face';
  return material;
}

function perimeter(opening) {
  const { left, right, bottom, top } = opening;
  const boundary = [];
  for (let col = left; col < right; col++) boundary.push([bottom, col]);
  for (let row = bottom; row < top; row++) boundary.push([row, right]);
  for (let col = right; col > left; col--) boundary.push([top, col]);
  for (let row = top; row > bottom; row--) boundary.push([row, left]);
  return boundary;
}

function cavityGeometry(opening, seed) {
  const border = perimeter(opening);
  const stride = border.length;
  const colors = [];
  const indices = [];
  const variants = [[], []];
  for (let state = 0; state < variants.length; state++) {
    const vertices = variants[state];
    const rim = border.map(([row, column]) => positionAt(row, column, seed, state).point.clone());
    const center = rim.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / stride);
    for (let ring = 0; ring < 4; ring++) {
      const step = [.006, .32, .77, .996][ring];
      for (let i = 0; i < stride; i++) {
        const { x, y, z } = rim[i].clone().lerp(center, step);
        const tongue = y < center.y && ring > 0 ? Math.sin(Math.atan2(Math.abs(y - center.y), Math.abs(x - center.x))) : 0;
        vertices.push(x, y, z - [.00025, .012, .034, .059][ring] + .0038 * tongue);
        if (state === 0) {
          tint.copy(COLORS.gums).multiplyScalar([.64, .41, .101, .046][ring]);
          tint.lerp(COLORS.driedBlood, tongue * (ring === 1 ? .083 : .018));
          colors.push(tint.r, tint.g, tint.b);
          if (ring < 3) {
            const a = ring * stride + i;
            const b = ring * stride + (i + 1) % stride;
            indices.push(a, b, a + stride, b, b + stride, a + stride);
          }
        }
      }
    }
    vertices.push(center.x, center.y, center.z - .060);
  }
  for (let i = 0; i < stride; i++) indices.push(3 * stride + i, 3 * stride + (i + 1) % stride, stride * 4);
  colors.push(.0017, .0006, .0007);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(variants[0], 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(variants[1], 3)];
  return geometry;
}

function makeEye(group, opening, seed) {
  const positions = [], uv = [], indices = [];
  const width = 40, height = 12;
  for (let column = 0; column <= width; column++) {
    const u = column / width;
    const col = lerp(opening.left, opening.right, u);
    const theta = angle(col);
    const [low, high] = aperture(opening, col, 0);
    const bottom = sculpt(low, theta, seed, 0, 'eye', 1).point.clone();
    const top = sculpt(high, theta, seed, 0, 'eye', 1).point.clone();
    // Cornea fills the exact lid aperture. Its edge sits under the lids while
    // the small exposed arc catches one reflection rather than protruding.
    for (let row = 0; row <= height; row++) {
      const v = row / height;
      const point = bottom.clone().lerp(top, v);
      point.z += -.00023 + .00175 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      point.toArray(positions, positions.length);
      uv.push(u, v);
      if (column === width || row === height) continue;
      const a = column * (height + 1) + row;
      const b = a + height + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const gaze = { value: new THREE.Vector2(.53 - .039 * opening.side, .51 + .024 * opening.side) };
  const material = new THREE.MeshPhysicalMaterial({
    roughness: .43, metalness: 0, specularIntensity: .40,
    clearcoat: .09, clearcoatRoughness: .45
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.eyeCenter = gaze;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEyeSurface;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEyeSurface = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEyeSurface;\nuniform vec2 eyeCenter;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 iris = (vEyeSurface - eyeCenter) * vec2(7.4, 1.72);
        float radius = length(iris);
        float bearing = atan(iris.y, iris.x);
        float grainA = sin(bearing * 41.0 + radius * 16.0);
        float grainB = sin(bearing * 61.0 - radius * 28.0);
        float ray = .5 + .5 * grainA * grainB;
        vec3 fiber = mix(vec3(.044,.032,.019), vec3(.176,.134,.078), ray * .72);
        fiber = mix(fiber, vec3(.021,.023,.016), smoothstep(.78, 1.0, radius));
        fiber = mix(fiber, vec3(.004,.004,.003), 1.0 - smoothstep(.27, .35, radius));
        float flush = smoothstep(.22, .52, abs(vEyeSurface.x - .5));
        float vessel = pow(max(0.0, sin((bearing + iris.x * .58) * 18.0)), 19.0) * flush;
        vec3 sclera = mix(vec3(.19,.177,.145), vec3(.117,.068,.052), flush*.50 + vessel*.14);
        sclera *= .68 + .41 * sin(vEyeSurface.y * 3.141593);
        diffuseColor.rgb *= mix(fiber, sclera, smoothstep(.963, 1.016, radius));
      `);
  };
  material.customProgramCacheKey = () => 'last-light-anatomical-cornea';
  const eye = new THREE.Mesh(geometry, material);
  group.add(eye);
  return { gaze, side: opening.side };
}

function toothShape() {
  // Short, softly beveled teeth with squared edges rather than tusks.
  const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 3);
  const vertices = geometry.attributes.position;
  const point = new THREE.Vector3(), inner = new THREE.Vector3(), rounding = new THREE.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i);
    inner.copy(point).clampScalar(-.31, .31);
    rounding.copy(point).sub(inner).setLength(.159);
    point.copy(inner).add(rounding);
    vertices.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeTeeth(group, seed) {
  const buttons = [];
  const dentalMaterial = new THREE.MeshStandardMaterial({ color: COLORS.tooth, roughness: .78 });
  const geometry = toothShape();
  for (const lower of [false, true]) {
    for (let i = 0; i < 8; i++) {
      if (i === (lower ? 6 : 1)) continue;
      const col = lerp(MOUTH.left + 1.4, MOUTH.right - 1.4, (i + .5) / 8);
      const theta = angle(col);
      const edge = lower ? 0 : 1;
      const initial = sculpt(aperture(MOUTH, col, 0)[edge], theta, seed, 0, 'mouth', 1).point.clone();
      const end = sculpt(aperture(MOUTH, col, 1)[edge], theta, seed, 1, 'mouth', 1).point.clone();
      const tooth = new THREE.Mesh(geometry, dentalMaterial);
      const displaced = .00065 * Math.sin(i * 4.3 + seed);
      const inset = .0047 + Math.abs(i - 3.5) * .00044;
      initial.y += displaced + (lower ? .0034 : -.0027);
      end.y += displaced + (lower ? .0034 : -.0027);
      initial.z -= inset;
      end.z -= inset + (lower ? .0005 : 0);
      tooth.position.copy(initial);
      tooth.scale.set(.0048 + .0010 * Math.cos(i * 2 + seed),
        lower ? .0041 : .0059 + .0010 * Math.sin(i * 2.7), .0039);
      tooth.rotation.set(-.08, theta * .62, .08 * Math.sin(i * 1.93));
      group.add(tooth);
      buttons.push({ tooth, initial, end });
    }
  }
  return buttons;
}

export function createSculptedHead(theme = 0, seed = 0) {
  const group = new THREE.Group();
  group.name = 'Sculpted head';
  const skin = new THREE.Mesh(buildSkin(theme, seed), skinMaterial());
  skin.castShadow = true;
  skin.receiveShadow = true;
  group.add(skin);

  const lining = new THREE.Mesh(cavityGeometry(MOUTH, seed), new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide
  }));
  group.add(lining);
  const eyes = EYES.map(opening => makeEye(group, opening, seed));
  const teeth = makeTeeth(group, seed);
  return { group, skin, lining, eyes, teeth, seed };
}

export function animateSculptedHead(face, { jaw = 0, night = false, threat = 0, time = 0 } = {}) {
  const open = smoothstep(jaw, .076, .79);
  face.skin.morphTargetInfluences[0] = open;
  face.lining.morphTargetInfluences[0] = open;
  for (const { tooth, initial, end } of face.teeth) {
    tooth.visible = open > .08;
    tooth.position.lerpVectors(initial, end, open);
  }
  const strain = smoothstep(threat, .23, .84);
  const glance = Math.sin(time * (1.6 + strain) + face.seed) * (1 - strain);
  for (const { gaze, side } of face.eyes) {
    gaze.value.set(.52 - .038 * side + glance * .025,
      .51 + .024 * side - (night ? .021 : 0) + Math.sin(time * 1.7 + side) * .023);
  }
}
