import { preloadMourningFigure } from './mourning-figure.js';
import { firstSightWall, mourningHiddenByPartition } from './mourning-gaze.js';
import { clerkCaptureFrame } from './mourning-capture.js';
import { ordinaryLifeShot } from './shift-cinematics.js';
import * as THREE from 'three';
import { applyWorldWeather, createSurfaceSet } from './surfaces.js';
import { decorateModels } from './models.js';
import { MAP_DRESSING, mountMapDressing } from './map-dressing.js';
import { trackBoilerBatch, updateBoilerBatches } from './dressing-visibility.js';
import { mountRoofSkyline, updateRoofSkyline } from './roof-skyline.js';
import { mountArchitecture, mountCityGround, mountDetail, mountFit, mountJunctions, mountRoofCorners, mountRoofSplices, mountSignTrays, mountUtilities } from './architecture-kit.js';
import { planCityGround } from './city-ground-layout.js';
import { evidenceModel, evidenceStand, mountInspectionDetails } from './inspection-details.js';
import { mountEnvironment, mountRoofNurseries } from './environment-assets.js';
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
import { hazardBeat, hazardInPhase, hazardPressure, rotorStep, stationAge, stationPose } from './machinery-motion.js';
import { hasArchiveWallSign, mountWallSigns } from './set-dressing.js';

// At these faces furniture or equipment occupies the ornamental fitting's depth.
// Coordinates describe the backing wall, not the walkable cell in front.
const ARCHIVE_OCCUPIED_FACES = new Set(['12/5/0/1','7/15/1/0','16/2/1/0','12/17/0/-1']);
import { mountArchiveInterior } from './archive-interior.js';
import { mountPlantSets, updatePlantSets } from './plant-sets.js';
import { dressArchitecture, makeChamferedBox } from './architectural-details.js';
import { mountCheckpointLamps } from './checkpoint-lamp.js';
import { ROOF_WALL_HEIGHT } from './levels.js';

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
const OFFICE_LIGHT = new THREE.Color('#e3ead4');
const OFFICE_EMERGENCY = new THREE.Color('#e56849');
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
  floor: '#606b66', wall: '#a1a79a', ceiling: '#6a6c63', low: '#2a2e2a',
  daySky: '#313731', nightSky: '#121f26', steel: '#626f74', accent: '#6b5147'
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
const trimBox = makeChamferedBox();
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

  trim(material, x, y, z, width, height, depth, angle) {
    this.add(trimBox, material, [x, y, z], [width, height, depth], { x: 0, y: angle, z: 0 });
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
  // The amber break stays low under an ash front, not an open sunset.
  vec3 sunset = mix(vec3(.31,.165,.091), vec3(.045,.075,.093), smoothstep(.04,.64,sqrt(h)));
  vec3 darkness = mix(vec3(.030,.060,.066), vec3(.004,.013,.021), smoothstep(0.,.63,sqrt(h)));
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
  float front = smoothstep(.33, .61, clumps) * smoothstep(.016,.135,h);
  float obliqueLight = max(0.0, clumps - fbm(p + vec2(.19,.13))) * 3.2;
  float underlit = pow(sundot,6.) * (1.0-smoothstep(.08,.37,h));
  vec3 cloudDay = mix(vec3(.038,.048,.051),vec3(.36,.224,.151),clamp(obliqueLight * .43 + underlit * .48,0.,1.));
  vec3 cloudNight = mix(vec3(.006,.017,.020),vec3(.032,.067,.075),clamp(obliqueLight,0.,1.));
  sky = mix(sky, mix(cloudDay,cloudNight,night), front * .95);
  float highSheet = smoothstep(.46,.73, fbm(plane * vec2(4.9, .92) - vec2(time * .015,11.0)));
  sky += highSheet * smoothstep(.04,.13,h) * mix(vec3(.041,.046,.044),vec3(.008,.022,.025),night) * (1.0-front);
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
  // Aspect-correct halation with a tight core and broader, warmer scatter.
  // Reuse four scene taps even at high quality; no extra full-screen pass.
  vec2 glowRadius = (texel / texel.y) * .006;
  vec3 core = glowSample(sampleUv + vec2(glowRadius.x, 0.0))
            + glowSample(sampleUv - vec2(glowRadius.x, 0.0));
  vec3 tail = glowSample(sampleUv + vec2(0.0, glowRadius.y * 1.7))
            + glowSample(sampleUv - vec2(0.0, glowRadius.y * 1.7));
  base += core * .057 + tail * mix(vec3(.040,.030,.025), vec3(.026,.037,.042), night);
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

async function warmMourningGeometry(renderer, figure) {
  const geometries = new Set();
  figure.traverse(object => { if (object.isMesh) geometries.add(object.geometry); });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const target = new THREE.WebGLRenderTarget(1, 1);
  const material = new THREE.MeshBasicMaterial({ toneMapped: false });
  const sample = new THREE.Mesh(geometries.values().next().value, material);
  sample.frustumCulled = false;
  scene.add(sample);
  try {
    for (const geometry of geometries) {
      await waitForRenderIdle();
      if (renderer.getContext().isContextLost()) return;
      sample.geometry = geometry;
      const previous = renderer.getRenderTarget();
      try {
        // Upload one mesh per idle frame without drawing to the game viewport.
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previous);
      }
    }
  } finally {
    target.dispose();
    material.dispose();
  }
}

