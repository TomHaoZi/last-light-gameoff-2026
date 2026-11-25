import { preloadMourningFigure } from './mourning-figure.js';
import * as THREE from 'three';
import { applyWorldWeather, createSurfaceSet } from './surfaces.js';
import { decorateModels } from './models.js';
import { mountEnvironment } from './environment-assets.js';
import { FrameBudget } from './frame-budget.js';
import { mountPhotoSurfaces } from './photo-surfaces.js';
import { makeReflectionProbe, makeAtmosphere } from './lighting.js';
import { createCreature, isSharedCreatureGeometry, preloadCreatureAsset, scheduleOfficeCreatureTextures, updateCreature } from './creature.js';
import { makeOfficeProgramWarmup } from './office-phase-programs.js';
import { waitForRenderIdle } from './render-idle.js';
import { JanitorHands } from './janitor-hands.js';
import { mountBackroomsSet, preloadBackroomsSet } from './backrooms-set.js';
import { BACKROOMS_TRACK } from './backrooms-track.js';
import { AirEffects } from './air-effects.js';
import { mountServiceLift, poseServiceLift } from './service-lift.js';
import { mountStationTrace } from './station-traces.js';
import { mountWorkstations, updateWorkstation } from './workstation-models.js';
import { mountWallSigns } from './set-dressing.js';

