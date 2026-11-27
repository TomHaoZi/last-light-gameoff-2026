import { Group, MathUtils, Sphere, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { clone } from './vendor/utils/SkeletonUtils.js';
import { makeCreatureBody, animateCreatureBody } from './creature-body.js';
import { fingerJoints } from './creature-rig.js';
import { createSculptedHead, animateSculptedHead } from './creature-head.js';
import { applyPreparedCreatureTextures } from './creature-textures.js';
import { creaturePressure } from './creature-pressure.js';
import { faceDetails, installWoundFinish, woundKind } from './wound-finish.js';

import { createMourningFigure, isSharedMourningGeometry, poseMourningFigure, prepareMourningTextures } from './mourning-figure.js';

const { smoothstep } = MathUtils;

const DEPARTMENTS = ['boiler', 'office', 'roof'];
const POSTURE = [
  { lean: .086, list: -.048, chin: .012, tilt: .087, search: .16, reachingSide: 1 },
  { lean: -.068, list: .035, chin: -.026, tilt: -.071, search: .27, reachingSide: -1 },
  { lean: .016, list: -.022, chin: .029, tilt: .041, search: .19, reachingSide: 1 }
];
const SOURCE = new URL('./assets/creature/late-worker.glb', import.meta.url).href;
// Bounds include the reach and capture poses as well as the resting model.
const poseBounds = new Sphere(new Vector3(0, .92, 0), 1.55);
const authoredGeometries = new WeakSet();
let template = null;
let loadPromise = null;
const officeTextureRequests = new WeakSet();

class CreatureGroup extends Group {
  updateMatrixWorld(force) {
    // Three skips invisible creatures in both the scene and shadow passes.
    // There is no need to visit their bones until they re-enter the phase.
    if (this.visible) super.updateMatrixWorld(force);
  }
}

export function preloadCreatureAsset() {
  if (!loadPromise) {
    loadPromise = new GLTFLoader().loadAsync(SOURCE).then(result => {
      template = result.scene;
      template.traverse(object => {
        if (object.isMesh) authoredGeometries.add(object.geometry);
      });
      return true;
    }).catch(error => {
      console.warn('Could not load the imported creature mesh.', error);
      return false;
    });
  }
  return loadPromise;
}

export function isSharedCreatureGeometry(geometry) {
  return authoredGeometries.has(geometry) || isSharedMourningGeometry(geometry);
}

export function scheduleOfficeCreatureTextures(renderer) {
  if (officeTextureRequests.has(renderer)) return;
  officeTextureRequests.add(renderer);
  prepareMourningTextures(renderer);
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
  const skeletons = new Map();
  const wounds = [];
  group.traverse(object => {
    if (object.isBone) joints.set(object.userData.name ?? object.name, object);
    if (!object.isMesh) return;
    // The GLB supplies immutable vertices. Each actor has its own pose and
    // materials, while authored geometry stays reusable across chapters.
    object.material = object.material.clone();
    const wet = installWoundFinish(object.material, woundKind(object.material.name), theme===1 ? -1 : 1);
    if (wet) wounds.push(wet);
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) {
      object.boundingSphere = poseBounds;
      // SkeletonUtils clones each mesh's skeleton. Pieces of the same GLTF
      // skin retain the same inverse-bind array and use the same actor joints.
      const { boneInverses } = object.skeleton;
      const sharedSkin = skeletons.get(boneInverses);
      if (sharedSkin) object.skeleton = sharedSkin;
      else skeletons.set(boneInverses, object.skeleton);
    }
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
  const eyes = [joints.get('eye.L'), joints.get('eye.R')];
  const facialMuscles = ['L', 'R'].map(side => {
    const brow = joints.get('oculi01.' + side);
    const cheek = joints.get('levator05.' + side);
    const lip = joints.get('oris03.' + side);
    return {
      sign: side === 'L' ? 1 : -1,
      brow, browY: brow.position.y, cheek, cheekY: cheek.position.y, lip, lipY: lip.position.y,
      lid: joints.get('orbicularis03.' + side), lowerLid: joints.get('orbicularis04.' + side)
    };
  });
  const animated = new Set([body.hips, body.torso, body.neck, jaw, ...eyes]);
  for (const { brow, cheek, lip, lid, lowerLid } of facialMuscles) {
    animated.add(brow).add(cheek).add(lip).add(lid).add(lowerLid);
  }
  // The capture camera reads the head before the scene updates world matrices.
  for (let ancestor = head; ancestor; ancestor = ancestor.parent) animated.add(ancestor);
  for (const { shoulder, elbow, wrist, fingers } of body.arms) {
    animated.add(shoulder).add(elbow).add(wrist);
    for (const { bone } of fingers) animated.add(bone);
  }
  for (const { hip, knee, ankle } of body.legs) animated.add(hip).add(knee).add(ankle);
  group.traverse(object => {
    if (animated.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
  return {
    body, head, jaw, eyes, facialMuscles, wounds, hipsBaseline: body.hips.position.y - .906,
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

export function createCreature(index = 0, theme = 0, renderer = null, kind = null) {
  const seed = (index + 1) * 1.81 + theme * .49;
  const group = new CreatureGroup();
  group.scale.set(1 + (index % 3 - 1) * .028, 1 + (index % 3 - 1) * .022, 1);
  if (kind === 'mourning') return createMourningFigure(group, seed, theme, renderer);
  const didLoad = Boolean(template);
  const actor = didLoad ? authoredRig(theme, seed) : fallbackRig(theme, seed);
  group.add(actor.body.group);
  if (!didLoad) void preloadCreatureAsset();
  group.userData.authoredCreature = didLoad;
  return { ...actor, group, seed, movementTime: 0, theme, renderer };
}

export function updateCreature(actor, { time, threat = 0, attack = 0, night = false,
  distance = 10, reduced = false, moving = false, dt = 0, travel = 0, gazeLock = 0, watching = false,
  charging = false, capture = null, stagger = 0, transfer = null }) {
  if (actor.kind === 'mourning') {
    poseMourningFigure(actor, { time, gaze: gazeLock, watching, charging, attack, reduced, moving, travel, capture, dt });
    return;
  }
  if (template && !actor.group.userData.authoredCreature) {
    releaseFallback(actor.body);
    Object.assign(actor, authoredRig(actor.theme, actor.seed), { face: null });
    actor.group.add(actor.body.group);
    actor.group.userData.authoredCreature = true;
  }
  if (actor.group.userData.authoredCreature) applyPreparedCreatureTextures(actor);
  const beats=creaturePressure({threat,distance,attack,stagger});
  const urgency = smoothstep(threat, .26, .89);
  const reach = Math.max(attack, urgency * (1 - smoothstep(distance, .70, 3.85)));
  const vault = transfer?.started ? smoothstep(transfer.vault, 0, .75) * (1 - attack) : 0;
  const pursuit = transfer?.started ? smoothstep(transfer.danger, .12, .86) * (1 - attack) : 0;
  if (moving) actor.movementTime += Math.min(dt * (transfer?.started ? 3.5 : 2.1), travel * .56);
  animateCreatureBody(actor.body, {
    time, threat, reach, moving, reduced, movementTime: actor.movementTime
  });

  const breath = Math.sin(time * 3.3 + actor.seed);
  const posture = POSTURE[actor.theme] ?? POSTURE[0];
  // Patrol eyes lead the head; at contact the gaze steadies on the player.
  const searchTime = time * 1.94 + actor.seed;
  const gaze = Math.tanh(2.4 * Math.sin(searchTime)) * (1 - urgency);
  const glance = Math.tanh(1.76 * Math.sin(searchTime - .34)) * (1 - urgency);
  actor.body.torso.rotation.z += (.030 * Math.sin(actor.seed) + posture.list) * (1 - .65 * reach);
  actor.body.torso.rotation.x += (.045 + posture.lean) * (1 - reach) - .13*beats.closing + .24*beats.recoil;
  actor.body.torso.rotation.y = posture.reachingSide*(.06*beats.listen - .17*beats.brace + .14*vault);
  actor.body.torso.rotation.x += .14*pursuit - .26*vault;
  for (const { hip,knee,side } of actor.body.legs) {
    hip.rotation.x -= vault*(side===1 ? .65 : .28);
    knee.rotation.x += vault*(side===1 ? .63 : .93);
  }
  const flinch = reduced ? 0 : Math.sin(time * 14.1 + actor.seed) * .016 * urgency;
  actor.body.neck.rotation.set(
    -.095 - urgency * .11 - reach * .22 + breath * .028*(1-beats.breathHold) + posture.chin * (1 - reach) + .12*beats.listen + .25*beats.recoil,
    glance * posture.search + flinch + .11*posture.reachingSide*beats.listen,
    (.035 + posture.tilt) * (1 - reach) + glance * .048 - reach * .025 + .12*beats.listen*posture.reachingSide
  );
  const yell = smoothstep(threat, .32, .77) * (.24 + .48 * Math.abs(Math.sin(time * 4.1 + actor.seed)));
  const howl = MathUtils.clamp(.046 + yell * .30 + reach * .13 + attack * .38 + breath * .021 + .12*beats.brace - .13*beats.listen + .11*beats.recoil + .18*pursuit - .12*vault, 0, .83);
  const expression=faceDetails(time,actor.seed,Math.max(threat,stagger),attack,reduced);
  if (actor.jaw) {
    for(const wet of actor.wounds) wet.value=Math.max(expression.wet,.82*beats.recoil);
    actor.body.hips.position.y += actor.hipsBaseline;
    actor.body.torso.position.z += actor.torsoBaseline;
    actor.jaw.rotation.x = howl * .60 + expression.chatter;
    actor.jaw.rotation.z = Math.sin(actor.seed) * howl * .055 + (expression.right-expression.left)*.055;
    const eyeTurn = reduced ? 0 : MathUtils.clamp(gaze * .19 - glance * posture.search, -.16, .16);
    const eyeLift = reach * .086 + urgency * .052;
    for (const eye of actor.eyes) eye.rotation.set(-eyeLift, eyeTurn, 0);
    // A tightening brow precedes the teeth. The injured side is slower to blink
    // and retracts its lip higher as the capture jaw opens.
    for (const muscle of actor.facialMuscles) {
      const injured = muscle.sign === posture.reachingSide;
      const beat = (time + actor.seed + (injured ? .045 : 0)) % 4.73;
      const blink = (1 - smoothstep(Math.abs(beat - .103), .014, .103)) * (1 - reach);
      muscle.lid.rotation.x = blink * (injured ? .33 : .46) + urgency * .05 + .32*beats.recoil - .085*beats.listen;
      muscle.lowerLid.rotation.x = -blink * .088 - urgency * .044 - .13*beats.brace;
      muscle.brow.position.y = muscle.browY - urgency * (injured ? .0029 : .0046) + (injured ? .003 : .006)*beats.listen - .004*beats.brace;
      muscle.cheek.position.y = muscle.cheekY + howl * (injured ? .008 : .0041);
      const twitch = muscle.sign === 1 ? expression.left : expression.right;
      muscle.lip.position.y = muscle.lipY + howl * (injured ? .0105 : .0069) + twitch*(injured ? .0058 : .0025);
      muscle.cheek.rotation.z = -muscle.sign * twitch*.065;
    }
    for (const { shoulder, elbow, fingers, side } of actor.body.arms) {
      // The original MakeHuman bind pose already has a bend at the elbow
      // and the arms away from the body; ground them before the chase pose.
      const handReach = side === posture.reachingSide ? reach : reach * smoothstep(reach, .18, .90);
      shoulder.rotation.z -= side * (.64 - handReach * .14);
      shoulder.rotation.y -= side * (handReach * .25 + .18*beats.recoil);
      shoulder.rotation.x += .20*beats.listen + .28*beats.recoil - .16*beats.closing + vault*(side===1 ? -.48 : .47);
      elbow.rotation.x = elbow.rotation.x*.83 - .32*beats.recoil - .52*vault;
      elbow.rotation.y = -side * handReach * .32;
      for (const { bone, axis, depth } of fingers) {
        bone.quaternion.setFromAxisAngle(axis, depth * (.18 + .62 * handReach + .23 * expression.grip + .17*beats.recoil));
      }
    }
    return;
  }
  animateSculptedHead(actor.face, { jaw: howl+expression.chatter, night, threat, time });
}
