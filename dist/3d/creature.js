import { Group, MathUtils, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { clone } from './vendor/utils/SkeletonUtils.js';
import { makeCreatureBody, animateCreatureBody } from './creature-body.js';
import { createSculptedHead, animateSculptedHead } from './creature-head.js';

const { smoothstep } = MathUtils;

const DEPARTMENTS = ['boiler', 'office', 'roof'];
const SOURCE = new URL('./assets/creature/late-worker.glb', import.meta.url).href;
let template = null;
let loadPromise = null;

export function preloadCreatureAsset() {
  if (!loadPromise) {
    loadPromise = new GLTFLoader().loadAsync(SOURCE).then(result => {
      template = result.scene;
      return true;
    }).catch(error => {
      console.warn('Could not load the imported creature mesh.', error);
      return false;
    });
  }
  return loadPromise;
}

function fingerJoints(joints, side) {
  const point = label => joints.get(label + '.' + side).getWorldPosition(new Vector3());
  const middle = point('finger3-1').sub(point('wrist'));
  const breadth = point('finger5-1').sub(point('finger2-1'));
  const palm = middle.cross(breadth).normalize().multiplyScalar(side === 'R' ? 1 : -1);
  const curl = [];
  for (const finger of [2, 3, 4, 5]) {
    for (let link = 1; link <= 3; link++) {
      const label = 'finger' + finger + '-' + link;
      const direction = link === 3 ? point(label).sub(point('finger' + finger + '-2')) :
        point('finger' + finger + '-' + (link + 1)).sub(point(label));
      curl.push({
        bone: joints.get(label + '.' + side),
        axis: direction.cross(palm).normalize(),
        depth: [.41, .68, .47][link - 1] * (1 - (finger - 2) * .06)
      });
    }
  }
  return curl;
}

function authoredRig(theme, seed) {
  const group = clone(template);
  const uniform = 'uniform_' + (DEPARTMENTS[theme] ?? DEPARTMENTS[0]);
  const unused = [];
  group.traverse(object => {
    if (object.name.startsWith('uniform_') && object.name !== uniform) unused.push(object);
  });
  for (const object of unused) object.removeFromParent();

  const joints = new Map();
  group.traverse(object => {
    if (object.isBone) joints.set(object.userData.name ?? object.name, object);
    // Stage disposal is per actor. Preserve decoded source textures for the
    // next floor, and give each live actor its own disposable GPU geometry.
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    object.material = object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });

  const body = {
    group, seed,
    hips: joints.get('root'), torso: joints.get('spine02'), neck: joints.get('neck02'),
    arms: ['R', 'L'].map((side, index) => ({
      side: index === 0 ? -1 : 1,
      shoulder: joints.get('upperarm01.' + side),
      elbow: joints.get('lowerarm01.' + side),
      wrist: joints.get('wrist.' + side), fingers: fingerJoints(joints, side)
    })),
    legs: ['R', 'L'].map((side, index) => ({
      side: index === 0 ? -1 : 1,
      hip: joints.get('upperleg01.' + side),
      knee: joints.get('lowerleg01.' + side),
      ankle: joints.get('foot.' + side)
    }))
  };
  const head = joints.get('head');
  const jaw = joints.get('jaw');
  return {
    body, head, jaw, hipsBaseline: body.hips.position.y - .906,
    torsoBaseline: body.torso.position.z - .012
  };
}

function fallbackRig(theme, seed) {
  const body = makeCreatureBody(theme, seed);
  const face = createSculptedHead(theme, seed);
  face.group.position.y = -.018;
  body.neck.add(face.group);
  return { body, face, head: face.group };
}

function releaseFallback(body) {
  const geometry = new Set();
  const materials = new Set();
  body.group.traverse(object => {
    if (object.geometry) geometry.add(object.geometry);
    if (object.material) materials.add(object.material);
    if (object.isSkinnedMesh) object.skeleton.dispose();
  });
  body.group.removeFromParent();
  for (const item of geometry) item.dispose();
  for (const item of materials) item.dispose();
}

export function createCreature(index = 0, theme = 0) {
  const seed = (index + 1) * 1.81 + theme * .49;
  const group = new Group();
  group.scale.set(1 + (index % 3 - 1) * .028, 1 + (index % 3 - 1) * .022, 1);
  const didLoad = Boolean(template);
  const actor = didLoad ? authoredRig(theme, seed) : fallbackRig(theme, seed);
  group.add(actor.body.group);
  if (!didLoad) void preloadCreatureAsset();
  group.userData.authoredCreature = didLoad;
  return { ...actor, group, seed, movementTime: 0, theme };
}

export function updateCreature(actor, { time, threat = 0, attack = 0, night = false,
  distance = 10, reduced = false, moving = false, dt = 0, travel = 0 }) {
  if (template && !actor.group.userData.authoredCreature) {
    releaseFallback(actor.body);
    Object.assign(actor, authoredRig(actor.theme, actor.seed), { face: null });
    actor.group.add(actor.body.group);
    actor.group.userData.authoredCreature = true;
  }
  const urgency = smoothstep(threat, .26, .89);
  const reach = Math.max(attack, urgency * (1 - smoothstep(distance, .70, 3.85)));
  if (moving) actor.movementTime += Math.min(dt * 2.1, travel * .56);
  animateCreatureBody(actor.body, {
    time, threat, reach, moving, reduced, movementTime: actor.movementTime
  });

  const breath = Math.sin(time * 3.3 + actor.seed);
  const glance = Math.sin(time * 2.6 + actor.seed) * (1 - urgency);
  actor.body.torso.rotation.z += .052 * Math.sin(actor.seed);
  actor.body.torso.rotation.x += .045 * (1 - reach);
  const flinch = reduced ? 0 : Math.sin(time * 14.1 + actor.seed) * .016 * urgency;
  actor.body.neck.rotation.set(
    -.095 - urgency * .11 - reach * .22 + breath * .028,
    glance * .16 + flinch,
    .035 + glance * .048 - reach * .042
  );
  const yell = smoothstep(threat, .32, .77) * (.24 + .48 * Math.abs(Math.sin(time * 4.1 + actor.seed)));
  const howl = MathUtils.clamp(.046 + yell * .30 + reach * .13 + attack * .38 + breath * .021, 0, .83);
  if (actor.jaw) {
    actor.body.hips.position.y += actor.hipsBaseline;
    actor.body.torso.position.z += actor.torsoBaseline;
    actor.jaw.rotation.x = howl * .64;
    for (const { shoulder, elbow, fingers, side } of actor.body.arms) {
      // The original MakeHuman bind pose already has a bend at the elbow
      // and the arms away from the body; ground them before the chase pose.
      shoulder.rotation.z -= side * (.64 - reach * .14);
      shoulder.rotation.y -= side * reach * .27;
      elbow.rotation.x *= .83;
      elbow.rotation.y = -side * reach * .34;
      for (const { bone, axis, depth } of fingers) {
        bone.quaternion.setFromAxisAngle(axis, depth * (.15 + .68 * reach + .13 * attack));
      }
    }
    return;
  }
  animateSculptedHead(actor.face, { jaw: howl, night, threat, time });
}
