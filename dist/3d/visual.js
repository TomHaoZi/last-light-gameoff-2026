import * as THREE from 'three';

const TILE = 2.4;
const HALF = TILE / 2;
const EYE = 1.66;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const FACES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PHASE = { d: 'day', n: 'night' };
const PROPS = new Set(['.', 'G', 'H', 'J']);
const SIZE = { low: 0.8, medium: 1.2, high: 1.6 };
const WARM = new THREE.Color('#ffd8a5');
const COLD = new THREE.Color('#9bcfea');
const YELLOW = new THREE.Color('#ffb95a');
const PALE = new THREE.Color('#b8e8ff');
const SAFE = new THREE.Color('#72e6bf');
const BOILER = {
  floor: '#696460', wall: '#6c6159', ceiling: '#4e453c', low: '#261c18',
  daySky: '#302520', nightSky: '#152230', steel: '#586263', accent: '#b36b30'
};
const OFFICE = {
  floor: '#61564d', wall: '#8c8278', ceiling: '#76685c', low: '#211d20',
  daySky: '#39302c', nightSky: '#14232b', steel: '#626f74', accent: '#71514a'
};
const ROOF = {
  floor: '#596467', wall: '#6b6d69', ceiling: '#515651', low: '#182425',
  daySky: '#8d6057', nightSky: '#1b3048', steel: '#60747a', accent: '#687057'
};

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function canvasTexture(width, height, paint) {
  const image = document.createElement('canvas');
  image.width = width;
  image.height = height;
  paint(image.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function masonry(seed, plaster = false) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rng = random(seed);
    ctx.fillStyle = '#b6b4ad';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5900; i++) {
      const shade = Math.floor(65 + rng() * 180);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${rng() * .28})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
    }
    for (let i = 0; i < 46; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6 + rng() * 50);
      g.addColorStop(0, `rgba(32,25,20,${rng() * .34})`);
      g.addColorStop(1, 'rgba(32,25,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (!plaster) {
      ctx.strokeStyle = '#3b3d39';
      ctx.lineWidth = 2;
      for (let row = 0; row < 5; row++) {
        const y = row * 52;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        for (let x = row % 2 ? 33 : 0; x < w; x += 65) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 52);
        }
        ctx.stroke();
      }
    }
    const streak = ctx.createLinearGradient(0, 0, 0, 256);
    streak.addColorStop(0, '#13181343');
    streak.addColorStop(.45, '#17141100');
    streak.addColorStop(1, '#1815135c');
    ctx.fillStyle = streak;
    ctx.fillRect(0, 0, w, h);
  });
}

function floorTexture(theme) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rng = random(theme + 720);
    ctx.fillStyle = ['#92908b', '#a7a09a', '#888e91'][theme];
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3300; i++) {
      ctx.fillStyle = rng() > .5 ? '#1e222421' : '#f4eacb18';
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 5, 1 + rng() * 2);
    }
    for (let i = 0; i < 100; i++) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.strokeStyle = rng() > .75 ? '#d9d9d740' : '#181a1c30';
      ctx.lineWidth = .7 + rng();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng() * 19, y + rng() * 6);
      ctx.stroke();
    }
    ctx.strokeStyle = '#242321b0';
    ctx.lineWidth = 3;
    const seams = theme === 1 ? 5 : 3;
    for (let i = 0; i < seams; i++) {
      const t = i * 256 / seams;
      ctx.strokeRect(t, 0, 256 / seams, 256);
      if (theme !== 2) ctx.strokeRect(0, t, 256, 256 / seams);
    }
    if (theme === 0) {
      ctx.fillStyle = '#ddd1b32d';
      for (let y = 12; y < 256; y += 22) for (let x = 12; x < 256; x += 24) {
        ctx.fillRect(x + (y % 3) * 3, y, 4, 10);
      }
    }
  });
}

function glowTexture() {
  return canvasTexture(96, 96, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.85)');
    g.addColorStop(.18, 'rgba(255,255,255,.42)');
    g.addColorStop(.53, 'rgba(255,255,255,.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function spriteText(text, ink = '#fff4d4', caption = '') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#10191de8';
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = ink;
    ctx.font = '700 40px monospace';
    ctx.fillText(text, 18, caption ? 57 : 78, 475);
    if (caption) {
      ctx.font = '25px monospace';
      ctx.fillText(caption, 19, 99, 460);
    }
  });
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCylinder = new THREE.CylinderGeometry(.5, .5, 1, 13);
const unitSphere = new THREE.SphereGeometry(.5, 12, 8);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const delta = new THREE.Vector3();
const transform = new THREE.Object3D();

class Batch {
  constructor(group) {
    this.group = group;
    this.buckets = new Map();
  }