const TILE = 2.4;
const HALF = TILE / 2;
const EYE = 1.66;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const FACES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const PHASE = { d: 'day', n: 'night' };
const PROPS = new Set(['.', 'G', 'H', 'J']);
const SIZE = { low: .80, medium: 1.2, high: 1.85 };
const BATCH_SECTOR = TILE * 8;
const WARM = new THREE.Color('#ffd8a5');
const COLD = new THREE.Color('#9bcfea');
const YELLOW = new THREE.Color('#ffb95a');
const PALE = new THREE.Color('#b8e8ff');
const SAFE = new THREE.Color('#72e6bf');
const OFFICE_LIGHT = new THREE.Color('#f3efcf');
const STATION_TITLES = [
  { A: 'PRESSURE', B: 'COOLING', C: 'INTERLOCK' },
  { A: 'REGISTER', B: 'CORRECTION', C: 'LUNCHBOX' },
  { A: 'FIRST BED', B: 'WEST BEDS', C: 'TANK FEED' }
];
const BOILER = {
  floor: '#696460', wall: '#6c6159', ceiling: '#4e453c', low: '#261c18',
  daySky: '#302520', nightSky: '#152230', steel: '#586263', accent: '#b36b30'
};
const OFFICE = {
  floor: '#61564d', wall: '#a8a295', ceiling: '#857d6b', low: '#302622',
  daySky: '#3d3831', nightSky: '#16272e', steel: '#626f74', accent: '#725049'
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
const unitCylinder = new THREE.CylinderGeometry(.5, .5, 1, 24);
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
      const sectors = new Map();
      for (const entry of entries) {
        const x = entry.matrix.elements[12];
        const z = entry.matrix.elements[14];
        const sector = entries.length < 48 ? '' :
          Math.floor(x / BATCH_SECTOR) + '/' + Math.floor(z / BATCH_SECTOR);
        if (!sectors.has(sector)) sectors.set(sector, []);
        sectors.get(sector).push(entry);
      }
      for (const instances of sectors.values()) {
        const batch = new THREE.InstancedMesh(geometry, material, instances.length);
        // These objects never move. Each instance already holds its world placement.
        batch.matrixAutoUpdate = false;
        for (const [i, entry] of instances.entries()) {
          batch.setMatrixAt(i, entry.matrix);
          if (entry.color) batch.setColorAt(i, entry.color);
        }
        batch.castShadow = !material.isMeshBasicMaterial && material.userData.castShadow !== false;
        batch.receiveShadow = !material.isMeshBasicMaterial;
        batch.computeBoundingSphere();
        this.group.add(batch);
      }
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
  gl_Position.z = gl_Position.w;
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
float fbm(vec2 p) {
  mat2 turn = mat2(.86, .51, -.51, .86);
  float value = 0.;
  float weight = .54;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * weight;
    p = turn * p * 2.06 + vec2(24.7, 17.4);
    weight *= .5;
  }
  return value;
}
void main() {
  vec3 d = normalize(direction);
  float h = max(d.y, 0.0);
  vec3 sunset = mix(vec3(.38,.20,.117), vec3(.053,.16,.29), smoothstep(0.,.61,sqrt(h)));
  vec3 darkness = mix(vec3(.022,.044,.076), vec3(.003,.010,.033), smoothstep(0.,.63,sqrt(h)));
  vec3 sun = normalize(vec3(-.64,.15,-.75));
  vec3 moon = normalize(vec3(.28,.44,-.75));
  float sundot = max(dot(d,sun),0.0);
  float moondot = max(dot(d,moon),0.0);
  sunset += vec3(.45,.19,.058) * pow(sundot,8.0) * (1.0 - h * .68);
  sunset += vec3(5.0,2.45,.85) * smoothstep(.99954,.99976,sundot);
  darkness += vec3(.048,.083,.141) * pow(moondot,24.);
  darkness += vec3(.91,1.20,1.40) * smoothstep(.99978,.99989,moondot);
  vec3 sky = mix(sunset,darkness,night);

  vec2 plane = d.xz / max(d.y + .115, .08);
  vec2 p = plane * vec2(1.7, 1.42) + vec2(time * .014, -time * .007);
  float clumps = fbm(p);
  float front = smoothstep(.53, .69, clumps) * smoothstep(.0,.17,h);
  float obliqueLight = max(0.0, clumps - fbm(p + vec2(.19,.13))) * 3.2;
  vec3 cloudDay = mix(vec3(.126,.106,.137),vec3(.69,.38,.23),clamp(obliqueLight + pow(sundot, 4.) * .52,0.,1.));
  vec3 cloudNight = mix(vec3(.008,.015,.037),vec3(.059,.09,.137),clamp(obliqueLight,0.,1.));
  sky = mix(sky, mix(cloudDay,cloudNight,night), front * .82);
  float highSheet = smoothstep(.55,.75, fbm(plane * vec2(4.9, .92) - vec2(time * .009,11.0)));
  sky += highSheet * smoothstep(.10,.34,h) * mix(vec3(.115,.14,.22),vec3(.012,.022,.043),night) * (1.0-front);
  vec2 stars = vec2(atan(d.z,d.x)/6.283185 + .5,h) * vec2(860.0,385.0);
  float star = (1.0 - smoothstep(.04,.15,length(fract(stars)-.5))) * step(.993,hash(floor(stars)));
  sky += vec3(.26,.36,.61) * star * night * smoothstep(.12,.31,h) * (1.0-front);
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
uniform sampler2D depthTex;
uniform sampler2D shaftsTex;
uniform vec2 texel;
uniform float nearPlane;
uniform float farPlane;
uniform float shafts;
uniform float effects;
uniform float night;
uniform float shift;
uniform float life;
uniform float lifeJitter;
uniform float danger;
varying vec2 coords;
// The same six directions as cos/sin(.37), stepping by 1.0472 radians.
const vec2 contactDirections[6] = vec2[6](
  vec2(.932327330, .361615449), vec2(.152993128, .988227248),
  vec2(-.779334784, .626607776), vec2(-.932324767, -.361622065),
  vec2(-.152986094, -.988228321), vec2(.779339433, -.626601934)
);
float eyeDepth(vec2 uv) {
  float d = texture2D(depthTex, uv).r;
  return nearPlane * farPlane / (farPlane - d * (farPlane - nearPlane));
}
float contact(vec2 uv, float depth) {
  vec2 radius = texel * clamp(45.0 / max(depth, 1.2), 2.5, 20.0);
  float result = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 offset = contactDirections[i] * radius;
    float delta = depth - eyeDepth(uv + offset);
    result += smoothstep(.04, .17, delta) * (1.0 - smoothstep(.38, .98, delta));
  }
  return result / 6.0;
}
vec3 glowSample(vec2 uv) {
  vec3 color = texture2D(frameTex, uv).rgb;
  float brightness = max(max(color.r,color.g),color.b);
  return color * smoothstep(.55, 2.2, brightness);
}
void main() {
  vec2 uv = coords;
  vec2 center = uv - .5;
  float range = length(center);
  float ripple = 0.0;
  if (shift > 0.0) {
    float surge = length(center * vec2(1.32, .90));
    float edge = abs(surge - (1.0 - shift) * .83);
    ripple = shift * (1.0 - smoothstep(.004, .046, edge)) * (.72 + .28 * abs(center.y * 2.0));
  }
  vec2 jitter = center * (lifeJitter + .014 * ripple);
  vec2 sampleUv = uv + jitter;
  vec3 base = texture2D(frameTex, sampleUv).rgb;
  float spread = .0038 * ripple + .0025 * life;
  if (spread > .0001) {
    base.r = texture2D(frameTex,sampleUv+center*spread).r;
    base.b = texture2D(frameTex,sampleUv-center*spread).b;
  }
  if (shift > .15 && effects > .5) {
    // A brief change in reflected light travels along the surfaces in this phase.
    float distanceToWall = eyeDepth(sampleUv);
    float radius = .18 + 22.0 * (1.0 - shift) * (1.0 - shift);
    float band = (1.0 - smoothstep(.12, .32 + radius*.055, abs(distanceToWall-radius))) * shift;
    vec3 bounce = mix(vec3(.23,.12,.037),vec3(.06,.17,.23),night);
    base += bounce * band * (.16 + min(1.0, dot(base,vec3(.3,.59,.11))));
  }
  if (effects > .5) {
    float depth = eyeDepth(sampleUv);
    if (depth < 21.0) base *= 1.0 - contact(sampleUv, depth) * .36;
  }
  vec2 offset = texel * 5.0;
  vec3 glow = glowSample(sampleUv+offset) + glowSample(sampleUv-offset)
    + glowSample(sampleUv+vec2(-offset.x,offset.y)) + glowSample(sampleUv+vec2(offset.x,-offset.y));
  base += glow * .045;
  if (shafts > .5) base += texture2D(shaftsTex, sampleUv).rgb;
  float vignette = 1.0 - smoothstep(.24,.76,range) * (.19+.13*night+.27*life);
  base *= vignette;
  base = mix(base,base*vec3(.81,1.01,1.12),night*.41);
  base += mix(vec3(.085, .052, .028), vec3(.019, .053, .073), night) * ripple;
  base = mix(base,base*vec3(1.29,.59,.56),smoothstep(.26,.71,range)*danger*.56);
  gl_FragColor = vec4(max(base,0.),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Visual {
  constructor(canvas) {
    this.canvas = canvas;
    this.frameBudget = new FrameBudget();
    this.desktopPointer = matchMedia('(pointer: fine)');
    this.overlayFrame = null;
    this.wasPlaying = false;
    this.scene = new THREE.Scene();
    this.scene.matrixAutoUpdate = false;
    this.camera = new THREE.PerspectiveCamera(66, 1, .045, 143);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowTime = -1;
    this.shadowPosition = new THREE.Vector3();
    canvas.ownerDocument.addEventListener('visibilitychange', () => {
      if (!canvas.ownerDocument.hidden) this.overlayFrame = null;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.overlayFrame = null;
      this.shadowTime = -1;
      this.phasePrograms = null;
    });
    this.renderer.setClearColor('#11181d');
    this.probes = new Map();
    this.atmosphere = makeAtmosphere();
    this.janitorHands = new JanitorHands(this.camera);
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
      samples: sampleFormats?.length ? Math.min(2, sampleFormats[0]) : 0,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType)
    });
    this.postScene = new THREE.Scene();
    this.grade = new THREE.ShaderMaterial({
      uniforms: {
        frameTex: { value: this.frameTarget.texture }, texel: { value: new THREE.Vector2(1, 1) },
        depthTex: { value: this.frameTarget.depthTexture }, shaftsTex: { value: this.atmosphere.target.texture },
        nearPlane: { value: this.camera.near }, farPlane: { value: this.camera.far },
        shafts: { value: 0 }, effects: { value: 1 },
        night: { value: 0 }, shift: { value: 0 }, life: { value: 0 },
        lifeJitter: { value: 0 }, danger: { value: 0 }
      },
      vertexShader: POST_VERTEX, fragmentShader: POST_FRAGMENT,
      depthTest: false, depthWrite: false
    });
    this.postScene.add(new THREE.Mesh(unitPlane, this.grade));
    this.postCamera = new THREE.Camera();
    this.glow = glowTexture();
    this.stage = null;
    this.view = new THREE.Vector3();
    this.captureTarget = new THREE.Vector3();
    this.last = null;
    this.velocity = 0;
    this.walk = 0;
    this.nightBlend = 0;
    this.creatureExposure = 1;
    this.size = [0, 0, 0];
  }

  load(level, decoded) {
    if (this.stage) this.clearStage();
    this.frameBudget.resetMeasurement();
    this.overlayFrame = null;
    this.phasePrograms = null;
    this.decoded = decoded;
    this.preloadTransfer = level.id === 'office';
    this.theme = ['boiler', 'office', 'roof'].indexOf(level.theme || level.id);
    if (this.theme < 0) this.theme = /roof|garden|antenna/i.test(level.id) ? 2 : /office|archive/i.test(level.id) ? 1 : 0;
    this.palette = [BOILER, OFFICE, ROOF][this.theme];
    const outdoors = this.theme === 2;
    if (!this.probes.has(outdoors)) this.probes.set(outdoors, makeReflectionProbe(outdoors));
    this.scene.environment = this.probes.get(outdoors);
    this.stage = new THREE.Group();
    this.stage.matrixAutoUpdate = false;
    this.scene.add(this.stage);
    this.objects = new Map();
    this.ambience = [];
    this.nearestFixtures = [];
    this.fixtureSearchTime = -Infinity;
    this.kinetics = [];
    this.safeLamps = [];
    this.localTextures = [];
    this.last = null;
    this.velocity = 0;
    this.walk = 0;
    this.nightBlend = 0;
    this.creatureExposure = 1;
    this.shadowTime = -1;
    this.ghosts = new Map();
    this.fogWarm = new THREE.Color(this.palette.daySky);
    this.fogCold = new THREE.Color(this.palette.nightSky);
    this.scene.background = this.fogWarm.clone();
    this.scene.fog = new THREE.FogExp2(this.fogWarm, this.theme === 2 ? .019 : .058);
    this.materials = this.makeMaterials();
    this.materials.floor.userData.castShadow = false;
    this.groups = { neutral: this.stage, day: new THREE.Group(), night: new THREE.Group() };
    this.groups.day.matrixAutoUpdate = false;
    this.groups.night.matrixAutoUpdate = false;
    this.stage.add(this.groups.day, this.groups.night);
    this.batches = {
      neutral: new Batch(this.groups.neutral), day: new Batch(this.groups.day), night: new Batch(this.groups.night)
    };

    if (level.id === 'backrooms') {
      this.fogWarm.set('#686344');
      this.fogCold.set('#384c50');
      this.air = new AirEffects(this.stage);
      this.liftLeaves = this.door = this.doorMount = this.doorLight = null;
      this.backroomsSet = mountBackroomsSet(this, BACKROOMS_TRACK);
      Object.values(this.batches).forEach(batch => batch.build());
      this.addCreature('transfer-pursuer', 0);
      this.workstationsReady = this.surfacesReady = Promise.resolve();
      this.environmentReady = this.backroomsSet.ready;
      const stage = this.stage;
      this.environmentReady.then(() => { if (this.stage === stage) this.overlayFrame = null; });
      return;
    }

    for (const wall of decoded.walls) this.makeWall(wall);
    for (const floor of decoded.floors) this.makeFloor(floor);
    if (decoded.shortcut) this.markShortcut(decoded.shortcut.pads);
    this.makePropClusters();
    this.makeArrival();
    decorateModels(this);
    mountWallSigns(this, TILE);
    for (const lamp of decoded.lamps) this.makeSafeLamp(lamp);
    for (const station of decoded.stations) this.makeStation(station);
    if (decoded.power) this.makeStation(decoded.power, true);
    mountStationTrace(this);
    for (const clue of decoded.clues) this.makeClue(clue);
    for (const note of decoded.notes || []) this.makePhonographMarker(note);
    for (const hazard of decoded.hazards) this.makeHazard(hazard);
    this.air = new AirEffects(this.stage);
    this.liftLeaves = null;
    this.makeDoor(decoded.exit);
    if (this.theme === 2) this.makeSkyline();
    Object.values(this.batches).forEach(batch => batch.build());
    this.makeParticles();
    this.workstationsReady = mountWorkstations(this);
    this.environmentReady = mountEnvironment(this);
    this.surfacesReady = mountPhotoSurfaces(this);
    const stage = this.stage;
    const redraw = () => { if (this.stage === stage) this.overlayFrame = null; };
    for (const ready of [this.environmentReady, this.workstationsReady, this.surfacesReady, preloadCreatureAsset()]) ready.then(redraw, redraw);
    // Sculpt both phases at chapter entry so Shift never has to build a mesh.
    decoded.ghosts.forEach((tile, index) => this.addCreature(tile.col + '/' + tile.row, index, level.id === 'office' ? 'mourning' : null));
  }

  addCreature(key, index, kind) {
    const actor = createCreature(index, this.theme, this.renderer, kind);
    actor.group.visible = false;
    this.stage.add(actor.group);
    this.ghosts.set(key, actor);
    return actor;
  }

  preparePhasePrograms() {
    if (!this.desktopPointer.matches) return;
    const { renderer, stage } = this;
    const office = this.theme === 1;
    if (this.theme <= 1 && !this.officeTextureWarmupScheduled) {
      this.officeTextureWarmupScheduled = true;
      scheduleOfficeCreatureTextures(renderer);
    }
    if (this.phasePrograms || !renderer.extensions.has('KHR_parallel_shader_compile')) return;
    const actors = [...this.ghosts.values()];
    const nightActors = office ? this.decoded.ghosts.filter(tile => tile.phase === 'night')
      .map(tile => this.ghosts.get(tile.col + '/' + tile.row)).filter(Boolean) : [];
    const targets = [...nightActors, this.groups.night, this.groups.day, this.air.mesh, ...actors.filter(actor => !nightActors.includes(actor))];
    const isCurrent = () => this.stage === stage && this.phasePrograms === task &&
      this.renderQuality === 'high' && !renderer.getContext().isContextLost();
    const finishOfficeProgram = office ? makeOfficeProgramWarmup(renderer, stage, this.rig, this.lamp.shadow, isCurrent) : null;
    const prepare = async () => {
      for (const target of targets) {
        const actor = target.group ? target : null;
        const authored = actor && await (actor.kind === 'mourning' ? preloadMourningFigure() : preloadCreatureAsset());
        await waitForRenderIdle();
        if (this.stage !== stage || this.phasePrograms !== task || renderer.getContext().isContextLost()) return;
        if (this.renderQuality !== 'high') {
          this.phasePrograms = null;
          return;
        }
        if (actor && authored && !actor.group.userData.authoredCreature) updateCreature(actor, { time: 0 });
        const previous = renderer.getRenderTarget();
        let compile;
        try {
          // Match the scene pass format and light rig without drawing a hidden phase.
          renderer.setRenderTarget(this.frameTarget);
          compile = renderer.compileAsync(actor?.group ?? target, this.camera, this.scene);
        } finally {
          renderer.setRenderTarget(previous);
        }
        await compile;
        if (finishOfficeProgram && isCurrent()) await finishOfficeProgram(actor?.group ?? target);
      }
    };
    const task = prepare().catch(() => {});
    this.phasePrograms = task;
  }

  clearStage() {
    this.backroomsSet?.dispose();
    this.backroomsSet = null;
    const transientGeometries = new Set();
    const materials = new Set();
    const skeletons = new Set();
    this.stage.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.isSkinnedMesh) skeletons.add(object.skeleton);
      if (object.geometry && !isSharedCreatureGeometry(object.geometry) &&
        ![unitBox, unitCylinder, unitSphere, unitPlane].includes(object.geometry)) {
        transientGeometries.add(object.geometry);
      }
      if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
    for (const material of Object.values(this.materials)) materials.add(material);
    for (const skeleton of skeletons) skeleton.dispose();
    for (const geo of transientGeometries) geo.dispose();
    for (const material of materials) material.dispose();
    for (const texture of this.localTextures) texture.dispose();
    this.scene.remove(this.stage);
    this.sky = null;
    this.particles = null;
  }

  makeMaterials() {
    const surfaces = createSurfaceSet(this.theme, this.palette, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.localTextures.push(...surfaces.textures);
    const { normalMap, normalScale } = surfaces.steel;
    const gratingSurface = { normalMap, normalScale };
    return {
      wall: applyWorldWeather(standard(this.palette.wall, surfaces.wall), 'wall', this.theme),
      floor: applyWorldWeather(standard(this.palette.floor, surfaces.floor), 'floor', this.theme),
      ceiling: applyWorldWeather(standard(this.palette.ceiling, surfaces.ceiling), 'ceiling', this.theme),
      low: standard(this.palette.low, { roughness: .92 }),
      steel: standard(this.palette.steel, surfaces.steel),
      dark: standard('#202a2c', { roughness: .61, metalness: .20 }),
      accent: standard(this.palette.accent, surfaces.accent),
      copper: standard('#8d5a37', { roughness: .38, metalness: .31 }),
      rust: standard('#89413c', { roughness: .71 }),
      bone: standard('#c4b6a2', { roughness: .7 }),
      brass: standard('#a28c60', { metalness: .36, roughness: .46 }),
      frosted: standard('#507076', { metalness: .18, roughness: .43, emissive: '#39555b', emissiveIntensity: .16 }),
      day: standard('#826032', { ...gratingSurface, metalness: .53, roughness: .47, emissive: '#9a571b', emissiveIntensity: .14 }),
      night: standard('#406877', { ...gratingSurface, metalness: .58, roughness: .39, emissive: '#1e6e93', emissiveIntensity: .27 }),
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
      } else if (this.theme === 1) {
        b.box(m.low, xFace, .54, zFace, TILE, .87, .055, angle);
        b.box(m.accent, xFace, .983, zFace, TILE, .083, .10, angle);
        b.box(m.bone, xFace, 2.91, zFace, TILE, .07, .055, angle);
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
    const panel = (material, offset, y, width, height, depth, u = 0) =>
      b.box(material, x + dx * offset + dz * u, y, z + dz * offset - dx * u, width, height, depth, angle);
    if (roof) {
      if (pattern % 3 === 0) {
        panel(m.steel, .02, .66, .072, 1.52, .082, -.92);
        panel(m.dark, .028, .20, .58, .11, .071);
        panel(m.rust, .006, .69, .04, .96, .038, -.85);
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
      if (pattern < 5) {
        // Carry a visible supply line into the wall instead of ending it at every bay.
        const dropX = x + ox + dx * .053;
        const dropZ = z + oz + dz * .053;
        b.pipe(m.copper, new THREE.Vector3(dropX, .08, dropZ), new THREE.Vector3(dropX, y, dropZ), .066);
        panel(m.dark, .064, 1.58, .112, .105, .091, pattern < 9 ? -.74 : .74);
      }
      if (pattern % 5 === 0 && neighbor === '.') {
        panel(m.steel, .13, .68, 1.46, 1.04, .22);
        panel(m.dark, .252, .68, 1.29, .84, .035);
        for (let i = 0; i < 5; i++) panel(m.steel, .276, .38 + i * .14, 1.23, .055, .053);
        panel(m.copper, .18, 1.22, 1.58, .065, .24);
      }
    } else {
      panel(m.accent, .016, .54, .050, .76, .10, -.97);
      if (pattern >= 13 && neighbor === '.') {
        panel(m.accent, .046, 1.87, 1.58, 1.14, .14);
        panel(m.dark, .113, 1.885, 1.42, .97, .040);
        for (const u of [-.36, .36]) {
          panel(m.frosted, .141, 1.90, .677, .88, .019, u);
          panel(m.steel, .156, 2.08, .69, .027, .021, u);
          panel(m.steel, .160, 1.55, .69, .028, .027, u);
        }
        panel(m.bone, .114, 1.29, 1.64, .074, .17);
      } else if (pattern === 1 || pattern === 7) {
        panel(m.accent, .035, 1.38, .94, 2.35, .09);
        panel(m.low, .084, 1.50, .76, 2.02, .04);
        panel(m.frosted, .110, 1.92, .48, .71, .018);
        panel(m.brass, .109, 1.05, .17, .045, .073, .25);
      }
    }
  }

  makeFloor(tile) {
    const { x, z, col, row, kind } = tile;
    const batch = this.batches[PHASE[kind] || 'neutral'];
    const m = this.materials;
    const variant = random(col + 3211 * row + 7001 * this.theme);
    const material = PHASE[kind] ? m[PHASE[kind]] : m.floor;
    if (!PHASE[kind]) {
      const angle = (col * 3 + row * 7) % 3 ? 0 : Math.PI;
      const floorTint = tint(variant());
      if (this.theme === 1 && (col === 10 || row === 11) && row >= 11) {
        floorTint.multiplyScalar(.87);
        floorTint.r *= .87;
        floorTint.b *= 1.06;
      }
      batch.box(material, x, -.14, z, TILE - .013, .28, TILE - .013, angle, floorTint);
    }
    if (this.theme !== 2) {
      this.batches.neutral.box(m.ceiling, x, 3.34, z, TILE + .013, .15, TILE + .013);
      if (this.theme === 0 && (col + row * 2) % 4 === 0) {
        this.batches.neutral.box(m.dark, x, 3.12, z + .85, TILE + .025, .2, .16);
      } else if (this.theme === 1 && row % 4 === 2) {
        this.batches.neutral.box(m.low, x, 3.163, z + 1.10, TILE + .025, .17, .27);
      }
      if (PHASE[kind]) this.batches.neutral.box(m.low, x, -5.8, z, TILE + .012, .2, TILE + .012);
    }
    if (PHASE[kind]) {
      const phase = PHASE[kind];
      const light = m[phase + 'Line'];
      const rail = phase === 'day' ? m.brass : m.steel;
      for (let tread = 0; tread < 9; tread++) {
        const u = (tread - 4) * .246;
        batch.box(material, x + u, -.049, z, .172, .098, 2.24, 0, tint(variant()));
        for (const offset of [-.62, .62]) batch.box(m.dark, x + u, -.006, z + offset, .149, .016, .043);
      }
      for (const direction of [-1, 1]) {
        batch.box(rail, x + direction * 1.144, -.043, z, .09, .087, TILE - .015);
        batch.box(rail, x, -.043, z + direction * 1.145, TILE - .017, .086, .087);
        batch.box(m.dark, x, -.14, z + direction * .975, TILE - .04, .085, .1);
        if (this.decoded.get(col + direction, row)?.kind !== kind) {
          batch.box(light, x + direction * 1.144, .005, z, .020, .018, 2.19);
        }
        if (this.decoded.get(col, row + direction)?.kind !== kind) {
          batch.box(light, x, .005, z + direction * 1.145, 2.23, .017, .020);
        }
      }
      return;
    }
    if (this.theme === 2) {
      batch.box(m.low, x, -.65, z, TILE - .015, .93, TILE - .015);
      this.makeRoofFascia(tile);
    }
    if (this.theme === 0 && (col + row * 7) % 8 === 0) {
      batch.box(m.accent, x + .9, .006, z, .045, .016, 2.28);
    }
    const archiveCorner = this.theme === 1 && kind === '.' &&
      (col === 9 && row === 10 || col === 21 && row === 9);
    if (kind === 'S' || kind === 'E' || (kind === '.' && (col + row * 3) % 12 === 0) || archiveCorner) {
      this.fixture(x, this.theme === 2 ? 2.74 : 2.98, z, kind === 'E' ? 'safe' : 'general');
    }
  }

  markShortcut(pads) {
    const m = this.materials;
    for (let i = 0; i < pads.length - 1; i++) {
      const here = pads[i], next = pads[i + 1];
      const dx = Math.sign(next.col - here.col), dz = Math.sign(next.row - here.row);
      const direction = Math.atan2(dx, dz);
      const batch = this.batches[here.phase ?? 'neutral'];
      const ink = here.phase ? m[here.phase + 'Line'] : m.lamp;
      // Only the physical pad owns its arrow. A hidden pad cannot mark the void.
      batch.box(ink, here.x + dx * .52, .014, here.z + dz * .52, .063, .017, .45, direction);
      for (const side of [-1, 1]) {
        batch.box(ink, here.x + dx * .70 + dz * side * .138, .014,
          here.z + dz * .70 - dx * side * .138, .063, .017, .38, direction - side * .74);
        batch.box(m.brass, here.x + dx * 1.07 + dz * side * .77, .026,
          here.z + dz * 1.07 - dx * side * .77, .17, .026, .052, direction);
      }
    }
  }

  makeRoofFascia(tile) {
    const b = this.batches.neutral;
    const m = this.materials;
    for (const [dx, dz] of FACES) {
      const adjacent = this.decoded.get(tile.col + dx, tile.row + dz);
      if (adjacent && !adjacent.phase) continue;
      // Permanent roof edges only. Keep the trim entirely under the neutral slab.
      const x = tile.x + dx * (HALF - .063);
      const z = tile.z + dz * (HALF - .063);
      const angle = dx ? Math.PI / 2 : 0;
      b.box(m.steel, x, -.235, z, TILE - .021, .13, .10, angle);
      b.box(m.wall, x, -1.34, z, TILE - .028, 1.41, .093, angle);
      if ((tile.row + tile.col) % 3 === 0) {
        b.box(m.dark, x, -1.12, z, .14, 1.52, .101, angle);
      }
    }
  }

  fixture(x, y, z, type) {
    const m = this.materials;
    const b = this.batches.neutral;
    const lens = type === 'safe' ? m.safe : m.lamp;
    if (this.theme === 2) {
      b.box(m.steel, x, y + .08, z, .68, .14, .36);
      b.box(lens, x, y, z, .52, .052, .18);
      b.box(m.steel, x + .33, y / 2, z, .047, y, .047);
      b.box(m.dark, x + .33, .067, z, .22, .13, .21);
    } else if (this.theme === 1) {
      b.box(m.dark, x, y + .07, z, 1.12, .145, .38);
      b.box(m.bone, x, y + .006, z, 1.06, .042, .35);
      for (const dz of [-.076, .076]) b.box(lens, x, y - .029, z + dz, .90, .032, .105);
      b.box(m.dark, x, y - .033, z, .94, .029, .024);
    } else {
      b.box(m.dark, x, y + .08, z, .72, .15, .36);
      b.box(m.copper, x, y + .027, z, .67, .07, .27);
      b.box(lens, x, y - .018, z, .52, .062, .18);
      for (const dx of [-.22, .22]) b.box(m.dark, x + dx, y - .056, z, .037, .021, .23);
    }
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
      for (let i = 0; i < 8; i++) {
        const stripe = m[i % 2 ? 'dark' : 'brass'];
        batch.box(stripe, x - 1.1 + i * .3, .013, z - 5.44, .28, .022, .13);
      }
      this.makeFan(x + 3.35, 1.60, z - 5.80, .74);
    } else if (this.theme === 1) {
      const wallZ = z - 4.81;
      const wallX = x - 2.48;
      const label = spriteText('F4 • PERSONNEL', '#e4dfbe', 'ARCHIVE / LUNCHROOM');
      this.localTextures.push(label);
      for (const side of [-1, 1]) {
        batch.box(m.dark, wallX + side * .70, 2.51, wallZ - .014, .036, 1.10, .035);
      }
      mesh(this.stage, unitPlane, new THREE.MeshBasicMaterial({ map: label }),
        [wallX, 1.97, wallZ], [1.68, .42, 1]);
      this.lightSource(wallX + .18, 2.20, wallZ + .47, 10, 'general', .46);
    } else {
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
    const color = type === 'safe' ? SAFE : type === 'alarm' ? YELLOW :
      this.theme === 1 ? OFFICE_LIGHT : WARM;
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
    const { x, z, angle } = this.edgeOffset(tile, .72);
    b.box(m.dark, x, .08, z, .38, .16, .34, angle);
    b.box(m.steel, x, .168, z, .31, .035, .28, angle);
    for (const dx of [-.12, .12]) for (const dz of [-.103, .103]) {
      b.add(unitCylinder, m.brass, [x + dx, .20, z + dz], [.046, .025, .046]);
    }
    b.add(unitCylinder, m.steel, [x, .72, z], [.096, 1.08, .096]);
    b.add(unitCylinder, m.dark, [x, .24, z], [.171, .095, .171]);
    b.add(unitCylinder, m.dark, [x, 1.16, z], [.155, .081, .155]);
    b.add(unitCylinder, m.dark, [x, 1.255, z], [.33, .075, .33]);
    b.add(unitCylinder, m.safe, [x, 1.34, z], [.273, .108, .273]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      b.add(unitCylinder, m.steel, [x + Math.sin(a) * .15, 1.34, z + Math.cos(a) * .15], [.024, .116, .024]);
    }
    b.add(unitCylinder, m.dark, [x, 1.418, z], [.342, .05, .342]);
    b.add(unitCylinder, m.steel, [x, 1.449, z], [.257, .035, .257]);
    const beacon = this.lightSource(x, 1.35, z, 10, 'safe', .73);
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
    const indicator = mesh(this.stage, unitSphere, signal, [x, 1.183, z], [.087, .071, .087]);
    b.add(unitCylinder, m.brass, [x, 1.138, z], [.132, .035, .132]);
    const group = new THREE.Group();
    group.position.set(x - dx * .24, .93, z - dz * .24);
    group.rotation.y = angle;
    this.stage.add(group);
    let action;
    if (this.theme === 0) {
      b.box(m.steel, x, .53, z, .42, 1.06, .48, angle);
      b.box(m.copper, x, .80, z, .5, .27, .52, angle);
      b.box(m.dark, x, 1.114, z, .43, .14, .48, angle);
      for (const u of [-.147, .147]) {
        b.box(m.brass, x - dx * .257 + dz * u, .69, z - dz * .257 - dx * u, .065, .064, .029, angle);
      }
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
      b.box(m.accent, x + dx * .16, 1.065, z + dz * .16, .36, .14, .20, angle);
      b.box(m.steel, x, 1.054, z, .14, .14, .16, angle);
      action = mesh(group, unitBox, m.bone, [0, .085, .19], [.44, .028, .28]);
      for (let i = 0; i < 4; i++) {
        b.box(m.dark, x - dx * .269, .23 + i * .14, z - dz * .269, .33, .014, .012, angle);
        b.box(m.brass, x - dx * .28, .285 + i * .14, z - dz * .28, .105, .035, .023, angle);
      }
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
      for (const u of [-.164, .164]) {
        b.box(m.brass, x - dx * .218 + dz * u, 1.052, z - dz * .218 - dx * u, .054, .044, .065, angle);
      }
      const pipeX = x + dz * .272;
      const pipeZ = z - dx * .272;
      b.pipe(m.copper, new THREE.Vector3(pipeX, .055, pipeZ), new THREE.Vector3(pipeX, .77, pipeZ), .071);
      action = mesh(group, unitBox, m.brass, [0, 0, .09], [.07, .22, .055]);
      action.rotation.z = -.48;
    }
    const label = power
      ? spriteText('POWER', '#a8dfd4', 'EMERGENCY LIGHT')
      : spriteText(`${id} · ${STATION_TITLES[this.theme][id]}`, '#dec498', 'HANDOVER');
    this.localTextures.push(label);
    const front = [.271, .276, .25][this.theme];
    const plate = mesh(this.stage, unitPlane, new THREE.MeshBasicMaterial({ map: label }),
      [x - dx * front, .863, z - dz * front], [.424, .106, 1]);
    plate.rotation.y = Math.atan2(-dx, -dz);
    this.objects.set(id, { indicator, action, kind: power ? 'power' : 'station' });
  }

  makePhonographMarker(tile) {
    const x = tile.x - .38, z = tile.z;
    const label = spriteText('RECORD 17', '#ebd2a2', 'ARCHIVE / SAFETY NOTE');
    this.localTextures.push(label);
    const sign = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({
      map: label, transparent: true, opacity: .94, depthWrite: false
    }));
    sign.position.set(x, 1.78, z + .20);
    sign.scale.set(.77, .27, 1);
    this.stage.add(sign);
    this.lightSource(x + .28, 1.31, z + .50, 5.4, 'alarm', .46);
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
    this.doorMount = g;
    const oldGate = new THREE.Group();
    g.add(oldGate);
    const frame = new Batch(oldGate);
    for (const edge of [-1, 1]) {
      frame.box(m.dark, .89 * edge, 1.22, 0, .19, 2.44, .24);
      frame.box(m.steel, .90 * edge, 1.25, -.131, .115, 2.18, .042);
      frame.box(m.copper, .827 * edge, 1.23, -.155, .032, 2.21, .038);
      for (const y of [.16, .38, 2.17, 2.36]) {
        frame.add(unitCylinder, m.brass, [.902 * edge, y, -.161], [.028, .026, .028],
          { x: Math.PI / 2, y: 0, z: 0 });
      }
    }
    frame.box(m.dark, 0, 2.49, 0, 1.96, .23, .31);
    frame.box(m.steel, 0, 2.463, -.153, 1.81, .171, .082);
    frame.box(m.dark, 0, .035, 0, 1.80, .07, .25);
    frame.box(m.brass, 0, .071, -.116, 1.52, .021, .048);
    frame.build();
    this.door = new THREE.Group();
    oldGate.add(this.door);
    const shutter = new Batch(this.door);
    shutter.box(m.steel, 0, 1.22, 0, 1.55, 2.42, .125);
    for (let i = 0; i < 10; i++) {
      const y = .17 + i * .227;
      shutter.box(m.dark, 0, y, -.07, 1.55, .044, .030);
      shutter.box(m.copper, 0, y + .04, -.082, 1.43, .014, .018);
    }
    shutter.box(m.dark, 0, .106, -.078, 1.53, .083, .04);
    shutter.build();
    this.liftReady = mountServiceLift(this, g, oldGate).catch(error => console.warn('Service lift asset unavailable', error));
    const label = spriteText(this.theme === 2 ? 'EXIT' : 'SERVICE LIFT', '#9ce6cf', 'EMERGENCY ACCESS');
    this.localTextures.push(label);
    const panel = mesh(g, unitPlane, new THREE.MeshBasicMaterial({ map: label }), [0, 2.47, -.196], [.68, .17, 1]);
    panel.rotation.y = Math.PI;
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
    // Run procedural sky shading only where opaque geometry left depth clear.
    // Transparent surfaces still blend over the completed sky.
    this.sky.renderOrder = 100;
    this.sky.frustumCulled = false;
    const b = this.batches.neutral;
    const m = this.materials;
    const rng = random(3197);
    const mx = this.decoded.width * TILE / 2;
    const mz = this.decoded.depth * TILE / 2;
    const city = standard('#4c5456', { roughness: .86, fog: false });
    const concrete = standard('#596063', { roughness: .88, fog: false });
    const glass = standard('#283944', { metalness: .3, roughness: .24, fog: false });
    const distant = standard('#676a70', { roughness: 1, fog: false });
    const windows = new THREE.MeshBasicMaterial({ color: '#b3a076', fog: false });
    const street = new THREE.MeshBasicMaterial({ color: '#453738', fog: false });
    for (const material of [city, concrete, glass, distant]) material.userData.castShadow = false;
    Object.assign(this.materials, { city, concrete, glass, distant, windows, street });
    b.box(street, mx, -22, mz, 216, .1, 216);
    for (let i = 0; i < 68; i++) {
      const a = i / 68 * Math.PI * 2 + rng() * .09;
      const radius = 73 + rng() * 24;
      const width = 2.3 + rng() * 5.4;
      const height = 5.0 + rng() ** 2 * 21.5;
      const x = mx + Math.cos(a) * radius;
      const z = mz + Math.sin(a) * radius;
      b.box(distant, x, height / 2 - 22, z, width, height, width, .13 + rng() * .18, tint(rng()));
      if (i % 3 === 0) b.box(distant, x, height - 21.3, z, width * .64, 1.4, width * .55, .15);
    }
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2 + rng() * .073;
      const radius = 48 + rng() * 18;
      const x = mx + Math.cos(angle) * radius;
      const z = mz + Math.sin(angle) * radius;
      const width = 2.9 + rng() * 5.4;
      const depth = 3.1 + rng() * 5.3;
      const height = 10 + rng() ** 1.8 * 24;
      const top = height - 22;
      const facade = tint(.3 + rng() * .65);
      const facingX = mx > x ? 1 : -1;
      const facingZ = mz > z ? 1 : -1;
      const front = z + facingZ * (depth / 2 + .018);
      const side = x + facingX * (width / 2 + .018);
      b.box(city, x, height / 2 - 22, z, width, height, depth, 0, facade);
      b.box(concrete, x, top + .095, z, width + .17, .19, depth + .17, 0, facade);
      if (i % 2 === 0) b.box(city, x - width * .13, top + .55, z, width * .52, 1.1, depth * .55, 0, facade);
      if (i % 4 === 0) b.box(concrete, x, top + 1.23, z, .09, 2.2, .09);
      const activity = .61 + rng() * .35;
      const columns = Math.floor(width / .89);
      const rows = Math.floor(depth / .89);
      const step = i % 3 === 0 ? 1.18 : .92;
      for (let y = top - .72; y > Math.max(-13, top - 13); y -= step) {
        b.box(concrete, x, y + .31, front, width, .066, .08, 0, facade);
        for (let column = 0; column < columns; column++) {
          const u = (column / columns - .5 + .5 / columns) * width;
          const open = rng() > activity;
          b.box(open ? windows : glass, x + u, y, front, .45, .36, .026, 0, open ? tint(rng()) : facade);
        }
        for (let column = 0; column < rows; column++) {
          const u = (column / rows - .5 + .5 / rows) * depth;
          const open = rng() > activity + .075;
          b.box(open ? windows : glass, side, y, z + u, .026, .34, .44, 0, open ? tint(rng()) : facade);
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

  updateGhosts(state, dt, reduced) {
    const seen = new Set();
    let faceExposure = 1;
    for (const [index, ghost] of (state.ghosts || []).entries()) {
      const key = ghost.key ?? ghost.id ?? index;
      seen.add(key);
      const visible = ghost.active !== false && (ghost.phase !== 'night' || state.night) &&
        (ghost.phase !== 'day' || !state.night);
      let actor = this.ghosts.get(key);
      if (!visible) {
        if (actor) actor.group.visible = false;
        continue;
      }
      const toward = Math.atan2(state.x - ghost.x, state.z - ghost.z);
      if (!actor) actor = this.addCreature(key, index, ghost.kind);
      const wasVisible = actor.group.visible;
      actor.group.visible = true;
      const threat = typeof ghost.alert === 'number' ? ghost.alert : Number(Boolean(ghost.chase || ghost.state === 'chase'));
      const distance = Math.hypot(state.x - ghost.x, state.z - ghost.z);
      const relativeBearing = -toward - (state.yaw || 0);
      const inView = THREE.MathUtils.smoothstep(Math.cos(relativeBearing), .70, .93);
      const proximity = 1 - THREE.MathUtils.smoothstep(distance, .96, 3.22);
      faceExposure = Math.min(faceExposure, 1 - .79 * proximity * inView);
      const attacking = state.life === 'dying' && (state.deathCause === 'ghost' || state.deathCause === 'gaze') && ghost === state.pursuer;
      const attack = attacking ? THREE.MathUtils.smoothstep(state.lifeTimer, 0, .18) *
        (1 - .44 * THREE.MathUtils.smoothstep(state.lifeTimer, .47, .93)) : 0;
      // A direct stare permits the clerk to close the last few metres in the
      // capture animation. Simulation keeps the original collision position.
      const lunge = attacking && state.deathCause === 'gaze' && !reduced ?
        THREE.MathUtils.smoothstep(state.lifeTimer, .13, .48) *
        (1 - .84 / Math.max(.84, distance)) : 0;
      const x = THREE.MathUtils.lerp(ghost.x, state.x, lunge);
      const z = THREE.MathUtils.lerp(ghost.z, state.z, lunge);
      const dx = x - actor.group.position.x;
      const dz = z - actor.group.position.z;
      const travel = Math.hypot(dx, dz);
      const moving = wasVisible && actor.placed && travel > .002;
      const bearing = moving && threat < .33 && !attack ? Math.atan2(dx, dz) : toward;
      const turn = bearing - actor.group.rotation.y;
      actor.group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) *
        (wasVisible ? Math.min(1, dt * (attack ? 17 : 8)) : 1);
      actor.group.position.set(x, ghost.y || 0, z);
      actor.placed = true;
      updateCreature(actor, { time: state.time || 0, threat, attack, night: state.night, distance, reduced, moving, dt, travel, gazeLock: ghost.gaze || 0 });
      this.air.breathe(actor, distance, state, this.theme, reduced);
    }
    for (const [key, actor] of this.ghosts) if (!seen.has(key)) actor.group.visible = false;
    return faceExposure;
  }

  resize(quality = 'high') {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1280);
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 720);
    const rawRatio = globalThis.devicePixelRatio || 1;
    const high = quality === 'high';
    const ratio = Math.min(rawRatio, SIZE[quality] || SIZE.high,
      (high ? 2560 : 1920) / width, (high ? 1440 : 1080) / height) * this.frameBudget.scale;
    if (this.size[0] === width && this.size[1] === height && this.size[2] === ratio) return false;
    this.size = [width, height, ratio];
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    const rw = Math.max(1, Math.floor(width * ratio));
    const rh = Math.max(1, Math.floor(height * ratio));
    this.frameTarget.setSize(rw, rh);
    this.atmosphere.target.setSize(Math.max(1, Math.round(rw / 3)), Math.max(1, Math.round(rh / 3)));
    this.grade.uniforms.texel.value.set(1 / rw, 1 / rh);
    return true;
  }

  updateLights(state, time, night, exposure) {
    const roof = this.theme === 2;
    const office = this.theme === 1;
    this.fill.color.set(state.chase ? '#fff1ae' : office ? '#e9decb' : '#dce3ed').lerp(COLD, night * .8);
    this.fill.intensity = state.chase ? 1.3 - night * .3 : roof ? 1.50 - night * .39 : office ? 1.02 - night * .25 : .94 - night * .22;
    if (office) this.materials.frosted.emissiveIntensity = .13 + night * .16;
    this.scene.environmentIntensity = roof ? .63 - night * .31 : .57 - night * .19;
    this.rim.color.copy(WARM).lerp(COLD, night);
    this.rim.intensity = roof ? 1.85 - night * .18 : .64 - night * .12;
    this.lamp.color.copy(WARM).lerp(PALE, night);
    this.lamp.position.copy(this.camera.position);
    // Mount the beam beside the left temple. Off-axis highlights reveal the
    // bridge of the nose, finger joints and hardware even in a frontal encounter.
    const offset = .17 + .085 * (1 - exposure);
    const x = this.camera.position.x + this.view.z * offset;
    const z = this.camera.position.z - this.view.x * offset;
    if (this.decoded.at(x, z)?.kind !== '#') {
      this.lamp.position.x = x;
      this.lamp.position.z = z;
    }
    this.lamp.position.y += .10;
    this.lamp.target.position.copy(this.camera.position).addScaledVector(this.view, 18);
    this.lamp.intensity = ((roof ? 5.8 : 13.8) + night * 13.5 + Math.sin(time * 18) * .15 * night) * exposure;
    this.eyeFill.position.copy(this.camera.position);
    this.eyeFill.intensity = (.55 + night * .66) * exposure;
    if (time < this.fixtureSearchTime || time - this.fixtureSearchTime >= .12) {
      this.fixtureSearchTime = time;
      this.nearestFixtures = this.ambience
        .map(source => ({ source, distance: (source.x - state.x) ** 2 + (source.z - state.z) ** 2 }))
        .filter(entry => entry.distance < 20 ** 2)
        .sort((a, b) => a.distance - b.distance).slice(0, this.nearLights.length);
    }
    const near = this.nearestFixtures;
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
    const { bulbs, tints } = this.atmosphere.uniforms;
    for (let i = 0; i < bulbs.value.length; i++) {
      const entry = near[i];
      if (!entry) {
        bulbs.value[i].set(0, 0, 0, 0);
        continue;
      }
      const { source } = entry;
      const ceilingSource = source.y > 2.3;
      bulbs.value[i].set(source.x, source.y, source.z, ceilingSource ? source.strength * .095 : 0);
      tints.value[i].copy(this.nearLights[i].color);
    }
    for (const source of this.ambience) {
      if (source.type === 'general') source.sprite.material.color.copy(source.color).lerp(COLD, night * .9);
      source.sprite.material.opacity = .23 + .08 * Math.sin(time * 1.75 + source.x * .4) + night * .08;
    }
    for (const { tile, pool, beacon } of this.safeLamps) {
      const active = state.checkpoint === tile || state.checkpoint === `${tile.col}/${tile.row}`;
      pool.material.opacity = active ? .31 + .06 * Math.sin(time * 3) : .12;
      if (active) beacon.material.opacity += .15;
    }
  }

  render(state, dt, elapsed = dt) {
    if (!this.stage) return;
    const quality = typeof state.quality === 'string' ? state.quality.toLowerCase() : 'high';
    const reduced = state.reducedMotion || state.reduceMotion || state.reducedEffects;
    const playing = state.mode === 'playing';
    if (playing) {
      if (!this.wasPlaying) this.frameBudget.resetMeasurement();
      this.frameBudget.observe(elapsed, state.autoResolution !== false);
    }
    this.wasPlaying = playing;
    const resized = this.resize(quality);
    if (this.desktopPointer.matches && (state.mode === 'paused' || state.mode === 'won')) {
      const previous = this.overlayFrame;
      if (!resized && previous?.mode === state.mode && previous.quality === quality && previous.reduced === reduced) return;
      this.overlayFrame = { mode: state.mode, quality, reduced };
      dt = 0;
    } else this.overlayFrame = null;
    // Give the archives' first shift and its own surfaces priority. Once a
    // station is finished, the transfer set can load during a later idle frame.
    if (this.preloadTransfer && state.completed?.size > 0) {
      this.preloadTransfer = false;
      const stage = this.stage;
      void waitForRenderIdle().then(() => { if (this.stage === stage) void preloadBackroomsSet(); });
    }
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
    this.scene.fog.density = state.chase ? .032 + night * .012 : (this.theme === 2 ? .019 : .037) + night * (this.theme === 2 ? .004 : .024);

    const distance = this.last ? Math.hypot(state.x - this.last.x, state.z - this.last.z) : 0;
    this.last = { x: state.x, z: state.z };
    this.velocity = THREE.MathUtils.lerp(this.velocity, Math.min(6, distance / Math.max(dt, .008)), Math.min(1, dt * 9));
    this.walk += this.velocity * dt * 2.8;
    const bob = reduced ? 0 : Math.sin(this.walk) * this.velocity * .011;
    const lean = reduced ? 0 : Math.cos(this.walk * .52) * this.velocity * .003;
    const caught = dying && (state.deathCause === 'ghost' || state.deathCause === 'gaze');
    const collapse = caught ? THREE.MathUtils.smoothstep(lifeTime, .38, 1.07) :
      dying ? Math.min(1, Math.abs(lifeTime) * 1.25 + .14) :
        revival ? .57 * (1 - THREE.MathUtils.smoothstep(lifeTime, .08, .63)) : 0;
    this.camera.position.set(state.x, (state.y || 0) + EYE + bob - collapse * 1.19, state.z);
    let yaw = state.yaw || 0;
    let pitch = (state.pitch || 0) - (reduced ? 0 : collapse * .17);
    const faceExposure = this.updateGhosts(state, dt, reduced);
    if (caught && state.pursuer && !reduced) {
      const actor = this.ghosts.get(state.pursuer.key ?? state.pursuer.id);
      const target = this.captureTarget.set(state.pursuer.x, 1.76, state.pursuer.z);
      if (actor?.head) {
        actor.head.getWorldPosition(target);
        target.y += .158;
      }
      const hold = THREE.MathUtils.smoothstep(lifeTime, .015, .165) *
        (1 - THREE.MathUtils.smoothstep(lifeTime, .57, .99));
      const approach = Math.atan2(target.x - state.x, -(target.z - state.z));
      const recoil = .41 * hold;
      const x = state.x - Math.sin(approach) * recoil;
      const z = state.z + Math.cos(approach) * recoil;
      if (this.decoded.at(x, z)?.kind !== '#') {
        this.camera.position.x = x;
        this.camera.position.z = z;
      }
      const dx = target.x - this.camera.position.x;
      const dz = target.z - this.camera.position.z;
      const facing = Math.atan2(dx, -dz) - yaw;
      yaw += Math.atan2(Math.sin(facing), Math.cos(facing)) * hold;
      const headPitch = Math.atan2(target.y - this.camera.position.y, Math.max(.25, Math.hypot(dx, dz)));
      pitch = THREE.MathUtils.lerp(pitch, headPitch, hold);
    }
    this.view.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this.camera.lookAt(delta.copy(this.camera.position).add(this.view));
    this.camera.rotateZ(lean + (reduced ? 0 : collapse * .31));
    const fov = 65 + (state.sprint || state.sprinting ? 4 : 0) + shift * (reduced ? 0 : 2.5);
    if (Math.abs(this.camera.fov - fov) > .01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, Math.min(1, dt * 9));
      this.camera.updateProjectionMatrix();
    }
    this.janitorHands.update(state, dt, this.walk, this.velocity);
    // Prevent the flashlight from flattening a face at arm’s length.
    this.creatureExposure = THREE.MathUtils.lerp(this.creatureExposure, faceExposure, Math.min(1, dt * 13));
    const exposure = caught ? 1 - .94 * THREE.MathUtils.smoothstep(lifeTime, .015, .19) : this.creatureExposure;
    this.updateLights(state, time, night, exposure);
    const door = Math.min(1, Math.max(0, state.door || 0));
    const slide = door * door * (3 - 2 * door);
    if (this.liftLeaves) poseServiceLift(this.liftLeaves, door);
    this.air.update(state, this.doorMount, reduced);
    if (this.door) {
      this.door.position.y = slide * 2.28;
      this.door.scale.y = 1 - slide * .91;
      this.door.visible = door < .99;
      this.doorLight.scale.setScalar(.78 + slide * .12);
    }
    this.backroomsSet?.update(state, dt);
    this.updateProps(state, time);
    if (this.sky) {
      this.sky.position.copy(this.camera.position);
      this.sky.material.uniforms.night.value = night;
      this.sky.material.uniforms.time.value = time;
      this.materials.street.color.set('#463938').lerp(this.fogCold, night);
      this.materials.windows.color.setRGB(.29 + night * .95, .21 + night * .66, .11 + night * .25);
      this.materials.distant.color.copy(this.scene.background).lerp(COLD, .15 + .08 * night);
    }
    for (const { rotor, speed } of this.kinetics) rotor.rotateZ(dt * speed * (1 - night * .92));
    this.updateParticles(state, time, quality);
    if (quality !== this.renderQuality) {
      this.renderQuality = quality;
      this.renderer.shadowMap.enabled = quality === 'high';
      this.lamp.castShadow = quality === 'high';
      this.frameTarget.resolveDepthBuffer = quality === 'high';
      this.shadowTime = -1;
    }
    const shadowAge = time - this.shadowTime;
    const lightMoved = this.camera.position.distanceToSquared(this.shadowPosition) > .008 ||
      Math.abs(yaw - this.shadowYaw) > .023 || Math.abs(pitch - this.shadowPitch) > .023;
    if (quality === 'high' && (shadowAge < 0 || this.shadowPhase !== state.night ||
      (shadowAge >= .043 && lightMoved) || shadowAge >= .13)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowTime = time;
      this.shadowPhase = state.night;
      this.shadowYaw = yaw;
      this.shadowPitch = pitch;
      this.shadowPosition.copy(this.camera.position);
    }
    const uniforms = this.grade.uniforms;
    uniforms.night.value = night;
    uniforms.shift.value = shift * (reduced ? .14 : 1);
    uniforms.life.value = (dying || revival ? .7 : 0) * (reduced ? .35 : 1);
    uniforms.lifeJitter.value = .018 * uniforms.life.value * Math.sin(time * 23);
    const gazeTint = state.watching ? .12 + (state.gaze || 0) * .75 : 0;
    uniforms.danger.value = dying ? 1 : hurt ? .6 : Math.max(gazeTint, Math.max(0, 3 - (state.hp ?? 3)) * .19);
    if (quality === 'low') {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const cinematic = quality === 'high';
    this.renderer.setRenderTarget(this.frameTarget);
    this.renderer.render(this.scene, this.camera);
    const mist = this.atmosphere;
    const hasShafts = cinematic && mist.uniforms.bulbs.value.some(bulb => bulb.w !== 0);
    if (hasShafts) {
      mist.uniforms.sceneDepth.value = this.frameTarget.depthTexture;
      mist.uniforms.inverseProjection.value.copy(this.camera.projectionMatrixInverse);
      mist.uniforms.cameraToWorld.value.copy(this.camera.matrixWorld);
      mist.uniforms.time.value = time;
      mist.uniforms.outdoors.value = this.theme === 2 ? 1 : 0;
      this.renderer.setRenderTarget(mist.target);
      this.renderer.render(mist.scene, mist.camera);
    }
    uniforms.effects.value = cinematic ? 1 : 0;
    uniforms.shafts.value = hasShafts ? 1 : 0;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
    if (cinematic) this.preparePhasePrograms();
  }

  updateProps(state, time) {
    for (const [key, object] of this.objects) {
      if (object.kind === 'hazard') {
        const pulse = Math.max(0, Math.sin(time * 2.62 + object.seed));
        object.indicator.material.opacity = .075 + pulse * .22;
        object.indicator.scale.y = .67 + pulse * .95;
      } else if (object.kind === 'clue') {
        object.indicator.visible = !(state.hasRecord?.(key) || state.clues?.has?.(key) || state.evidence?.has?.(key));
      } else {
        const done = object.kind === 'power' ? state.powered ?? state.progress?.powered : state.completed?.has?.(key);
        updateWorkstation(object, done, time);
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