async function warmMourningMaterials(visual, figure) {
  const { renderer, stage, frameTarget, camera, scene, rig, lamp } = visual;
  if (!renderer.extensions.has('KHR_parallel_shader_compile')) return;
  const context = renderer.getContext();
  let active = true;
  const isCurrent = () => active && stage === visual.stage && !context.isContextLost();
  const finish = makeOfficeProgramWarmup(renderer, stage, rig, lamp.shadow, isCurrent);
  const meshes = [];
  figure.traverse(object => {
    if (!object.isMesh) return;
    meshes.push([object, object.castShadow, object.receiveShadow]);
    object.castShadow = object.receiveShadow = true;
  });
  let limit;
  const prepare = async () => {
    await waitForRenderIdle();
    if (!isCurrent()) return;
    const previous = renderer.getRenderTarget();
    let linked;
    try {
      renderer.setRenderTarget(frameTarget);
      linked = renderer.compileAsync(figure, camera, scene);
    } finally {
      renderer.setRenderTarget(previous);
    }
    await linked;
    if (isCurrent()) await finish(figure);
  };
  try {
    const timeout = new Promise(resolve => { limit = setTimeout(resolve, 425); });
    await Promise.race([prepare(), timeout]);
  } finally {
    active = false;
    clearTimeout(limit);
    for (const [mesh, casts, receives] of meshes) {
      mesh.castShadow = casts;
      mesh.receiveShadow = receives;
    }
  }
}

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
    if (level.id === 'office') this.prepareMourningAsset();
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
    this.archiveTube = this.archiveBulkhead = null;
    if (this.theme === 1 && level.id !== 'backrooms') {
      this.archiveFixtures = [];
      this.archiveFixtureFallback = new THREE.Group();
      this.batches.archiveFixture = new Batch(this.archiveFixtureFallback);
      this.stage.add(this.archiveFixtureFallback);
    }

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

    this.architecture = new Map();
    this.junctions = new Map();
    this.utilities = new Map();
    this.detail = new Map();
    this.fit = new Map();
    this.signMounts = new Map();
    this.roofCorners = new Map();
    this.roofSplices = new Map();
    this.cityGround = new Map();
    this.cityGroundFallback = this.cityLamp = null;
    this.inspection = [];
    for (const wall of decoded.walls) this.makeWall(wall);
    for (const floor of decoded.floors) this.makeFloor(floor);
    if (decoded.shortcut) this.markShortcut(decoded.shortcut.pads);
    this.roofNurseries = [];
    this.mapDressing = new Map();
    const nurseryFallback = new THREE.Group();
    if (this.theme === 2) {
      nurseryFallback.name = 'Nursery box fallback';
      this.stage.add(nurseryFallback);
      this.batches.nurseryFallback = new Batch(nurseryFallback);
    }
    this.makePropClusters();
    this.makeArrival();
    decorateModels(this);
    mountWallSigns(this, TILE);
    const lampFallback = new THREE.Group();
    this.stage.add(lampFallback);
    this.batches.lampFallback = new Batch(lampFallback);
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
    this.skyline = null;
    if (this.theme === 2) this.makeSkyline();
    Object.values(this.batches).forEach(batch => batch.build());
    if (this.theme === 0) {
      for (const key of ['neutral', 'day', 'night']) {
        for (const mesh of this.batches[key].group.children) {
          if (mesh.isInstancedMesh) trackBoilerBatch(this, [mesh]);
        }
      }
    }
    this.makeParticles();
    this.workstationsReady = mountWorkstations(this);
    this.environmentReady = Promise.all([
      mountEnvironment(this), mountArchiveInterior(this), mountPlantSets(this), mountCheckpointLamps(this, lampFallback),
      mountRoofNurseries(this, nurseryFallback), mountMapDressing(this), mountRoofSkyline(this),
      mountArchitecture(this), mountInspectionDetails(this), mountJunctions(this), mountUtilities(this), mountDetail(this), mountFit(this), mountSignTrays(this), mountRoofCorners(this), mountRoofSplices(this), mountCityGround(this)
    ]);
    this.surfacesReady = mountPhotoSurfaces(this);
    const stage = this.stage;
    const redraw = () => { if (this.stage === stage) this.overlayFrame = null; };
    const creature = level.id === 'office' ? this.mourningAsset : preloadCreatureAsset();
    for (const ready of [this.environmentReady, this.workstationsReady, this.surfacesReady, creature]) ready.then(redraw, redraw);
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

  prepareMourningAsset() {
    if (this.mourningAsset) return;
    const desktop = this.desktopPointer.matches;
    const warmup = async figure => {
      await warmMourningGeometry(this.renderer, figure);
      await warmMourningMaterials(this, figure);
    };
    this.mourningAsset = preloadMourningFigure(desktop ? warmup : undefined);
    if (desktop) scheduleOfficeCreatureTextures(this.renderer);
  }

  preparePhasePrograms() {
    if (!this.desktopPointer.matches) return;
    const { renderer, stage } = this;
    const office = this.theme === 1;
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
    this.particles = this.rain = null;
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
      edgeMetal: standard(this.theme === 2 ? '#5c6d70' : '#655c53', { ...surfaces.steel, metalness: .57, roughness: .42 }),
      plasterEdge: standard(this.theme === 2 ? '#7b817d' : '#aaa99b', { roughness: .72 }),
      lacquer: standard(this.theme === 1 ? '#4c3c32' : '#51453a', { roughness: .44, metalness: .13 }),
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
    const height = roof ? ROOF_WALL_HEIGHT : 3.28;
    b.box(m.wall, x, height / 2 - .13, z, TILE + .025, height + .26, TILE + .025, 0, tint(random(col * 771 + row * 297)()));
    const exposed = (dx,dz) => {
      const neighbor = this.decoded.get(col+dx,row+dz);
      return Boolean(neighbor && neighbor.kind !== '#');
    };
    if (roof && FACES.some(([dx,dz])=>exposed(dx,dz))) {
      this.junctionPoint('RoofCopingBed',x,height,z,0,1);
      for (const [dx,dz,yaw] of [[1,1,0],[1,-1,Math.PI/2],[-1,-1,Math.PI],[-1,1,-Math.PI/2]]) {
        if (exposed(dx,0) && exposed(0,dz)) {
          this.junctionPoint('RoofCopingCorner',x+dx*HALF,height,z+dz*HALF,Math.sin(yaw),Math.cos(yaw));
        }
      }
    }
    for (let face = 0; face < FACES.length; face++) {
      const [dx, dz] = FACES[face];
      const next = this.decoded.get(col + dx, row + dz);
      if (!next || next.kind === '#') continue;
      const xFace = x + dx * (HALF + .018);
      const zFace = z + dz * (HALF + .018);
      const angle = dx ? Math.PI / 2 : 0;
      const joint = this.junctionPoint(roof ? 'RoofCoping' : this.theme === 1 ? 'ArchiveJunction' : 'BoilerJunction',
        xFace,roof ? height : 0,zFace,dx,dz);
      if (roof) {
        b.box(m.dark,xFace,1.29,zFace,TILE+.04,.14,.094,angle);
        joint.box(m.steel,xFace,1.44,zFace,TILE,.08,.15,angle);
      } else {
        joint.box(m.dark,xFace,.13,zFace,TILE+.04,.14,.094,angle);
      }
      if (this.theme === 1) {
        b.box(m.low, xFace, .54, zFace, TILE, .87, .055, angle);
        b.box(m.accent, xFace, .983, zFace, TILE, .083, .10, angle);
        b.box(m.bone, xFace, 2.91, zFace, TILE, .07, .055, angle);
      } else if (!roof) {
        b.box(m.low, xFace, .44, zFace, TILE, .63, .055, angle);
        b.box(m.steel, xFace, .76, zFace, TILE, .037, .075, angle);
        b.box(m.dark, xFace, 2.73, zFace, TILE, .13, .11, angle);
      }
      this.wallFeature(tile, dx, dz, xFace, zFace, angle, next.kind);
    }
  }

  junctionPoint(name,x,y,z,dx,dz) {
    return this.architecturePoint(name,x,y,z,dx,dz,'neutral',this.junctions);
  }

  detailPoint(name,x,y,z,yaw=0) {
    return this.architecturePoint(name,x,y,z,Math.sin(yaw),Math.cos(yaw),'neutral',this.detail);
  }

  utilityPoint(name,x,y,z,yaw,scale = []) {
    return this.architecturePoint(name,x,y,z,Math.sin(yaw),Math.cos(yaw),'neutral',this.utilities,scale);
  }

  architecturePoint(name,x,y,z,dx,dz,phase = 'neutral',collection = this.architecture,scale = []) {
    const batch = this.architectureBatch(name,phase,collection);
    collection.get(name).points.push([x,y,z,Math.atan2(dx,dz),...scale]);
    return batch;
  }

  architectureBatch(name,phase,collection) {
    if (!collection.has(name)) {
      const fallback = new THREE.Group();
      fallback.name = 'Architecture fallback: ' + name;
      (phase === 'neutral' ? this.stage : this.groups[phase]).add(fallback);
      this.batches['architecture-' + name] = new Batch(fallback);
      collection.set(name,{points:[],fallback,phase});
    }
    return this.batches['architecture-' + name];
  }

  wallFeature(tile, dx, dz, x, z, angle, neighbor) {
    const m = this.materials;
    const b = this.batches.neutral;
    const roof = this.theme === 2;
    const pattern = (tile.row * 19 + tile.col * 13 + (dx + 2) * 7 + dz * 17) % 19;
    const panel = (material, offset, y, width, height, depth, u = 0) =>
      b.box(material, x + dx * offset + dz * u, y, z + dz * offset - dx * u, width, height, depth, angle);
    const trim=(batch,material,offset,y,width,height,depth,u=0)=>
      batch.trim(material,x+dx*offset+dz*u,y,z+dz*offset-dx*u,width,height,depth,angle);
    const handoverWall=this.theme===1 && tile.col===9 && tile.row===0 && dz===1;
    let oldPlate=b, plateOffset=0;
    if (pattern % (roof ? 7 : 5) === 0) {
      const [name,u,y]=roof ? ['RoofInspectionCover',.48,.40] : this.theme===1 ?
        ['ArchiveSocketPlate',pattern>=13 ? .994 : .91,1.58] : ['BoilerControlPlate',-.65,1.52];
      // This continuous wall bay also carries the public-register board.
      // Clear its right edge instead of mounting a socket partly behind it.
      // Pattern zero pairs the control with a vertical feed. Keep its junction
      // block and shift the independent plate clear of the drop pipe.
      const fitted=u+(handoverWall ? .194 : this.theme===0 && pattern===0 ? .32 : 0);
      plateOffset=fitted-(roof ? .48 : this.theme===1 ? .91 : -.65);
      oldPlate=this.detailPoint(name,x+dz*fitted,y,z-dx*fitted,Math.atan2(dx,dz));
    }
    dressArchitecture(this.theme,pattern,(...args)=>trim(b,...args),m,
      (material,offset,y,w,h,d,u=0)=>trim(oldPlate,material,offset,y,w,h,d,u+plateOffset));
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
      this.boilerPipeRun(tile,dx,dz,x,y,z);
      if (pattern % 4 === 2) this.utilityPoint('CeilingFeed',x+dz*.34,y,z-dx*.34,Math.atan2(dx,dz));
      const ox = -dz * (pattern < 9 ? .74 : -.74);
      const oz = dx * (pattern < 9 ? .74 : -.74);
      const saddle = this.architecturePoint('PipeSaddle',x+ox,y,z+oz,dx,dz);
      saddle.box(m.steel, x + ox, y - .05, z + oz, .105, .205, .202, angle);
      saddle.box(m.rust, x - dx * .018 + ox, y - .28, z - dz * .018 + oz, .049, .38, .028, angle);
      if (pattern < 5) {
        // Carry a visible supply line into the wall instead of ending it at every bay.
        const dropX = x + ox + dx * .053;
        const dropZ = z + oz + dz * .053;
        b.pipe(m.copper, new THREE.Vector3(dropX, .08, dropZ), new THREE.Vector3(dropX, y, dropZ), .066);
        const union = this.architecturePoint('SupplyUnion',x+ox,y,z+oz,dx,dz);
        union.box(m.dark,dropX,2.33,dropZ,.18,.18,.18,angle);
        panel(m.dark, .064, 1.58, .112, .105, .091, pattern < 9 ? -.74 : .74);
      }
      if (pattern % 5 === 0 && neighbor === '.') {
        const vent = this.architecturePoint('BoilerLouvre',x,.68,z,dx,dz);
        vent.box(m.steel,x+dx*.10,.68,z+dz*.10,1.46,1.04,.22,angle);
        vent.box(m.dark,x+dx*.229,.68,z+dz*.229,1.29,.84,.032,angle);
        for (let i = 0; i < 5; i++) vent.box(m.steel,x+dx*.259,.38+i*.14,z+dz*.259,1.23,.055,.053,angle);
      }
    } else {
      panel(m.accent, .016, .54, .050, .76, .10, -.97);
      const occupied=handoverWall || hasArchiveWallSign(tile.col,tile.row,dx,dz) ||
        ARCHIVE_OCCUPIED_FACES.has(`${tile.col}/${tile.row}/${dx}/${dz}`);
      if (occupied) return;
      if (pattern >= 13 && neighbor === '.') {
        const sash = this.architecturePoint('ArchiveWindow',x,1.87,z,dx,dz);
        sash.box(m.accent,x+dx*.046,1.87,z+dz*.046,1.58,1.14,.14,angle);
        sash.box(m.frosted,x+dx*.132,1.89,z+dz*.132,1.38,.93,.034,angle);
        sash.box(m.bone,x+dx*.113,1.29,z+dz*.113,1.64,.074,.17,angle);
      } else if (pattern === 1 || pattern === 7) {
        const door = this.architecturePoint('ArchiveDoor',x,0,z,dx,dz);
        door.box(m.accent,x+dx*.035,1.18,z+dz*.035,.94,2.35,.09,angle);
        door.box(m.low,x+dx*.084,1.13,z+dz*.084,.76,2.16,.04,angle);
        door.box(m.frosted,x+dx*.110,1.82,z+dz*.110,.48,.71,.018,angle);
      }
    }
  }

  boilerPipeRun(tile,dx,dz,x,y,z) {
    const tx=dz, tz=-dx;
    const wall=(x,z)=>this.decoded.get(x,z)?.kind==='#';
    const pipe=(batch,start,end)=>{
      for (const [height,diameter,material] of [[y,.136,this.materials.copper],[y+.21,.07,this.materials.dark]]) {
        batch.pipe(material,new THREE.Vector3(x+tx*start,height,z+tz*start),new THREE.Vector3(x+tx*end,height,z+tz*end),diameter);
      }
    };
    const endPoints=[-1,1].map(sign=>{
      const floorX=tile.col+dx, floorZ=tile.row+dz;
      const sx=sign*tx, sz=sign*tz;
      if (wall(floorX+sx,floorZ+sz)) {
        const end=sign*(HALF-.270);
        if (dx) {
          // Only the X-facing branch instantiates the mirrored quarter bend.
          // Yaw maps its positive X/Z tangents away from the two wall planes.
          const ix=dx, iz=-sz;
          const yaw=ix>0 ? (iz>0?0:Math.PI/2) : (iz>0?-Math.PI/2:Math.PI);
          this.utilityPoint('PipeCorner',x+sx*(HALF-.018),y,z+sz*(HALF-.018),yaw);
        }
        pipe(this.architectureBatch('PipeCorner','neutral',this.utilities),end,sign*HALF);
        return end;
      }
      if (!wall(tile.col+sx,tile.row+sz)) {
        this.utilityPoint('PipeStop',x+sx*(HALF-.028),y,z+sz*(HALF-.028),Math.atan2(-sz,sx));
      }
      return sign*HALF;
    });
    pipe(this.batches.neutral,...endPoints);
  }

  makeFloor(tile) {
    const { x, z, col, row, kind } = tile;
    if (this.theme===2 && !PHASE[kind]) this.makeRoofInsideReturn(tile);
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
        this.detailPoint('BoilerCeilingJoist',x,3.022,z+.85).box(m.dark,x,3.12,z+.85,TILE+.025,.2,.16);
      } else if (this.theme === 1 && row % 4 === 2) {
        this.detailPoint('ArchiveCeilingJoist',x,3.071,z+1.10).box(m.low,x,3.163,z+1.10,TILE+.025,.17,.27);
      }
      if (PHASE[kind]) this.batches.neutral.box(m.low, x, -5.8, z, TILE + .012, .2, TILE + .012);
    }
    if (PHASE[kind]) {
      const phase = PHASE[kind];
      const light = m[phase + 'Line'];
      const rail = phase === 'day' ? m.brass : m.steel;
      const deck = this.architecturePoint(phase === 'day' ? 'PhaseDeckDay' : 'PhaseDeckNight',x,0,z,0,1,phase);
      for (let tread = 0; tread < 9; tread++) {
        const u = (tread - 4) * .246;
        deck.box(material, x + u, -.049, z, .172, .098, 2.24, 0, tint(variant()));
        for (const offset of [-.62, .62]) deck.box(m.dark, x + u, -.006, z + offset, .149, .016, .043);
      }
      for (const direction of [-1, 1]) {
        deck.box(rail, x + direction * 1.144, -.043, z, .09, .087, TILE - .015);
        deck.box(rail, x, -.043, z + direction * 1.145, TILE - .017, .086, .087);
        deck.box(m.dark, x, -.14, z + direction * .975, TILE - .04, .085, .1);
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
      this.detailPoint('RoofSoffitField',x,0,z).box(m.low,x,-.65,z,TILE-.015,.93,TILE-.015);
      this.makeRoofFascia(tile);
    }
    if (this.theme === 0 && (col + row * 7) % 8 === 0) {
      batch.box(m.accent, x + .9, .006, z, .045, .016, 2.28);
    }
    const archiveCorner = this.theme === 1 && kind === '.' &&
      (col === 9 && row === 10 || col === 21 && row === 9 ||
       row === 2 && (col === 12 || col === 14) || col === 11 && row === 13);
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

  makeRoofInsideReturn({x,z,col,row}) {
    const kind=(dx,dz)=>this.decoded.get(col+dx,row+dz)?.kind;
    const deck=kind=>kind && !PHASE[kind] && kind!=='#';
    for (const [dx,dz,yaw] of [[1,1,0],[1,-1,Math.PI/2],[-1,-1,Math.PI],[-1,1,-Math.PI/2]]) {
      const gap=kind(dx,dz);
      // Three permanent slabs at a re-entrant edge, with the fourth
      // quadrant absent or phasing. No added crossing or phase marker.
      if (!deck(kind(dx,0)) || !deck(kind(0,dz)) || (gap && !PHASE[gap])) continue;
      this.architecturePoint('RoofDeckInsideCorner',x+dx*HALF,-.081,z+dz*HALF,
        Math.sin(yaw),Math.cos(yaw),'neutral',this.fit);
    }
  }

  makeRoofFascia(tile) {
    const m = this.materials;
    const cell=(dx,dz)=>this.decoded.get(tile.col+dx,tile.row+dz);
    const exposed=(dx,dz)=>{
      const adjacent=cell(dx,dz);
      return !adjacent || Boolean(PHASE[adjacent.kind]);
    };
    for(const [dx,dz,yaw] of [[1,1,0],[1,-1,Math.PI/2],[-1,-1,Math.PI],[-1,1,-Math.PI/2]]) {
      if(!exposed(dx,0)||!exposed(0,dz)) continue;
      // The folded lap sits below its permanent tile, not on either bridge.
      // Keep the original folded edge runs as the low-detail load fallback.
      this.architecturePoint('RoofFasciaCorner',tile.x+dx*HALF,0,tile.z+dz*HALF,
        Math.sin(yaw),Math.cos(yaw),'neutral',this.roofCorners);
    }
    for (const [dx, dz] of FACES) {
      if (!exposed(dx,dz)) continue;
      // Permanent roof edges only. Keep the trim entirely under the neutral slab.
      const x = tile.x + dx * (HALF - .063);
      const z = tile.z + dz * (HALF - .063);
      const angle = dx ? Math.PI / 2 : 0;
      const alongX=Math.abs(dz),alongZ=Math.abs(dx); // Pick one owner per seam.
      const next=cell(alongX,alongZ);
      if(next&&next.kind!=='#'&&!PHASE[next.kind]&&exposed(dx+alongX,dz+alongZ)) {
        this.architecturePoint('RoofFasciaSplice',x+alongX*HALF,0,z+alongZ*HALF,dx,dz,'neutral',this.roofSplices);
      }
      const b = this.architecturePoint('RoofEdge',x,0,z,dx,dz);
      this.junctionPoint('RoofSoffitEdge',x,0,z,dx,dz);
      b.box(m.steel, x, -.235, z, TILE - .021, .13, .10, angle);
      b.box(m.wall, x, -1.34, z, TILE - .028, 1.41, .093, angle);
      if ((tile.row + tile.col) % 3 === 0) {
        b.box(m.dark, x, -1.12, z, .14, 1.52, .101, angle);
      }
    }
  }

  fixture(x, y, z, type) {
    const m = this.materials;
    const lens = type === 'safe' ? m.safe : m.lamp;
    if (this.theme === 2) {
      const exit = type === 'safe';
      const [dx,dz] = exit ? this.exitFace(this.decoded.exit) : [0,1];
      // Keep the exit post beside the new apron rather than in its approach.
      const px=x+dz*(exit?1.052:.33), pz=z-dx*(exit?1.052:.33);
      const yaw=Math.atan2(dx,dz);
      const lamp=this.utilityPoint(exit?'RoofExitLamp':'RoofLamp',px,0,pz,yaw);
      x=px-dz*.29; z=pz+dx*.29;
      lamp.box(m.steel,x,y+.08,z,.68,.14,.36,yaw);
      lamp.box(lens,x,y,z,.52,.052,.18,yaw);
      lamp.box(m.steel,px,y/2,pz,.047,y,.047);
      lamp.box(m.dark,px,.067,pz,.22,.13,.21);
    } else if (this.theme === 1) {
      const { row, col } = this.decoded.at(x, z);
      const narrow = this.decoded.get(col-1,row)?.kind === '#' || this.decoded.get(col+1,row)?.kind === '#';
      const damaged = (col * 19 + row * 7) % 5 < 2 && type !== 'safe';
      const angle = narrow ? Math.PI/2 : 0;
      this.archiveFixtures.push({ x, y, z, angle, damaged });
      this.detailPoint('ArchiveLightFeed',x,y,z,angle);
      this.batches.archiveFixture.box(m.dark, x, y + .07, z, 1.12, .145, .38);
      this.batches.archiveFixture.box(lens, x, y - .029, z, .90, .042, .24);
      this.lightSource(x, y - .11, z, damaged ? 10.8 : 21, type, damaged ? .46 : .64);
      return;
    } else {
      const b=this.detailPoint(type==='safe'?'BoilerExitLight':'BoilerWorkLight',x,y,z);
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
    const m = this.materials;
    const place = (key, x, y, z, yaw, light) => {
      if (!this.mapDressing.has(key)) {
        const [file,size] = MAP_DRESSING[key];
        const fallback = new THREE.Group();
        fallback.name = `Dressing fallback: ${key}`;
        this.stage.add(fallback);
        this.batches['dressing-' + key] = new Batch(fallback);
        this.mapDressing.set(key,{file,size,points:[],fallback});
      }
      this.mapDressing.get(key).points.push({x,y,z,yaw,light});
      return this.batches['dressing-' + key];
    };
    // Hand fitted, always mounted beside permanent walkable tiles. Yaw faces
    // the room rather than mounting the controls and service faces to masonry.
    const service=(key,col,row,dx,dz,u,y,gap=.02)=>{
      const tile=this.decoded.get(col,row), floor=this.decoded.get(col+dx,row+dz);
      if(tile?.kind!=='#'||floor?.kind!=='.')return;
      const [,size]=MAP_DRESSING[key];
      const depth=HALF+.025+size[2]/2+gap;
      const x=tile.x+dx*depth+dz*u,z=tile.z+dz*depth-dx*u;
      const yaw=Math.atan2(dx,dz);
      const fallback=place(key,x,y,z,yaw,.96);
      const color=key==='generator'?m.dark:key==='hose'?m.copper:m.steel;
      fallback.trim(color,x,y+size[1]/2,z,...size,yaw);
    };
    if(this.theme===0) {
      service('generator',7,18,0,-1,.43,.005,.037);
      service('generator',4,13,0,1,.20,.005,.037);
    } else if(this.theme===1) {
      service('utilityBox',12,17,0,-1,0,1.10,-.015);
    } else {
      // West face is free of the simulated irrigation valve and grille.
      service('hose',9,7,-1,0,0,.48,-.015);
      service('hose',21,8,0,-1,0,.48,-.015);
    }
    for (const tile of this.decoded.floors) {
      if (!PROPS.has(tile.kind)) continue;
      // Hand-placed archive cabinets own these bays. Don't layer random desks over them.
      if (this.theme === 1 && ((tile.col === 9 && tile.row === 16) || (tile.col === 8 && tile.row === 14))) continue;
      const n = (tile.col * 71 + tile.row * 57) % 31;
      const edge = this.edgeOffset(tile);
      if (Math.abs(edge.dx) + Math.abs(edge.dz) === 0 || n > 13) continue;
      const { x, z, angle, dx, dz } = edge;
      const hasWall = this.decoded.get(tile.col + dx, tile.row + dz)?.kind === '#';
      if (!hasWall && this.theme !== 2) continue;
      const yaw = Math.atan2(-dx, -dz);
      const light = .89 + .021 * (n % 8);
      if (this.theme === 0) {
        if (n < 7) {
          const b = place('cylinder',x,0,z,yaw,light);
          b.add(unitCylinder, m.dark, [x, .86, z], [.55, 1.7, .55]);
          b.add(unitSphere, m.steel, [x, 1.72, z], [.54, .30, .54]);
          for (const y of [.20, .64, 1.48]) b.add(unitCylinder, m.copper, [x, y, z], [.57, .055, .57]);
          b.pipe(m.copper, new THREE.Vector3(x, 1.8, z), new THREE.Vector3(x + dx * .36, 2.38, z + dz * .36), .10);
        } else {
          const neutral = this.batches.neutral;
          neutral.box(m.dark, x, .031, z, .45, .062, .37, angle);
          const b = place('toolbox',x,.062,z,yaw,light);
          b.box(m.accent, x, .20, z, .49, .276, .41, angle);
        }
      } else if (this.theme === 1) {
        if (n < 9) {
          const b = place('desk',x,0,z,yaw,light);
          const stationery = place('notepads',x - dx*.024,.821,z - dz*.024,yaw + .045*(n-4),light);
          stationery.box(m.bone,x,.848,z,.27,.035,.24,angle);
          b.box(m.accent, x, .79, z, 1.57, .11, .48, angle);
          for (const side of [-1, 1]) {
            b.box(m.dark, x + dz * side * .65, .39, z - dx * side * .65, .13, .77, .39, angle);
          }
        } else {
          const b = place('cabinet',x,0,z,yaw,light);
          b.box(m.steel, x, .60, z, .52, 1.20, .48, angle);
          for (let d = 0; d < 4; d++) {
            b.box(m.dark, x - dx * .248, .18 + d * .27, z - dz * .248, .455, .048, .026, angle);
            b.box(m.brass, x - dx * .268, .22 + d * .27, z - dz * .268, .12, .036, .028, angle);
          }
        }
      } else if (n > 10) {
        // Keep the entry nursery separate from the wider demonstration trough.
        if (tile.col === 9 && tile.row === 14) this.planter(tile.x - .62, z, angle, n);
        else this.planter(x, z, angle, n);
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
      this.makeFan(x + 4.91, 1.67, z - 5.74, .69);
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
    }
  }

  makeFan(x, y, z, radius) {
    const m = this.materials;
    const group = new THREE.Group();
    group.name = 'Arrival extractor fallback';
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
    const b = this.batches.nurseryFallback;
    const rng = random(seed + Math.floor(x * 31));
    this.roofNurseries.push({ x, z, angle, flip: seed % 2, shade: .89 + rng() * .13 });
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
    const color = type === 'safe' ? SAFE : type === 'alarm' ? YELLOW : type === 'bulkhead' ? OFFICE_EMERGENCY :
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
    const b = this.batches.lampFallback;
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
    this.safeLamps.push({ tile, pool, beacon, x, z, angle });
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
    let action, doorLeaf = null;
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
        doorLeaf = new THREE.Group();
        doorLeaf.name = 'Gary office door on a spring hinge';
        doorLeaf.position.set(-.59, 0, .38);
        desk.add(doorLeaf);
        mesh(doorLeaf, unitBox, m.accent, [.59, 1.01, 0], [1.18, 2.01, .12]);
        mesh(doorLeaf, unitBox, m.steel, [.59, 1.06, -.073], [.93, 1.81, .031]);
        mesh(doorLeaf, unitBox, m.brass, [.92, .90, -.115], [.085, .09, .072]);
        const plaque = spriteText('GARY', '#e6d5ab');
        this.localTextures.push(plaque);
        const name = mesh(doorLeaf, unitPlane, new THREE.MeshBasicMaterial({ map: plaque }), [.69, 1.53, -.101], [.42, .105, 1]);
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
    const record = { indicator, action, doorLeaf, motion: {}, kind: power ? 'power' : 'station' };
    if (!power && (this.theme === 2 || (this.theme === 0 && id !== 'C'))) {
      const outletSide = this.theme === 2 ? .272 : .16;
      record.outlet = { x: x - dx * .26 + dz * outletSide, y: this.theme === 2 ? .67 : .69,
        z: z - dz * .26 - dx * outletSide, yaw: Math.atan2(-dx, -dz), source: null };
    }
    this.objects.set(id, record);
  }

  makePhonographMarker(tile) {
    const x = tile.x - .38, z = tile.z;
    // The turntable has engraved lettering and a physical direction card.
    // Let its practical graze the rim rather than bleach the bell from the front.
    this.lightSource(x + .55, 1.46, z + .16, 2.45, 'alarm', .29);
  }

  makeClue(tile) {
    const id = tile.key || tile.kind;
    const { x, z, dx, dz } = this.edgeOffset(tile, .78);
    const m = this.materials;
    const yaw = Math.atan2(-dx,-dz);
    const fallback = new THREE.Group();
    this.stage.add(fallback);
    const stand = this.batches['evidence-' + id] = new Batch(fallback);
    stand.box(m.dark, x, .35, z, .39, .70, .39);
    stand.box(m.steel, x, .71, z, .52, .055, .42);
    this.inspection.push({name:evidenceStand(this.theme),x,y:0,z,yaw,fallback});

    const indicator = new THREE.Group();
    const name = evidenceModel(this.theme,id);
    indicator.name = 'Evidence: ' + name;
    indicator.position.set(x,.7545,z);
    indicator.rotation.y = yaw;
    this.stage.add(indicator);
    const blank = mesh(indicator, unitBox, emit('#e1b88d', .36), [0,.010,0], [.24,.021,.33]);
    this.inspection.push({name,indicator,fallback:blank});
    this.objects.set(id,{indicator,kind:'clue'});
  }

  makeHazard(tile) {
    const phase = tile.kind === '~' ? 'day' : 'night';
    const group = this.groups[phase];
    const { x, z } = tile;
    const m = this.materials;
    const fallback = new THREE.Group();
    group.add(fallback);
    const b = this.batches['outlet-' + tile.col + '/' + tile.row] = new Batch(fallback);
    this.inspection.push({name:phase === 'day' ? 'HeatOutlet' : 'ColdReturn',x,y:0,z,yaw:0,phase,fallback});
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
    this.objects.set(`hazard-${tile.col}-${tile.row}`, {
      indicator: pulse, kind: 'hazard', tile,
      outlet: { x, y: .093, z, yaw: (tile.col * .27 + tile.row * .22) % (Math.PI * 2), source: pulse }
    });
  }

  exitFace(tile) {
    return FACES.find(([dx,dz])=>{
      const next=this.decoded.get(tile.col+dx,tile.row+dz);
      return !next || next.kind==='#';
    }) ?? [0,1];
  }

  makeDoor(tile) {
    const { x, z } = tile;
    const m = this.materials;
    const [dx,dz] = this.exitFace(tile);
    const g = new THREE.Group();
    g.position.set(x + dx * .71, 0, z + dz * .71);
    g.rotation.y = Math.atan2(dx, dz);
    this.stage.add(g);
    this.doorMount = g;
    this.junctionPoint('LiftApron',x+dx*.461,0,z+dz*.461,-dx,-dz);
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
    const rng = random(3197);
    const towerFootprints=[];
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
    this.cityGroundFallback=new THREE.Group();
    this.cityGroundFallback.name='Distant grade fallback';
    this.stage.add(this.cityGroundFallback);
    this.batches.cityGrade=new Batch(this.cityGroundFallback);
    this.batches.cityGrade.box(street,mx,-22,mz,216,.1,216);
    for (let i = 0; i < 68; i++) {
      const a = i / 68 * Math.PI * 2 + rng() * .09;
      const radius = 73 + rng() * 24;
      const width = 2.3 + rng() * 5.4;
      const height = 5.0 + rng() ** 2 * 21.5;
      const x = mx + Math.cos(a) * radius;
      const z = mz + Math.sin(a) * radius;
      const yaw=.13+rng()*.18, tone=tint(rng());
      const name=['FarCityOffice','FarCityBrick','FarCityService'][i%3];
      towerFootprints.push({x,z,width,depth:width,turn:yaw,far:true});
      const far=this.utilityPoint(name,x,-22,z,yaw,[width,height,width]);
      far.box(distant,x,height/2-22,z,width,height,width,yaw,tone);
      if (i%3===0) far.box(distant,x,height-21.3,z,width*.64,1.4,width*.55,.15);
    }
    const fallback = new THREE.Group();
    fallback.name = 'Midground skyline fallback';
    this.stage.add(fallback);
    this.skyline = { fallback, sites: [], lights: [] };
    const near = this.batches.skylineFallback = new Batch(fallback);
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
      this.skyline.sites.push({ x,z,width,depth,height,style:(i*5 + Math.floor(i/7)) % 3,
        turn: i % 2 ? 0 : Math.PI, light: facade.r });
      towerFootprints.push(this.skyline.sites.at(-1));
      near.box(city, x, height / 2 - 22, z, width, height, depth, 0, facade);
      near.box(concrete, x, top + .095, z, width + .17, .19, depth + .17, 0, facade);
      if (i % 2 === 0) near.box(city, x - width * .13, top + .55, z, width * .52, 1.1, depth * .55, 0, facade);
      if (i % 4 === 0) near.box(concrete, x, top + 1.23, z, .09, 2.2, .09);
      const activity = .61 + rng() * .35;
      const columns = Math.floor(width / .89);
      const rows = Math.floor(depth / .89);
      const step = i % 3 === 0 ? 1.18 : .92;
      for (let y = top - .72; y > Math.max(-13, top - 13); y -= step) {
        near.box(concrete, x, y + .31, front, width, .066, .08, 0, facade);
        for (let column = 0; column < columns; column++) {
          const u = (column / columns - .5 + .5 / columns) * width;
          const open = rng() > activity;
          near.box(open ? windows : glass, x + u, y, front, .45, .36, .026, 0, open ? tint(rng()) : facade);
        }
        for (let column = 0; column < rows; column++) {
          const u = (column / rows - .5 + .5 / rows) * depth;
          const open = rng() > activity + .075;
          near.box(open ? windows : glass, side, y, z + u, .026, .34, .44, 0, open ? tint(rng()) : facade);
        }
      }
    }
    for(const [name,points] of planCityGround(mx,mz,towerFootprints)) {
      for(const [x,y,z,yaw,sx,sy,sz] of points) this.architecturePoint(name,x,y,z,
        Math.sin(yaw),Math.cos(yaw),'neutral',this.cityGround,[sx,sy,sz]);
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
    if (this.theme === 2) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 6), 3));
      this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: '#bedcf0', transparent: true, opacity: 0, depthWrite: false
      }));
      this.rain.frustumCulled = false;
      this.stage.add(this.rain);
    }
  }

  updateGhosts(state, dt, reduced, execution = null) {
    const seen = new Set();
    let faceExposure = 1;
    for (const [index, ghost] of (state.ghosts || []).entries()) {
      const key = ghost.key ?? ghost.id ?? index;
      seen.add(key);
      const visible = ghost.active !== false && (ghost.phase !== 'night' || state.night) &&
        (ghost.phase !== 'day' || !state.night) &&
        (ghost.kind !== 'mourning' || !mourningHiddenByPartition(this.decoded, state, ghost, TILE));
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
      const capture = attacking && ghost.kind === 'mourning' ? execution : null;
      const attack = capture?.reach ?? (attacking ? THREE.MathUtils.smoothstep(state.lifeTimer, 0, .18) *
        (1 - .44 * THREE.MathUtils.smoothstep(state.lifeTimer, .47, .93)) : 0);
      const { x, z } = ghost;
      const dx = x - actor.group.position.x;
      const dz = z - actor.group.position.z;
      const travel = Math.hypot(dx, dz);
      const moving = wasVisible && actor.placed && travel > .002;
      const bearing = moving && threat < .33 && !attack ? Math.atan2(dx, dz) : toward;
      const turn = bearing - actor.group.rotation.y;
      actor.group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) *
        (wasVisible ? Math.min(1, dt * (attack ? 17 : 8)) : 1);
      const stagger = state.reduceMotion ? 0 : (ghost.stagger ?? 0);
      actor.group.rotation.x = -.22 * Math.min(1, stagger * 2);
      actor.group.rotation.z = .13 * Math.sin(stagger * 14) * stagger;
      actor.group.position.set(x, ghost.y || 0, z);
      actor.placed = true;
      updateCreature(actor, { time: state.time || 0, threat, attack, night: state.night, distance, reduced,
        moving, dt, travel, gazeLock: ghost.gaze || 0, watching: ghost.watching, charging: ghost.charging, capture, stagger,
        transfer: state.chase ? { danger: state.chase.danger, vault: ghost.y || 0, started: state.chase.started } : null });
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
    const steady = state.reduceMotion || state.reducedMotion;
    this.fill.color.set(state.chase ? '#eee1b0' : office ? '#b9c9bf' : roof ? '#dbe5f4' : '#cdd8e2').lerp(COLD, night * .8);
    // Leave the player/task lamps and bridge strips legible; pull broad
    // night fill off the roof so backlit figures are silhouettes, not grey fog.
    this.fill.intensity = state.chase ? 1.3 - night * .3 : roof ? 1.50 - night * .80 : office ? .55 - night * .22 : .94 - night * .22;
    if (office) {
      this.materials.frosted.emissiveIntensity = .09 + night * .13;
      if (this.archiveTube) this.archiveTube.emissiveIntensity = 2.15 - night * 1.20;
      if (this.archiveBulkhead) this.archiveBulkhead.emissiveIntensity = .70 + night * 2.45;
    }
    this.scene.environmentIntensity = roof ? .63 - night * .31 : office ? .34 - night * .09 : .57 - night * .19;
    this.rim.color.set(roof ? '#ffd0a6' : '#ffd8a5').lerp(COLD, night);
    this.rim.intensity = roof ? 1.85 - night * .61 : office ? .20 - night * .08 : .64 - night * .12;
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
    this.lamp.intensity = ((roof ? 5.8 : office ? 7.6 : 13.8) +
      night * (office ? 16.2 : 13.5) + (steady ? 0 : Math.sin(time * 18) * .15 * night)) * exposure;
    this.eyeFill.position.copy(this.camera.position);
    this.eyeFill.intensity = ((office ? .24 : .55) + night * .66) * exposure;
    if (time < this.fixtureSearchTime || time - this.fixtureSearchTime >= .12) {
      this.fixtureSearchTime = time;
      this.nearestFixtures = this.ambience
        .map(source => ({ source, distance: (source.x - state.x) ** 2 + (source.z - state.z) ** 2 }))
        .filter(({ source, distance }) => distance < (office ? 14 : 20) ** 2 &&
          (!office || !firstSightWall(this.decoded, state.x, state.z, source.x, source.z, TILE)))
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
      const pulse = steady ? 1 : office ? .96 + .04 * Math.sin(time * 2 + seed) :
        .84 + .13 * Math.sin(time * 4 + seed) + .03 * Math.sin(time * 15 + seed);
      const power = source.type === 'bulkhead' ? .23 + night * 1.03 :
        (office && source.type === 'general' ? 1 - night * .69 : 1);
      light.distance = office ? (source.type === 'bulkhead' ? 6.4 : 9.5) : 12;
      light.decay = office ? 2 : 1.7;
      light.color.copy(source.color);
      if (source.type === 'general') light.color.lerp(COLD, night * .91);
      light.intensity = source.strength * power * pulse * (1 - Math.min(1, distance / 400) ** 1.4);
    }
    const { bulbs, tints } = this.atmosphere.uniforms;
    for (let i = 0; i < bulbs.value.length; i++) {
      const entry = near[i];
      if (!entry) {
        bulbs.value[i].set(0, 0, 0, 0);
        continue;
      }
      const { source } = entry;
      const scattering = office ? this.nearLights[i].intensity * .067 : source.strength * .095;
      const ceilingSource = source.y > 2.3 || source.type === 'bulkhead';
      bulbs.value[i].set(source.x, source.y, source.z, ceilingSource ? scattering : 0);
      tints.value[i].copy(this.nearLights[i].color);
    }
    for (const source of this.ambience) {
      if (source.type === 'general') source.sprite.material.color.copy(source.color).lerp(COLD, night * .9);
      const variation = steady ? 0 : .05 * Math.sin(time * 1.75 + source.x * .4);
      source.sprite.material.opacity = source.type === 'bulkhead' ? .06 + night * .27 :
        (office && source.type === 'general' ? .19 + variation - night * .085 : .23 + variation + night * .08);
    }
    for (const { tile, pool, beacon } of this.safeLamps) {
      const active = state.checkpoint === tile || state.checkpoint === `${tile.col}/${tile.row}`;
      pool.material.opacity = active ? .31 + .06 * Math.sin(time * 3) : .12;
      if (active) beacon.material.opacity += .15;
    }
  }

  render(state, dt, elapsed = dt, shot = null) {
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
    if ((!shot || shot.settled) && this.desktopPointer.matches && (state.mode === 'paused' || state.mode === 'won')) {
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
    if (this.theme === 0 && state.completed?.size > 0 && !this.mourningAsset) this.prepareMourningAsset();
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
    const capture = clerkCaptureFrame(state, reduced);
    const lifeShot = capture ? null : ordinaryLifeShot(state.life, state.deathCause, lifeTime, reduced);
    const descent = capture?.stretch ?? lifeShot?.descent ?? 0;
    this.camera.position.set(state.x, (state.y || 0) + EYE + (capture ? 0 : bob) - descent, state.z);
    let yaw = state.yaw || 0;
    let pitch = (state.pitch || 0) + (shot?.pitch ?? 0) + (capture ? (reduced ? 0 : -.26 * descent) : lifeShot?.pitch ?? 0);
    const faceExposure = this.updateGhosts(state, dt, reduced, capture);
    if (caught && state.pursuer && capture && !reduced) {
      const actor = this.ghosts.get(state.pursuer.key ?? state.pursuer.id);
      const target = this.captureTarget.set(state.pursuer.x, 1.69, state.pursuer.z);
      if (actor?.head) {
        actor.head.getWorldPosition(target);
        target.y += .12;
      }
      const angle = Math.atan2(target.x - state.x, state.z - target.z);
      const back = -Math.sin(angle) * capture.recoil + Math.cos(angle) * capture.slide;
      const sideways = Math.cos(angle) * capture.recoil + Math.sin(angle) * capture.slide;
      // The camera is a witness to the contact, never allowed to drift through a wall.
      for (const fraction of [.33, .67, 1]) {
        const x = state.x + back * fraction, z = state.z + sideways * fraction;
        if (state.blocks(x, z, .12)) break;
        this.camera.position.x = x;
        this.camera.position.z = z;
      }
      const dx = target.x - this.camera.position.x, dz = target.z - this.camera.position.z;
      const facing = Math.atan2(dx, -dz) - yaw;
      yaw += Math.atan2(Math.sin(facing), Math.cos(facing)) * capture.aim;
      const head = Math.atan2(target.y - this.camera.position.y, Math.max(.25, Math.hypot(dx, dz)));
      pitch = THREE.MathUtils.lerp(pitch, THREE.MathUtils.lerp(head, -.49, capture.drop), capture.aim);
    } else if (caught && state.pursuer && !reduced) {
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
    if (shot?.forward) {
      const x = this.camera.position.x + this.view.x * shot.forward;
      const z = this.camera.position.z + this.view.z * shot.forward;
      if (!state.blocks(x, z, .12)) {
        this.camera.position.x = x;
        this.camera.position.z = z;
      }
    }
    this.camera.lookAt(delta.copy(this.camera.position).add(this.view));
    this.camera.rotateZ(lean + (reduced ? 0 : capture?.roll ?? lifeShot?.roll ?? 0));
    const fov = 65 + (state.sprint || state.sprinting ? 4 : 0) + shift * (reduced ? 0 : 2.5) +
      (reduced ? 0 : capture?.lens ?? 0);
    if (Math.abs(this.camera.fov - fov) > .01) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, Math.min(1, dt * 9));
      this.camera.updateProjectionMatrix();
    }
    this.janitorHands.update(state, dt, this.walk, this.velocity, capture, shot, lifeShot);
    // Prevent the flashlight from flattening a face at arm’s length.
    this.creatureExposure = THREE.MathUtils.lerp(this.creatureExposure, faceExposure, Math.min(1, dt * 13));
    const exposure = capture ? (capture.lamp ?? 1) * (1 - .71 * (capture.grip ?? 0)) :
      caught ? 1 - .94 * THREE.MathUtils.smoothstep(lifeTime, .015, .19) : this.creatureExposure;
    this.updateLights(state, time, night, exposure);
    updateBoilerBatches(this);
    const door = Math.min(1, Math.max(0, state.door || 0));
    const slide = door * door * (3 - 2 * door);
    if (this.liftLeaves) poseServiceLift(this.liftLeaves, door);
    if (this.door) {
      this.door.position.y = slide * 2.28;
      this.door.scale.y = 1 - slide * .91;
      this.door.visible = door < .99;
      this.doorLight.scale.setScalar(.78 + slide * .12);
    }
    this.backroomsSet?.update(state, dt);
    updatePlantSets(this, time, state.night, reduced);
    this.updateProps(state, time, reduced);
    this.air.update(state, this.doorMount, reduced);
    if (this.sky) {
      this.sky.position.copy(this.camera.position);
      this.sky.material.uniforms.night.value = night;
      this.sky.material.uniforms.time.value = reduced ? 0 : time;
      this.materials.street.color.set('#463938').lerp(this.fogCold, night);
      if(this.cityLamp)this.cityLamp.emissiveIntensity=.37+night*1.28;
      this.materials.windows.color.setRGB(.29 + night * .95, .21 + night * .66, .11 + night * .25);
      updateRoofSkyline(this.skyline,night);
      this.materials.distant.color.copy(this.scene.background).lerp(COLD, .15 + .08 * night);
    }
    for (const motor of this.kinetics) {
      motor.rotor.rotateZ(rotorStep(motor, dt, state.night, reduced));
    }
    this.updateParticles(state, time, quality, night, reduced);
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
    uniforms.life.value = capture ? .3 * capture.veil : (dying || revival ? .7 : 0) * (reduced ? .35 : 1);
    uniforms.lifeJitter.value = capture ? (reduced ? 0 : (capture.grit ?? 0) * .007) :
      .018 * uniforms.life.value * Math.sin(time * 23);
    const gazeTint = state.watching ? .12 + (state.gaze || 0) * .75 : 0;
    uniforms.danger.value = capture ? (capture.grip ?? 0) * .42 :
      dying ? 1 : hurt ? .6 : Math.max(gazeTint, Math.max(0, 3 - (state.hp ?? 3)) * .19);
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

  updateProps(state, time, reduced) {
    for (const [key, object] of this.objects) {
      if (object.kind === 'hazard') {
        const visible = hazardInPhase(object.tile, state.night);
        object.indicator.visible = visible;
        if (!visible) continue;
        const pressure = hazardPressure(hazardBeat(object.tile, time));
        object.indicator.material.opacity = .058 + pressure * (reduced ? .12 : .24);
        object.indicator.position.y = .21 + pressure * .26;
        object.indicator.scale.y = .59 + pressure * .78;
        if (!reduced && object.tile.kind === '~') this.air.discharge(object, state, 'steam', pressure);
      } else if (object.kind === 'clue') {
        object.indicator.visible = !(state.hasRecord?.(key) || state.clues?.has?.(key) || state.evidence?.has?.(key));
      } else {
        const done = object.kind === 'power' ? state.powered ?? state.progress?.powered : state.completed?.has?.(key);
        const age = stationAge(object.motion, Boolean(done), time);
        const pose = stationPose(this.theme, age, reduced);
        updateWorkstation(object, pose, time, reduced);
        const material = object.indicator.material;
        material.color.set(done ? '#71d9ad' : '#e8b262');
        material.emissive.copy(material.color);
        material.emissiveIntensity = done ? 1.4 : 1.15 + (reduced ? 0 : Math.sin(time * 4) * .27);
        object.action.rotation[this.theme === 1 ? 'x' : 'z'] = pose.action;
        if (object.doorLeaf) object.doorLeaf.rotation.y = pose.leaf;
        if (!reduced && object.outlet) {
          this.air.discharge(object, state, this.theme === 2 ? 'water' : 'steam', pose.discharge * .85);
        }
      }
    }
  }

  updateParticles(state, time, quality, night, reduced) {
    if (!this.particles) return;
    const shown = quality !== 'low';
    this.particles.visible = shown;
    if (this.rain) {
      this.rain.visible = shown && !reduced && night > .2;
      if (this.rain.visible) {
        const drops = this.rain.geometry.getAttribute('position');
        const wind = .21 + .08 * Math.sin(time * .55);
        for (let i = 0; i < drops.count / 2; i++) {
          const [a, b, c, speed] = this.flakes[i];
          const age = (b + time * (.54 + .26 * speed)) % 1;
          const x = state.x + (a - .5) * 21 + wind * age * 9;
          const z = state.z + (c - .5) * 21 - age * .9;
          const y = (1 - age) * 8;
          const length = .12 + .17 * speed;
          drops.setXYZ(i * 2, x, y, z);
          drops.setXYZ(i * 2 + 1, x - wind * length, y + length, z + length * .09);
        }
        drops.needsUpdate = true;
        this.rain.material.opacity = .24 * night;
      }
    }
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