  add(geometry, material, position, size, rotation = ZERO, color = null) {
    const key = `${geometry.id}:${material.id}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { geometry, material, entries: [] };
      this.buckets.set(key, bucket);
    }
    transform.position.set(...position);
    transform.scale.set(...size);
    transform.rotation.set(rotation.x, rotation.y, rotation.z);
    transform.updateMatrix();
    bucket.entries.push({ matrix: transform.matrix.clone(), color });
  }

  box(material, x, y, z, width, height, depth, angle = 0, color = null) {
    this.add(unitBox, material, [x, y, z], [width, height, depth], { x: 0, y: angle, z: 0 }, color);
  }

  pipe(material, from, to, diameter) {
    const direction = delta.subVectors(to, from);
    const length = direction.length();
    const middle = from.clone().lerp(to, .5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
    const rotation = new THREE.Euler().setFromQuaternion(quaternion);
    this.add(unitCylinder, material, [middle.x, middle.y, middle.z], [diameter, length, diameter], rotation);
  }

  build() {
    for (const { geometry, material, entries } of this.buckets.values()) {
      const meshes = new THREE.InstancedMesh(geometry, material, entries.length);
      for (let i = 0; i < entries.length; i++) {
        meshes.setMatrixAt(i, entries[i].matrix);
        if (entries[i].color) meshes.setColorAt(i, entries[i].color);
      }
      meshes.castShadow = !material.isMeshBasicMaterial;
      meshes.receiveShadow = !material.isMeshBasicMaterial;
      meshes.computeBoundingSphere();
      this.group.add(meshes);
    }
    this.buckets.clear();
  }
}

function mesh(group, geometry, material, position, scale) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = !material.isMeshBasicMaterial && !material.transparent;
  object.receiveShadow = !material.isMeshBasicMaterial && !material.transparent;
  group.add(object);
  return object;
}

function standard(color, props = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .81, ...props });
}

function emit(color, strength = 1.3) {
  return standard(color, { emissive: color, emissiveIntensity: strength, roughness: .52 });
}

function tint(value) {
  return new THREE.Color().setScalar(.77 + value * .27);
}

function placeSign(group, texture, x, y, z, width = 1.6, height = .4) {
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  sign.position.set(x, y, z);
  sign.scale.set(width, height, 1);
  group.add(sign);
  return sign;
}

const SKY_VERTEX = `
varying vec3 direction;
void main() {
  direction = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAGMENT = `
uniform float night;
uniform float time;
varying vec3 direction;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), w.x), mix(hash(i + vec2(0,1)), hash(i+1.0), w.x), w.y);
}
void main() {
  vec3 d = normalize(direction);
  float h = max(d.y, 0.0);
  vec3 dusk = mix(vec3(.53,.27,.15), vec3(.11,.25,.37), sqrt(h));
  vec3 dark = mix(vec3(.031,.064,.118), vec3(.004,.015,.048), sqrt(h));
  vec3 sky = mix(dusk,dark,night);
  vec2 skyUv = vec2(atan(d.z,d.x) / 6.283185 + 0.5,h);
  vec2 stars = skyUv * vec2(820.0,350.0);
  float star = 1.0 - smoothstep(.045,.13,length(fract(stars)-.5));
  sky += vec3(.40,.63,.85) * star * step(.988,hash(floor(stars))) * night * smoothstep(.02,.25,h);
  float vapor = noise(skyUv*vec2(27,42)+vec2(time*.006,0.0))*.6 + noise(skyUv*vec2(56,108))*.4;
  sky += smoothstep(.51,.8,vapor) * smoothstep(.011,.24,h) * (1.0-smoothstep(.32,.78,h)) * mix(vec3(.31,.13,.047),vec3(.017,.032,.062),night);
  vec3 sun = normalize(vec3(-.64,.13,-.75));
  float alignment = max(dot(d,sun),0.0);
  sky += mix(vec3(.7,.27,.05),vec3(.020,.048,.094),night)*pow(alignment,22.);
  sky += mix(vec3(1.0,.65,.32),vec3(.58,.73,.84),night)*smoothstep(.9993,.9997,alignment);
  gl_FragColor = vec4(sky,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const POST_VERTEX = `
varying vec2 coords;
void main() { coords = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;
const POST_FRAGMENT = `
uniform sampler2D frameTex;
uniform vec2 texel;
uniform float time;
uniform float night;
uniform float shift;
uniform float life;
uniform float danger;
varying vec2 coords;
float hash(vec2 p) { return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main() {
  vec2 uv = coords;
  vec2 center = uv - .5;
  float range = length(center);
  float ring = 1.0 - smoothstep(.008,.045,abs(range-(1.0-shift)*.80));
  float ripple = shift * ring;
  vec2 jitter = center * (.022 * life * sin(time*23.0) + .023 * ripple);
  vec3 base = texture2D(frameTex, uv+jitter).rgb;
  float spread = .0015 + .007 * ripple + .003 * life;
  base.r = texture2D(frameTex,uv+jitter+center*spread).r;
  base.b = texture2D(frameTex,uv+jitter-center*spread).b;
  vec3 rays = vec3(0.);
  rays += max(texture2D(frameTex,uv+vec2(3.,2.)*texel).rgb-.56,0.0);
  rays += max(texture2D(frameTex,uv-vec2(3.,2.)*texel).rgb-.56,0.0);
  rays += max(texture2D(frameTex,uv+vec2(-2.,4.)*texel).rgb-.56,0.0);
  rays += max(texture2D(frameTex,uv+vec2(2.,-4.)*texel).rgb-.56,0.0);
  base += rays * .065;
  float vignette = 1.0 - smoothstep(.20,.75,range) * (.25+.18*night+.25*life);
  base *= vignette;
  base = mix(base,base*vec3(.73,1.03,1.13),night*.32);
  base += vec3(.028,.10,.14)*ripple;
  base = mix(base,base*vec3(1.29,.52,.51),smoothstep(.22,.71,range)*danger*.58);
  gl_FragColor = vec4(max(base,0.),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy + floor(time * 24.0)) - .5) * .016;
}
`;

export class Visual {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, 1, .045, 143);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor('#11181d');
    this.rig = new THREE.Group();
    this.scene.add(this.rig, this.camera);
    this.fill = new THREE.HemisphereLight('#c9dae2', '#362e29', 1.01);
    this.rim = new THREE.DirectionalLight('#ffd9a4', 1.55);
    this.rim.position.set(-24, 39, -42);
    this.rig.add(this.fill, this.rim);
    this.lamp = new THREE.SpotLight('#fff0d3', 14, 27, Math.PI / 4.8, .85, 1.75);
    this.lamp.shadow.mapSize.set(768, 768);
    this.lamp.shadow.bias = -.00085;
    this.lamp.shadow.normalBias = .028;
    this.lamp.shadow.camera.near = .11;
    this.lamp.shadow.camera.far = 22;
    this.rig.add(this.lamp, this.lamp.target);
    this.eyeFill = new THREE.PointLight('#bbb294', .8, 4.6, 1.3);
    this.rig.add(this.eyeFill);
    this.nearLights = Array.from({ length: 5 }, () => {
      const light = new THREE.PointLight('#ffe4ba', 0, 12, 1.7);
      this.rig.add(light);
      return light;
    });
    const hdr = this.renderer.extensions.has('EXT_color_buffer_float');
    const gl = this.renderer.getContext();
    const sampleFormats = gl.getInternalformatParameter(gl.RENDERBUFFER, hdr ? gl.RGBA16F : gl.RGBA8, gl.SAMPLES);
    this.frameTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter, type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: sampleFormats?.length ? Math.min(2, sampleFormats[0]) : 0
    });
    this.postScene = new THREE.Scene();
    this.grade = new THREE.ShaderMaterial({
      uniforms: {
        frameTex: { value: this.frameTarget.texture }, texel: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 }, night: { value: 0 }, shift: { value: 0 },
        life: { value: 0 }, danger: { value: 0 }
      },
      vertexShader: POST_VERTEX, fragmentShader: POST_FRAGMENT,
      depthTest: false, depthWrite: false
    });
    this.postScene.add(new THREE.Mesh(unitPlane, this.grade));
    this.postCamera = new THREE.Camera();
    this.glow = glowTexture();
    this.attack = this.makeAttack();
    this.stage = null;
    this.view = new THREE.Vector3();
    this.last = null;
    this.velocity = 0;
    this.walk = 0;
    this.nightBlend = 0;
    this.size = [0, 0, 0];
  }

  load(level, decoded) {
    if (this.stage) this.clearStage();
    this.decoded = decoded;
    this.theme = ['boiler', 'office', 'roof'].indexOf(level.theme || level.id);
    if (this.theme < 0) this.theme = /roof|garden|antenna/i.test(level.id) ? 2 : /office|archive/i.test(level.id) ? 1 : 0;
    this.palette = [BOILER, OFFICE, ROOF][this.theme];
    this.stage = new THREE.Group();
    this.scene.add(this.stage);
    this.objects = new Map();
    this.ambience = [];
    this.kinetics = [];
    this.safeLamps = [];
    this.localTextures = [];
    this.last = null;
    this.velocity = 0;
    this.walk = 0;
    this.nightBlend = 0;
    this.ghosts = new Map();
    this.fogWarm = new THREE.Color(this.palette.daySky);
    this.fogCold = new THREE.Color(this.palette.nightSky);
    this.scene.background = this.fogWarm.clone();
    this.scene.fog = new THREE.FogExp2(this.fogWarm, this.theme === 2 ? .019 : .058);
    this.materials = this.makeMaterials();
    this.groups = { neutral: this.stage, day: new THREE.Group(), night: new THREE.Group() };
    this.stage.add(this.groups.day, this.groups.night);
    this.batches = {
      neutral: new Batch(this.groups.neutral), day: new Batch(this.groups.day), night: new Batch(this.groups.night)
    };

    for (const wall of decoded.walls) this.makeWall(wall);
    for (const floor of decoded.floors) this.makeFloor(floor);
    this.makePropClusters();
    this.makeArrival();
    for (const lamp of decoded.lamps) this.makeSafeLamp(lamp);
    for (const station of decoded.stations) this.makeStation(station);
    if (decoded.power) this.makeStation(decoded.power, true);
    for (const clue of decoded.clues) this.makeClue(clue);
    for (const hazard of decoded.hazards) this.makeHazard(hazard);
    this.makeDoor(decoded.exit);
    if (this.theme === 2) this.makeSkyline();
    Object.values(this.batches).forEach(batch => batch.build());
    this.makeParticles();
  }

  clearStage() {
    const transientGeometries = new Set();
    const materials = new Set();
    this.stage.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry && ![unitBox, unitCylinder, unitSphere, unitPlane].includes(object.geometry)) {
        transientGeometries.add(object.geometry);
      }
      if (object.material) materials.add(object.material);
    });
    for (const material of Object.values(this.materials)) materials.add(material);
    for (const geo of transientGeometries) geo.dispose();
    for (const material of materials) material.dispose();
    for (const texture of this.localTextures) texture.dispose();
    this.scene.remove(this.stage);
    this.sky = null;
    this.particles = null;
  }

  makeMaterials() {
    const wallMap = masonry(20 + this.theme, this.theme !== 0);
    const tileMap = floorTexture(this.theme);
    this.localTextures.push(wallMap, tileMap);
    return {
      wall: standard(this.palette.wall, { map: wallMap, roughness: .96 }),
      floor: standard(this.palette.floor, { map: tileMap, roughness: this.theme === 1 ? .8 : .63 }),
      ceiling: standard(this.palette.ceiling, { map: wallMap }),
      low: standard(this.palette.low, { roughness: .92 }),
      steel: standard(this.palette.steel, { roughness: .50, metalness: .28 }),
      dark: standard('#202a2c', { roughness: .61, metalness: .20 }),
      accent: standard(this.palette.accent, { roughness: .50, metalness: .15 }),
      copper: standard('#8d5a37', { roughness: .38, metalness: .31 }),
      rust: standard('#89413c', { roughness: .71 }),
      bone: standard('#c4b6a2', { roughness: .7 }),
      brass: standard('#a28c60', { metalness: .36, roughness: .46 }),
      day: standard('#b5873d', { map: tileMap, metalness: .22, roughness: .42, emissive: '#9a541b', emissiveIntensity: .24 }),
      night: standard('#3e697b', { map: tileMap, metalness: .15, roughness: .32, emissive: '#1e7b9e', emissiveIntensity: .34 }),
      dayLine: emit('#ffb649', 1.4), nightLine: emit('#5bc5f5', 1.65),
      unsafe: emit('#d34933', 1.3), lamp: emit('#f6d3a1', 1.4), safe: emit('#72e6bf', 1.35)
    };
  }

  makeWall(tile) {
    const { x, z, col, row } = tile;
    const m = this.materials;
    const b = this.batches.neutral;
    const roof = this.theme === 2;
    const height = roof ? 1.38 : 3.28;
    b.box(m.wall, x, height / 2 - .13, z, TILE + .025, height + .26, TILE + .025, 0, tint(random(col * 771 + row * 297)()));
    for (let face = 0; face < FACES.length; face++) {
      const [dx, dz] = FACES[face];
      const next = this.decoded.get(col + dx, row + dz);
      if (!next || next.kind === '#') continue;
      const xFace = x + dx * (HALF + .018);
      const zFace = z + dz * (HALF + .018);
      const angle = dx ? Math.PI / 2 : 0;
      b.box(m.dark, xFace, roof ? 1.29 : .13, zFace, TILE + .04, .14, .094, angle);
      if (roof) {
        b.box(m.steel, xFace, 1.44, zFace, TILE, .08, .15, angle);
      } else {
        b.box(m.low, xFace, .44, zFace, TILE, .63, .055, angle);
        b.box(m.steel, xFace, .76, zFace, TILE, .037, .075, angle);
        b.box(m.dark, xFace, 2.73, zFace, TILE, .13, .11, angle);
      }
      this.wallFeature(tile, dx, dz, xFace, zFace, angle, next.kind);
    }
  }

  wallFeature(tile, dx, dz, x, z, angle, neighbor) {
    const m = this.materials;
    const b = this.batches.neutral;
    const roof = this.theme === 2;
    const pattern = (tile.row * 19 + tile.col * 13 + (dx + 2) * 7 + dz * 17) % 19;
    if (roof) {
      if (pattern % 4 === 0) {
        b.box(m.accent, x, .92, z, 1.2, .19, .075, angle);
        b.box(m.bone, x, .95, z, .86, .025, .085, angle);
      }
      return;
    }
    if (this.theme === 0) {
      const y = 2.40;
      b.pipe(m.copper, new THREE.Vector3(x - dz * HALF, y, z + dx * HALF), new THREE.Vector3(x + dz * HALF, y, z - dx * HALF), .136);
      b.pipe(m.dark, new THREE.Vector3(x - dz * HALF, y + .21, z + dx * HALF), new THREE.Vector3(x + dz * HALF, y + .21, z - dx * HALF), .07);
      const ox = -dz * (pattern < 9 ? .74 : -.74);
      const oz = dx * (pattern < 9 ? .74 : -.74);
      b.box(m.steel, x + ox, y - .05, z + oz, .105, .205, .202, angle);
      b.box(m.rust, x - dx * .018 + ox, y - .28, z - dz * .018 + oz, .049, .38, .028, angle);
      if (pattern % 5 === 0 && neighbor === '.') {
        b.box(m.steel, x + dx * .13, .68, z + dz * .13, 1.52, .97, .22, angle);
        for (let i = 0; i < 7; i++) b.box(m.dark, x + dx * .25, .37 + i * .1, z + dz * .25, 1.25, .03, .012, angle);
        b.box(m.copper, x + dx * .18, 1.22, z + dz * .18, 1.58, .065, .24, angle);
      }
    } else {
      if (pattern >= 8 && neighbor === '.') {
        b.box(m.accent, x + dx * .04, 1.28, z + dz * .04, 1.43, .84, .13, angle);
        b.box(m.dark, x + dx * .105, 1.28, z + dz * .105, 1.36, .77, .035, angle);
        b.box(m.steel, x + dx * .13, 1.28, z + dz * .13, 1.31, .72, .015, angle);
        if (pattern % 2 === 0) {
          for (let i = 0; i < 5; i++) b.box(m.dark, x + dx * .14, 1.02 + i * .128, z + dz * .14, 1.32, .022, .022, angle);
        }
      } else if (pattern % 4 === 0) {
        b.box(m.accent, x + dx * .025, 1.62, z + dz * .025, .9, 1.93, .07, angle);
        const pull = Math.sign(dx || dz);
        b.box(m.brass, x + dx * .075 + dz * pull * .26, 1.02, z + dz * .075 - dx * pull * .26, .17, .05, .085, angle);
      }
    }
  }

  makeFloor(tile) {
    const { x, z, col, row, kind } = tile;
    const batch = this.batches[PHASE[kind] || 'neutral'];
    const m = this.materials;
    const variant = random(col + 3211 * row + 7001 * this.theme);
    const material = PHASE[kind] ? m[PHASE[kind]] : m.floor;
    batch.box(material, x, -.14, z, TILE - .025, .28, TILE - .025, 0, tint(variant()));
    if (this.theme !== 2) {
      this.batches.neutral.box(m.ceiling, x, 3.34, z, TILE + .013, .15, TILE + .013);
      if ((col + row * 2) % 4 === 0) this.batches.neutral.box(m.dark, x, 3.12, z + .85, TILE + .025, .2, .16);
      if (PHASE[kind]) this.batches.neutral.box(m.low, x, -5.8, z, TILE + .012, .2, TILE + .012);
    }
    if (PHASE[kind]) {
      const phase = PHASE[kind];
      const light = m[phase + 'Line'];
      batch.box(m.dark, x, -.26, z, TILE - .08, .23, TILE - .08);
      for (const edge of [-1, 1]) {
        batch.box(light, x, .009, z + edge * 1.12, TILE - .16, .021, .027);
        batch.box(light, x + edge * 1.12, .009, z, .027, .021, TILE - .16);
      }
      for (let i = -2; i <= 2; i++) {
        batch.box(m.dark, x + i * .38, .004, z, .04, .022, 2.10);
      }
      return;
    }
    if (this.theme === 2) batch.box(m.low, x, -.65, z, TILE - .015, .93, TILE - .015);
    if (this.theme === 0 && (col + row * 7) % 8 === 0) {
      batch.box(m.accent, x + .9, .006, z, .045, .016, 2.28);
    }
    if (kind === 'S' || kind === 'E' || (kind === '.' && (col + row * 3) % 12 === 0)) {
      this.fixture(x, this.theme === 2 ? 2.74 : 2.98, z, kind === 'E' ? 'safe' : 'general');
    }
  }

  fixture(x, y, z, type) {
    const m = this.materials;
    const b = this.batches.neutral;
    const roof = this.theme === 2;
    const face = roof ? m.steel : m.dark;
    b.box(face, x, y + .08, z, .68, .14, .36);
    b.box(type === 'safe' ? m.safe : m.lamp, x, y, z, .52, .052, .18);
    if (roof) b.box(m.steel, x + .3, y / 2, z, .045, y, .045);
    this.lightSource(x, y - .11, z, type === 'safe' ? 17 : 15, type, .75);
  }

  edgeOffset(tile, inset = .86) {
    for (const [dx, dz] of FACES) {
      if (this.decoded.get(tile.col + dx, tile.row + dz)?.kind === '#') {
        return { x: tile.x + dx * inset, z: tile.z + dz * inset, dx, dz, angle: dx ? Math.PI / 2 : 0 };
      }
    }
    return { x: tile.x + .76, z: tile.z + .76, dx: 0, dz: 1, angle: 0 };
  }

  makePropClusters() {
    const b = this.batches.neutral;
    const m = this.materials;
    for (const tile of this.decoded.floors) {
      if (!PROPS.has(tile.kind)) continue;
      const n = (tile.col * 71 + tile.row * 57) % 31;
      const edge = this.edgeOffset(tile);
      if (Math.abs(edge.dx) + Math.abs(edge.dz) === 0 || n > 13) continue;
      const { x, z, angle, dx, dz } = edge;
      const hasWall = this.decoded.get(tile.col + dx, tile.row + dz)?.kind === '#';
      if (!hasWall && this.theme !== 2) continue;
      if (this.theme === 0) {
        if (n < 7) {
          b.add(unitCylinder, m.dark, [x, .86, z], [.55, 1.7, .55]);
          b.add(unitSphere, m.steel, [x, 1.72, z], [.54, .30, .54]);
          for (const y of [.20, .64, 1.48]) b.add(unitCylinder, m.copper, [x, y, z], [.57, .055, .57]);
          b.pipe(m.copper, new THREE.Vector3(x, 1.8, z), new THREE.Vector3(x + dx * .36, 2.38, z + dz * .36), .10);
        } else {
          b.box(m.accent, x, .4, z, .49, .8, .48, angle);
          for (let k = 0; k < 4; k++) b.box(m.dark, x - dx * .245, .22 + k * .11, z - dz * .245, .38, .026, .012, angle);
        }
      } else if (this.theme === 1) {
        if (n < 9) {
          b.box(m.accent, x, .79, z, 1.57, .11, .48, angle);
          for (const side of [-1, 1]) {
            b.box(m.dark, x + dz * side * .65, .39, z - dx * side * .65, .13, .77, .39, angle);
          }
          b.box(m.bone, x + dz * .38, .86, z - dx * .38, .27, .035, .24, angle);
          b.box(m.steel, x - dz * .26, 1.03, z + dx * .26, .46, .33, .18, angle);
          b.box(m.dark, x - dx * .1 - dz * .26, 1.025, z - dz * .1 + dx * .26, .39, .25, .014, angle);
        } else {
          b.box(m.steel, x, .60, z, .52, 1.20, .48, angle);
          for (let d = 0; d < 4; d++) {
            b.box(m.dark, x - dx * .248, .18 + d * .27, z - dz * .248, .455, .048, .026, angle);
            b.box(m.brass, x - dx * .268, .22 + d * .27, z - dz * .268, .12, .036, .028, angle);
          }
        }
      } else if (n < 7) {
        b.box(m.dark, x, .31, z, 1.24, .62, .48, angle);
        b.box(m.steel, x, .64, z, 1.30, .08, .53, angle);
        for (let i = 0; i < 6; i++) {
          b.box(m.dark, x - dx * .26, .12 + i * .075, z - dz * .26, 1.13, .025, .018, angle);
        }
      } else if (n > 10) {
        this.planter(x, z, angle, n);
      }
    }
  }

  makeArrival() {
    const m = this.materials;
    const batch = this.batches.neutral;
    const { x, z } = this.decoded.spawn;
    if (this.theme === 0) {
      const panelX = x - 4.65;
      const panelZ = z - 5.75;
      batch.box(m.steel, panelX, 1.29, panelZ, 1.82, 1.57, .24);
      batch.box(m.dark, panelX, 1.29, panelZ + .125, 1.73, 1.43, .06);
      for (const side of [-1, 1]) {
        this.batches.neutral.pipe(m.copper, new THREE.Vector3(panelX + side * .63, 2.03, panelZ + .08),
          new THREE.Vector3(panelX + side * .63, 2.46, panelZ + .08), .14);
        batch.box(m.brass, panelX + side * .63, 2.15, panelZ + .084, .22, .11, .24);
        batch.box(m.dark, panelX + side * .85, .82, panelZ + .19, .039, .23, .04);
        batch.add(unitCylinder, m.brass, [panelX + side * .48, 1.28, panelZ + .225], [.29, .09, .29],
          { x: Math.PI / 2, y: 0, z: 0 });
        batch.add(unitCylinder, m.bone, [panelX + side * .48, 1.28, panelZ + .28], [.238, .025, .238],
          { x: Math.PI / 2, y: 0, z: 0 });
        batch.box(m.rust, panelX + side * .45, 1.30, panelZ + .296, .015, .09, .009, 0);
      }
      const label = spriteText('B2 • BOILER', '#edc697', 'DUTY STATION');
      this.localTextures.push(label);
      const plaque = mesh(this.stage, unitPlane, new THREE.MeshBasicMaterial({ map: label }),
        [panelX, 1.74, panelZ + .17], [1.42, .355, 1]);
      plaque.receiveShadow = false;
      this.lightSource(panelX + .30, 2.13, panelZ + .52, 10, 'general', .44);
      for (let i = 0; i < 8; i++) {
        const stripe = m[i % 2 ? 'dark' : 'brass'];
        batch.box(stripe, x - 1.1 + i * .3, .013, z - 5.44, .28, .022, .13);
      }
      this.makeFan(x + 3.35, 1.60, z - 5.80, .74);
    } else if (this.theme === 1) {
      const wallZ = z - 4.81;
      const wallX = x - 2.48;
      batch.box(m.accent, wallX, .44, wallZ + .23, 1.78, .88, .56);
      batch.box(m.steel, wallX, .91, wallZ + .24, 1.87, .085, .59);
      for (let j = 0; j < 3; j++) {
        batch.box(m.bone, wallX + (j - 1) * .23, .982 + j * .017, wallZ + .29, .31, .025, .24, j * .11);
      }
      const label = spriteText('F4 • PERSONNEL', '#e4dfbe', 'ARCHIVE / LUNCHROOM');
      this.localTextures.push(label);
      for (const side of [-1, 1]) {
        batch.box(m.dark, wallX + side * .70, 2.51, wallZ - .014, .036, 1.10, .035);
      }
      mesh(this.stage, unitPlane, new THREE.MeshBasicMaterial({ map: label }),
        [wallX, 1.97, wallZ], [1.68, .42, 1]);
      this.lightSource(wallX + .18, 2.20, wallZ + .47, 10, 'general', .46);
    } else {
      const plant = this.decoded.get(this.decoded.spawn.col + 2, this.decoded.spawn.row - 2);
      if (plant) {
        batch.box(m.steel, plant.x, .64, plant.z + .5, 1.68, 1.28, .71);
        batch.box(m.accent, plant.x, 1.31, plant.z + .5, 1.79, .1, .77);
        this.makeFan(plant.x, .79, plant.z + .87, .60);
      }
      for (let i = 0; i < 3; i++) this.planter(x - 4.8 - i * .6, z - 4.65 - i * .14, 0, i);
      const tank = this.decoded.get(20, 6);
      if (tank) this.makeTank(tank.x, tank.z);
    }
  }

  makeTank(x, z) {
    const m = this.materials;
    const b = this.batches.neutral;
    for (const dx of [-.65, .65]) for (const dz of [-.65, .65]) {
      b.box(m.dark, x + dx, 1.18, z + dz, .125, 2.36, .125);
      b.box(m.steel, x + dx, .075, z + dz, .31, .15, .31);
      b.pipe(m.steel, new THREE.Vector3(x + dx, .29, z + dz), new THREE.Vector3(x - dx, 1.83, z + dz), .053);
    }
    b.add(unitCylinder, m.steel, [x, 2.87, z], [1.85, 1.64, 1.85]);
    b.add(unitSphere, m.steel, [x, 3.67, z], [1.84, .57, 1.84]);
    for (const y of [2.23, 2.42, 3.36, 3.57]) {
      b.add(unitCylinder, m.dark, [x, y, z], [1.90, .047, 1.90]);
    }
    b.add(unitCylinder, m.dark, [x, 3.97, z], [.09, .23, .09]);
    b.add(unitSphere, m.unsafe, [x, 4.12, z], [.11, .14, .11]);
    this.lightSource(x, 4.13, z, 2.8, 'alarm', .38);
  }

  makeFan(x, y, z, radius) {
    const m = this.materials;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    this.stage.add(group);
    const rim = new THREE.TorusGeometry(radius, .035, 8, 29);
    mesh(group, rim, m.steel, [0, 0, .033], [1, 1, 1]);
    const backing = mesh(group, unitCylinder, m.dark, [0, 0, -.015], [radius * 1.94, .074, radius * 1.94]);
    backing.rotation.x = Math.PI / 2;
    const rotor = new THREE.Group();
    group.add(rotor);
    mesh(rotor, unitSphere, m.copper, [0, 0, .05], [.19, .19, .084]);
    for (let i = 0; i < 5; i++) {
      const angle = i * 2 * Math.PI / 5;
      const blade = mesh(rotor, unitBox, m.steel, [Math.sin(angle) * radius * .49,
        Math.cos(angle) * radius * .49, .042], [.155, radius * .77, .04]);
      blade.rotation.z = -angle + .3;
    }
    this.kinetics.push({ rotor, speed: 3.8 + this.theme * 2 });
  }

  planter(x, z, angle, seed) {
    const m = this.materials;
    const b = this.batches.neutral;
    const rng = random(seed + Math.floor(x * 31));
    b.box(m.accent, x, .17, z, .87, .34, .42, angle);
    b.box(m.low, x, .338, z, .79, .027, .34, angle);
    for (let j = 0; j < 8; j++) {
      const ox = (rng() - .5) * .6;
      const oz = (rng() - .5) * .24;
      const oxWorld = Math.cos(angle) * ox + Math.sin(angle) * oz;
      const ozWorld = -Math.sin(angle) * ox + Math.cos(angle) * oz;
      const h = .2 + rng() * .34;
      b.pipe(m.accent, new THREE.Vector3(x + oxWorld, .35, z + ozWorld), new THREE.Vector3(x + oxWorld * 1.4, .35 + h, z + ozWorld * 1.4), .014);
      b.add(unitSphere, m.accent, [x + oxWorld * 1.38, .36 + h, z + ozWorld * 1.35], [.18, .036, .074], { x: 0, y: rng() * Math.PI, z: rng() - .5 }, tint(.4 + rng() * .6));
    }
  }

  lightSource(x, y, z, strength, type, scale) {
    const color = type === 'safe' ? SAFE : type === 'alarm' ? YELLOW : WARM;
    const material = new THREE.SpriteMaterial({
      map: this.glow, color, transparent: true, opacity: .32, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(scale);
    this.stage.add(sprite);
    this.ambience.push({ x, y, z, strength, type, color, sprite });
    return sprite;
  }

  makeSafeLamp(tile) {
    const m = this.materials;
    const b = this.batches.neutral;
    const { x, z } = this.edgeOffset(tile, .72);
    b.box(m.dark, x, .07, z, .42, .14, .37);
    b.box(m.steel, x, .64, z, .12, 1.15, .12);
    b.box(m.dark, x, 1.23, z, .42, .18, .34);
    b.box(m.safe, x, 1.32, z, .32, .05, .25);
    b.box(m.dark, x, 1.37, z, .42, .052, .34);
    const beacon = this.lightSource(x, 1.36, z, 11, 'safe', .96);
    const mat = new THREE.MeshBasicMaterial({
      map: this.glow, color: '#accf95', transparent: true, opacity: .19,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const pool = mesh(this.stage, unitPlane, mat, [tile.x, .016, tile.z], [2.3, 2.3, 1]);
    pool.rotation.x = -Math.PI / 2;
    this.safeLamps.push({ tile, pool, beacon });
  }

  makeStation(tile, power = false) {
    const m = this.materials;
    const b = this.batches.neutral;
    const { x, z, dx, dz, angle } = this.edgeOffset(tile, .73);
    const id = tile.key || tile.kind;
    b.box(m.dark, x, .06, z, .62, .13, .54, angle);
    const signal = emit('#f1b457', 1.7);
    const indicator = mesh(this.stage, unitSphere, signal, [x, 1.20, z], [.12, .12, .12]);
    const group = new THREE.Group();
    group.position.set(x - dx * .24, .93, z - dz * .24);
    group.rotation.y = angle;
    this.stage.add(group);
    let action;
    const title = ['PRESSURE', 'DOCUMENT', 'CONTROL'][this.theme];
    if (this.theme === 0) {
      b.box(m.steel, x, .53, z, .42, 1.06, .48, angle);
      b.box(m.copper, x, .80, z, .5, .27, .52, angle);
      const valve = new THREE.TorusGeometry(.21, .035, 9, 20);
      action = new THREE.Group();
      group.add(action);
      mesh(action, valve, m.rust, [0, 0, 0], [1, 1, 1]);
      mesh(action, unitBox, m.rust, [0, 0, 0], [.38, .04, .05]);
      mesh(action, unitBox, m.rust, [0, 0, 0], [.04, .38, .05]);
      mesh(action, unitSphere, m.brass, [0, 0, .04], [.1, .10, .075]);
    } else if (this.theme === 1) {
      b.box(m.accent, x, .47, z, .58, .92, .53, angle);
      b.box(m.steel, x, .95, z, .64, .11, .58, angle);
      action = mesh(group, unitBox, m.bone, [0, .085, .19], [.44, .028, .28]);
      for (let i = 0; i < 4; i++) b.box(m.dark, x - dx * .269, .23 + i * .14, z - dz * .269, .33, .012, .012, angle);
      if (id === 'B') {
        const desk = new THREE.Group();
        desk.position.set(x + .24, 0, z + .24);
        this.stage.add(desk);
        mesh(desk, unitBox, m.accent, [0, 1.01, .38], [1.18, 2.01, .12]);
        mesh(desk, unitBox, m.steel, [0, 1.06, .307], [.93, 1.81, .031]);
        mesh(desk, unitBox, m.brass, [.33, .90, .265], [.085, .09, .072]);
        const plaque = spriteText('GARY', '#e6d5ab');
        this.localTextures.push(plaque);
        const name = mesh(desk, unitPlane, new THREE.MeshBasicMaterial({ map: plaque }), [.10, 1.53, .279], [.42, .105, 1]);
        name.rotation.y = Math.PI;
      }
    } else {
      b.box(m.steel, x, .59, z, .47, 1.18, .43, angle);
      b.box(m.dark, x, .97, z, .53, .32, .49, angle);
      action = mesh(group, unitBox, m.brass, [0, 0, .09], [.07, .22, .055]);
      action.rotation.z = -.48;
    }
    const label = power
      ? spriteText('POWER', '#a8dfd4', 'EMERGENCY LIGHT')
      : spriteText(`${id} · ${title}`, '#ffd38d', 'HANDOVER CONTROL');
    this.localTextures.push(label);
    placeSign(this.stage, label, x, 1.56, z, 1.1, .275);
    this.objects.set(id, { indicator, action, kind: power ? 'power' : 'station' });
  }

  makeClue(tile) {
    const id = tile.key || tile.kind;
    const { x, z } = this.edgeOffset(tile, .78);
    const m = this.materials;
    this.batches.neutral.box(m.dark, x, .35, z, .39, .70, .39);
    this.batches.neutral.box(m.steel, x, .71, z, .52, .055, .42);
    const page = mesh(this.stage, unitBox, emit('#e1b88d', .36), [x, .765, z], [.24, .025, .33]);
    page.rotation.y = .21;
    this.objects.set(id, { indicator: page, kind: 'clue' });
  }

  makeHazard(tile) {
    const phase = tile.kind === '~' ? 'day' : 'night';
    const group = this.groups[phase];
    const b = this.batches[phase];
    const { x, z } = tile;
    const m = this.materials;
    for (let n = -4; n <= 4; n++) {
      b.box(m.dark, x + n * .14, .022, z, .072, .03, .95);
    }
    b.box(m.accent, x, .015, z - .58, 1.53, .024, .055);
    b.box(m.accent, x, .015, z + .58, 1.53, .024, .055);
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, color: phase === 'day' ? '#d6a997' : '#8f9efa', depthWrite: false, transparent: true, opacity: .24
    }));
    pulse.position.set(x, .48, z);
    pulse.scale.set(.95, 1.36, 1);
    group.add(pulse);
    this.objects.set(`hazard-${tile.col}-${tile.row}`, { indicator: pulse, kind: 'hazard', seed: tile.col * 2 + tile.row });
  }

  makeDoor(tile) {
    const { x, z } = tile;
    const m = this.materials;
    let face = [0, 1];
    for (const [dx, dz] of FACES) {
      if (this.decoded.get(tile.col + dx, tile.row + dz)?.kind === '#' || !this.decoded.get(tile.col + dx, tile.row + dz)) {
        face = [dx, dz];
        break;
      }
    }
    const [dx, dz] = face;
    const g = new THREE.Group();
    g.position.set(x + dx * .71, 0, z + dz * .71);
    g.rotation.y = Math.atan2(dx, dz);
    this.stage.add(g);
    for (const edge of [-1, 1]) {
      mesh(g, unitBox, m.dark, [.86 * edge, 1.22, 0], [.13, 2.44, .21]);
      mesh(g, unitBox, m.copper, [.82 * edge, 1.23, -.11], [.034, 2.44, .036]);
    }
    mesh(g, unitBox, m.dark, [0, 2.49, 0], [1.86, .18, .25]);
    mesh(g, unitBox, m.dark, [0, .035, 0], [1.80, .07, .25]);
    this.door = new THREE.Group();
    g.add(this.door);
    mesh(this.door, unitBox, m.steel, [0, 1.22, 0], [1.55, 2.42, .125]);
    for (let i = 0; i < 10; i++) {
      const y = .17 + i * .227;
      mesh(this.door, unitBox, m.dark, [0, y, -.07], [1.55, .044, .030]);
      mesh(this.door, unitBox, m.copper, [0, y + .04, -.082], [1.43, .014, .018]);
    }
    const label = spriteText(this.theme === 2 ? 'EXIT' : 'SERVICE LIFT', '#9ce6cf', 'EMERGENCY ACCESS');
    this.localTextures.push(label);
    placeSign(this.stage, label, x + dx * .49, 2.12, z + dz * .49, 1.36, .34);
    this.doorLight = this.lightSource(x - dx * .18, 2.37, z - dz * .18, 13, 'safe', .83);
  }

  makeSkyline() {
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: { night: { value: 0 }, time: { value: 0 } },
      vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.sky = mesh(this.stage, new THREE.SphereGeometry(126, 36, 19), skyMaterial, [0, 0, 0], [1, 1, 1]);
    this.sky.castShadow = false;
    this.sky.receiveShadow = false;
    this.sky.renderOrder = -3;
    this.sky.frustumCulled = false;
    const b = this.batches.neutral;
    const m = this.materials;
    const rng = random(3197);
    const mx = this.decoded.width * TILE / 2;
    const mz = this.decoded.depth * TILE / 2;
    const city = standard('#36434d', { roughness: 1, fog: false });
    const windows = new THREE.MeshBasicMaterial({ color: '#b3a076', fog: false });
    const street = new THREE.MeshBasicMaterial({ color: '#453738', fog: false });
    this.materials.city = city;
    this.materials.windows = windows;
    this.materials.street = street;
    b.box(street, mx, -20, mz, 216, .1, 216);
    const radius = Math.hypot(mx, mz) + 17;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2;
      const r = radius + rng() * 16;
      const x = mx + Math.cos(angle) * r;
      const z = mz + Math.sin(angle) * r;
      const width = 2 + rng() * 5;
      const depth = 2.5 + rng() * 4;
      const h = 5 + rng() * 22;
      b.box(city, x, (h + 3) / 2 - 20, z, width, h + 3, depth, 0, tint(rng()));
      if (i % 3 === 0) b.box(m.dark, x, h - 15.9, z, .08, 2.4, .08);
      for (let y = h - 17.8; y > Math.max(-10, h - 26); y -= .7) {
        for (let u = -width * .4; u < width * .4; u += .65) {
          if (rng() > .64) b.box(windows, x + u, y, z + (mz > z ? 1 : -1) * (depth / 2 + .013), .28, .16, .018);
        }
        for (let u = -depth * .4; u < depth * .4; u += .65) {
          if (rng() > .68) b.box(windows, x + (mx > x ? 1 : -1) * (width / 2 + .013), y, z + u, .018, .16, .26);
        }
      }
    }
  }

  makeParticles() {
    const count = this.theme === 2 ? 190 : 95;
    const positions = new Float32Array(count * 3);
    const rng = random(200 + this.theme);
    this.flakes = Array.from({ length: count }, () => [rng(), rng(), rng(), .25 + rng()]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: this.theme === 2 ? '#c8deed' : '#e2c6a4', map: this.glow, size: .036,
      transparent: true, depthWrite: false, opacity: .44, blending: THREE.AdditiveBlending
    }));
    this.particles.frustumCulled = false;
    this.stage.add(this.particles);
  }

  makeGhost() {
    const g = new THREE.Group();
    const cloak = new THREE.MeshStandardMaterial({
      color: '#192727', emissive: '#234b50', emissiveIntensity: .5,
      transparent: true, opacity: .83, depthWrite: false, roughness: .52
    });
    const headMaterial = emit('#9dc2c3', .34);
    const eyesMaterial = new THREE.MeshBasicMaterial({ color: '#c2f6f3', toneMapped: false });
    const drape = new THREE.LatheGeometry([
      new THREE.Vector2(.03, 0), new THREE.Vector2(.16, .22), new THREE.Vector2(.22, .45),
      new THREE.Vector2(.32, .73), new THREE.Vector2(.39, 1.02), new THREE.Vector2(.29, 1.13)
    ], 12);
    mesh(g, drape, cloak, [0, .27, 0], [1, 1, .65]);
    mesh(g, unitSphere, cloak, [0, 1.36, 0], [.68, .47, .37]);
    mesh(g, unitSphere, headMaterial, [0, 1.72, .036], [.33, .44, .30]);
    mesh(g, unitSphere, cloak, [0, 1.80, -.095], [.38, .41, .25]);
    const mask = new THREE.MeshBasicMaterial({ color: '#17262b' });
    mesh(g, unitSphere, mask, [0, 1.67, .158], [.25, .22, .079]);
    const eyes = [-.077, .077].map(x => mesh(g, unitSphere, eyesMaterial, [x, 1.76, .165], [.07, .034, .021]));
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Group();
      arm.position.set(side * .27, 1.38, 0);
      arm.rotation.z = side * .25;
      g.add(arm);
      mesh(arm, unitSphere, cloak, [0, -.28, 0], [.16, .70, .16]);
      for (let i = 0; i < 3; i++) {
        mesh(arm, unitSphere, headMaterial, [(i - 1) * .038, -.65, .028], [.035, .17, .045]);
      }
      return arm;
    });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#bdf4f1', opacity: .2
    }));
    halo.position.set(0, 1.63, -.07);
    halo.scale.set(1.2, 1.55, 1);
    g.add(halo);
    this.stage.add(g);
    return { g, cloak, eyes, eyesMaterial, arms, halo };
  }

  makeAttack() {
    const group = new THREE.Group();
    this.camera.add(group);
    group.visible = false;
    const sleeve = new THREE.MeshBasicMaterial({ color: '#233137' });
    const skin = new THREE.MeshBasicMaterial({ color: '#526d6d' });
    const nails = new THREE.MeshBasicMaterial({ color: '#a2aba1' });
    const pad = new THREE.MeshBasicMaterial({ color: '#3d5354' });
    const hands = [-1, 1].map(side => {
      const hand = new THREE.Group();
      hand.rotation.y = side * .26;
      group.add(hand);
      const forearm = mesh(hand, unitSphere, sleeve, [side * .059, -.17, .055], [.133, .46, .113]);
      forearm.rotation.z = side * .27;
      mesh(hand, unitSphere, skin, [0, .047, -.025], [.113, .16, .065]);
      mesh(hand, unitSphere, pad, [0, .074, .001], [.096, .113, .040]);
      const fingers = [];
      for (let i = 0; i < 4; i++) {
        const finger = new THREE.Group();
        finger.position.set((i - 1.5) * .032, .115, -.022);
        finger.rotation.z = (i - 1.5) * side * -.13;
        hand.add(finger);
        const length = [.076, .097, .103, .081][i];
        mesh(finger, unitSphere, skin, [0, length * .50, 0], [.021, length * 1.25, .027]);
        mesh(finger, unitSphere, pad, [0, length * .53, .004], [.022, .025, .027]);
        const tip = mesh(finger, unitSphere, nails, [0, length * 1.04, -.014], [.014, .030, .015]);
        tip.rotation.x = -.41;
        fingers.push(finger);
      }
      const thumb = mesh(hand, unitSphere, skin, [-side * .068, .045, -.02], [.043, .105, .042]);
      thumb.rotation.z = side * -.45;
      return { hand, side, fingers };
    });
    group.traverse(object => {
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return { group, hands };
  }

  updateAttack(state, lifeTime, reduced) {
    const { group, hands } = this.attack;
    group.visible = state.life === 'dying' && state.deathCause === 'ghost';
    if (!group.visible) return;
    const grab = THREE.MathUtils.smoothstep(lifeTime, .02, .25);
    const clutch = THREE.MathUtils.smoothstep(lifeTime, .19, .42);
    const drop = THREE.MathUtils.smoothstep(lifeTime, .65, 1.06);
    for (const { hand, side, fingers } of hands) {
      hand.position.set(side * (.55 - grab * .36 + drop * .23), -.39 + grab * .34 - drop * .22, -.50 - grab * .16);
      hand.rotation.z = side * (.62 + grab * .39 + drop * .29);
      hand.rotation.x = -.2 + clutch * .43 + (reduced ? 0 : Math.sin(lifeTime * 18) * .04);
      for (const [i, finger] of fingers.entries()) finger.rotation.x = -.19 + clutch * (.96 - i * .09);
    }
  }

  updateGhosts(state) {
    const seen = new Set();
    for (const [index, ghost] of (state.ghosts || []).entries()) {
      const key = ghost.key ?? ghost.id ?? index;
      seen.add(key);
      let actor = this.ghosts.get(key);
      if (!actor) {
        actor = this.makeGhost();
        this.ghosts.set(key, actor);
      }
      const visible = ghost.active !== false && (ghost.phase !== 'night' || state.night) && (ghost.phase !== 'day' || !state.night);
      actor.g.visible = visible;
      if (!visible) continue;
      const time = state.time || 0;
      const threat = typeof ghost.alert === 'number' ? ghost.alert : Number(Boolean(ghost.chase || ghost.state === 'chase'));
      actor.g.position.set(ghost.x, Math.sin(time * 3.6 + index) * .044 + (ghost.y || 0), ghost.z);
      actor.g.rotation.y = Math.atan2(state.x - ghost.x, state.z - ghost.z);
      actor.cloak.opacity = .82 + Math.sin(time * 9 + index * 7) * .06;
      actor.eyesMaterial.color.set(threat > .4 ? '#ff9c5a' : '#b0ffed');
      actor.halo.material.opacity = .14 + threat * .12;
      for (let i = 0; i < 2; i++) {
        actor.arms[i].rotation.x = -.15 - threat * .74 + Math.sin(time * 4 + i * 2) * .11;
        actor.arms[i].rotation.z = (i === 0 ? 1 : -1) * (.15 + threat * .06);
      }
    }
    for (const [key, actor] of this.ghosts) if (!seen.has(key)) actor.g.visible = false;
  }

  resize(quality = 'high') {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1280);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 720);
    const rawRatio = globalThis.devicePixelRatio || 1;
    const ratio = Math.min(rawRatio, SIZE[quality] || SIZE.high, 1920 / width, 1080 / height);
    if (this.size[0] === width && this.size[1] === height && this.size[2] === ratio) return;
    this.size = [width, height, ratio];
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    const rw = Math.max(1, Math.floor(width * ratio));
    const rh = Math.max(1, Math.floor(height * ratio));
    this.frameTarget.setSize(rw, rh);
    this.grade.uniforms.texel.value.set(1 / rw, 1 / rh);
  }

  updateLights(state, time, night) {
    const roof = this.theme === 2;
    this.fill.color.set('#dce3ed').lerp(COLD, night * .8);
    this.fill.intensity = roof ? 1.65 - night * .33 : 1.17 - night * .42;
    this.rim.color.copy(WARM).lerp(COLD, night);
    this.rim.intensity = roof ? 1.85 - night * .18 : .64 - night * .12;
    this.lamp.color.copy(WARM).lerp(PALE, night);
    this.lamp.position.copy(this.camera.position);
    this.lamp.position.y -= .11;
    this.lamp.target.position.copy(this.camera.position).addScaledVector(this.view, 18);
    this.lamp.intensity = (roof ? 5.8 : 10.2) + night * 12 + Math.sin(time * 18) * .15 * night;
    this.eyeFill.position.copy(this.camera.position);
    this.eyeFill.intensity = .55 + night * .66;
    const near = this.ambience
      .map(source => ({ source, distance: (source.x - state.x) ** 2 + (source.z - state.z) ** 2 }))
      .filter(entry => entry.distance < 20 ** 2)
      .sort((a, b) => a.distance - b.distance);
    for (let i = 0; i < this.nearLights.length; i++) {
      const light = this.nearLights[i];
      const entry = near[i];
      if (!entry) {
        light.intensity = 0;
        continue;
      }
      const { source, distance } = entry;
      light.position.set(source.x, source.y, source.z);
      const seed = source.x * 33 + source.z * 5;
      const pulse = .84 + .13 * Math.sin(time * 4 + seed) + .03 * Math.sin(time * 15 + seed);
      light.color.copy(source.color);
      if (source.type === 'general') light.color.lerp(COLD, night * .91);
      light.intensity = source.strength * pulse * (1 - Math.min(1, distance / 400) ** 1.4);
    }
    for (const source of this.ambience) {
      if (source.type === 'general') source.sprite.material.color.copy(WARM).lerp(COLD, night * .9);
      source.sprite.material.opacity = .23 + .08 * Math.sin(time * 1.75 + source.x * .4) + night * .08;
    }
    for (const { tile, pool, beacon } of this.safeLamps) {
      const active = state.checkpoint === tile || state.checkpoint === `${tile.col}/${tile.row}`;
      pool.material.opacity = active ? .31 + .06 * Math.sin(time * 3) : .12;
      if (active) beacon.material.opacity += .15;
    }
  }

  render(state, dt) {
    if (!this.stage) return;
    const quality = typeof state.quality === 'string' ? state.quality.toLowerCase() : 'high';
    const reduced = state.reducedMotion || state.reduceMotion || state.reducedEffects;
    const time = state.time || 0;
    const lifeTime = state.lifeTimer ?? state.lifeTime ?? 0;
    const dying = ['dying', 'dead'].includes(state.life);
    const revival = ['respawning', 'reviving'].includes(state.life);
    const hurt = state.life === 'hurt';
    const target = state.night ? 1 : 0;
    this.nightBlend = THREE.MathUtils.lerp(this.nightBlend, target, Math.min(1, dt * 13.5));
    const night = this.nightBlend;
    const shift = Math.min(1, Math.max(0, state.shiftFx || 0));
    this.groups.day.visible = !state.night;
    this.groups.night.visible = Boolean(state.night);
    this.scene.background.copy(this.fogWarm).lerp(this.fogCold, night);
    this.scene.fog.color.copy(this.scene.background);
    this.scene.fog.density = (this.theme === 2 ? .016 : .042) + night * (this.theme === 2 ? .003 : .024);
    this.resize(quality);

    const distance = this.last ? Math.hypot(state.x - this.last.x, state.z - this.last.z) : 0;
    this.last = { x: state.x, z: state.z };
    this.velocity = THREE.MathUtils.lerp(this.velocity, Math.min(6, distance / Math.max(dt, .008)), Math.min(1, dt * 9));
    this.walk += this.velocity * dt * 2.8;
    const bob = reduced ? 0 : Math.sin(this.walk) * this.velocity * .011;
    const lean = reduced ? 0 : Math.cos(this.walk * .52) * this.velocity * .003;
    const collapse = dying ? Math.min(1, Math.abs(lifeTime) * 1.25 + .14) :
      revival ? .57 * (1 - THREE.MathUtils.smoothstep(lifeTime, .08, .63)) : 0;
    this.camera.position.set(state.x, (state.y || 0) + EYE + bob - collapse * 1.19, state.z);
    const yaw = state.yaw || 0;
    const pitch = (state.pitch || 0) - (reduced ? 0 : collapse * .17);
    this.view.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(delta.copy(this.camera.position).add(this.view));
    this.camera.rotateZ(lean + (reduced ? 0 : collapse * .31));
    const fov = 65 + (state.sprint || state.sprinting ? 4 : 0) + shift * (reduced ? 0 : 2.5);
    if (Math.abs(this.camera.fov - fov) > .01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, Math.min(1, dt * 9));
      this.camera.updateProjectionMatrix();
    }
    this.updateLights(state, time, night);
    this.updateGhosts(state);
    this.updateAttack(state, lifeTime, reduced);
    const door = Math.min(1, Math.max(0, state.door || 0));
    const slide = door * door * (3 - 2 * door);
    this.door.position.y = slide * 2.28;
    this.door.scale.y = 1 - slide * .91;
    this.door.visible = door < .99;
    this.doorLight.scale.setScalar(.78 + slide * .12);
    this.updateProps(state, time);
    if (this.sky) {
      this.sky.position.copy(this.camera.position);
      this.sky.material.uniforms.night.value = night;
      this.sky.material.uniforms.time.value = time;
      this.materials.street.color.set('#463938').lerp(this.fogCold, night);
    }
    for (const { rotor, speed } of this.kinetics) rotor.rotateZ(dt * speed * (1 - night * .92));
    this.updateParticles(state, time, quality);
    if (quality !== this.renderQuality) {
      this.renderQuality = quality;
      this.renderer.shadowMap.enabled = quality === 'high';
      this.lamp.castShadow = quality === 'high';
    }
    const uniforms = this.grade.uniforms;
    uniforms.time.value = time;
    uniforms.night.value = night;
    uniforms.shift.value = shift * (reduced ? .14 : 1);
    uniforms.life.value = (dying || revival ? .7 : 0) * (reduced ? .35 : 1);
    uniforms.danger.value = dying ? 1 : hurt ? .6 : Math.max(0, 3 - (state.hp ?? 3)) * .19;
    if (quality === 'low') {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.renderer.setRenderTarget(this.frameTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  updateProps(state, time) {
    for (const [key, object] of this.objects) {
      if (object.kind === 'hazard') {
        const pulse = Math.max(0, Math.sin(time * 2.62 + object.seed));
        object.indicator.material.opacity = .075 + pulse * .22;
        object.indicator.scale.y = .67 + pulse * .95;
      } else if (object.kind === 'clue') {
        object.indicator.visible = !(state.clues?.has?.(key) || state.evidence?.has?.(key) || state.completed?.has?.(key));
      } else {
        const done = object.kind === 'power' ? state.powered ?? state.progress?.powered : state.completed?.has?.(key);
        const material = object.indicator.material;
        material.color.set(done ? '#71d9ad' : '#e8b262');
        material.emissive.copy(material.color);
        material.emissiveIntensity = done ? 1.4 : 1.15 + Math.sin(time * 4) * .33;
        const axis = this.theme === 1 ? 'x' : 'z';
        object.action.rotation[axis] = THREE.MathUtils.lerp(object.action.rotation[axis], done ? (this.theme === 0 ? 2.08 : .52) : 0, .10);
      }
    }
  }

  updateParticles(state, time, quality) {
    if (!this.particles) return;
    const shown = quality !== 'low';
    this.particles.visible = shown;
    if (!shown) return;
    const attribute = this.particles.geometry.getAttribute('position');
    const wrap = x => x - Math.floor(x);
    for (const [i, [a, b, c, speed]] of this.flakes.entries()) {
      attribute.setXYZ(
        i, state.x + (wrap(a + time * .014 * speed) - .5) * 29,
        wrap(b + time * (this.theme === 2 ? -.29 : .037) * speed) * (this.theme === 2 ? 7 : 3.13),
        state.z + (wrap(c + time * .009 * speed) - .5) * 27
      );
    }
    attribute.needsUpdate = true;
  }
}
