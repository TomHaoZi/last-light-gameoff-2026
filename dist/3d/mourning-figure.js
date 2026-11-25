import { Euler, Group, MathUtils, Quaternion, Skeleton, Sphere, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { applyPreparedCreatureTextures, prepareOfficeTextures } from './creature-textures.js';
import { fingerJoints } from './creature-rig.js';

const loader = new GLTFLoader();
const shared = new WeakSet();
const bounds = new Sphere(new Vector3(0, .9, 0), 1.55);
const wingBounds = new Sphere(new Vector3(0, -.05, -.19), 1.55);
let prepared = null;
let request = null;
let prepareGeometry = null;

export function preloadMourningFigure(warmGeometry) {
  if (warmGeometry && !prepared) prepareGeometry ??= warmGeometry;
  if (!request) {
    const asset = file => new URL('./assets/creature/' + file + '.glb', import.meta.url).href;
    request = Promise.all([
      loader.loadAsync(asset('mourning-clerk-human')),
      loader.loadAsync(asset('mourning-wings'))
    ]).then(async ([{ scene: figure }, { scene: wings }]) => {
      for (const scene of [figure, wings]) {
        scene.traverse(object => {
          if (object.isMesh) shared.add(object.geometry);
        });
      }
      figure.getObjectByName('WingAnchor').add(wings);
      try {
        await prepareGeometry?.(figure);
      } catch {
        // A reset or unavailable warmup leaves the normal draw path usable.
      }
      prepareGeometry = null;
      prepared = figure;
      return true;
    }).catch(error => {
      console.warn('The mourning figure could not load.', error);
      request = null;
      return false;
    });
  }
  return request;
}

export const isSharedMourningGeometry = geometry => shared.has(geometry);

export function prepareMourningTextures(renderer) {
  void preloadMourningFigure().then(ready => {
    if (ready) prepareOfficeTextures(renderer, prepared);
  });
}

export function attachMourningFigure(actor) {
  if (!prepared || actor.pose) return;
  const figure = prepared.clone();
  const joints = new Map();
  const skins = new Map();
  const boneLabel = object => object.userData.name ?? object.name;
  figure.traverse(object => {
    if (object.isBone) joints.set(boneLabel(object), object);
  });
  figure.traverse(object => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) {
      const original = object.skeleton;
      object.boundingSphere = original.bones.some(bone => boneLabel(bone) === 'WingLRoot') ? wingBounds : bounds;
      if (!skins.has(original)) {
        skins.set(original, new Skeleton(original.bones.map(bone => joints.get(boneLabel(bone))), original.boneInverses));
      }
      object.skeleton = skins.get(original);
    }
  });
  actor.head = joints.get('head');
  const wing = figure.getObjectByName('WingAnchor');
  const rest = object => ({ object, rest: object.quaternion.clone() });
  const joint = name => rest(joints.get(name));
  const fingers = side => fingerJoints(joints, side).map(({ bone, axis, depth }) => ({
    ...rest(bone), axis: axis.applyQuaternion(bone.getWorldQuaternion(new Quaternion()).invert()), depth
  }));
  actor.pose = {
    figure, ribs: joint('spine02'), head: rest(actor.head), jaw: joint('jaw'), wings: rest(wing),
    arms: ['R', 'L'].map((side, index) => ({
      side: index ? 1 : -1,
      shoulder: joint('upperarm01.' + side), elbow: joint('lowerarm01.' + side),
      wrist: joint('wrist.' + side), fingers: fingers(side)
    })),
    legs: ['R', 'L'].map(side => {
      const ankle = joint('foot.' + side);
      return { hip: joint('upperleg01.' + side), knee: joint('lowerleg01.' + side), ankle,
        standY: ankle.object.getWorldPosition(new Vector3()).y };
    }),
    mouth: ['R', 'L'].map(side => joint('oris03.' + side)),
    lids: ['R', 'L'].map(side => joint('orbicularis03.' + side)),
    wingBones: ['R', 'L'].flatMap((side, index) =>
      ['Root', 'Elbow', 'Wrist'].flatMap((name, segment) => {
        const object = joints.get('Wing' + side + name);
        return object ? [{ ...rest(object), side: index ? 1 : -1, segment }] : [];
      }))
  };
  actor.body.group.add(figure);
  actor.group.userData.authoredCreature = true;
}

export function createMourningFigure(group, seed, theme, renderer) {
  const body = { group: new Group() };
  group.add(body.group);
  const actor = { body, group, seed, theme, renderer, kind: 'mourning', movementTime: 0 };
  if (prepared) attachMourningFigure(actor);
  else void preloadMourningFigure();
  return actor;
}

const offset = new Euler();
const footPoint = new Vector3();
function poseBone(joint, pitch, yaw, roll) {
  joint.object.quaternion.setFromEuler(offset.set(pitch, yaw, roll)).premultiply(joint.rest);
}

export function poseMourningFigure(actor, { time, gaze, charging, attack, reduced, travel, moving, capture }) {
  attachMourningFigure(actor);
  const pose = actor.pose;
  if (!pose) return;
  applyPreparedCreatureTextures(actor);
  const { arms, legs, figure, ribs, head, jaw, mouth, lids, wings, wingBones } = pose;
  const alarm = MathUtils.smoothstep(gaze, 0, .78);
  const reach = Math.max(attack, charging ? .77 + alarm * .23 : alarm * .23);
  const grief = 1 - Math.max(alarm, attack);
  const breath = reduced ? 0 : Math.sin(time * 3.15 + actor.seed);
  if (moving) actor.movementTime += travel * 5;
  const stride = reduced || !moving ? 0 : Math.sin(actor.movementTime);
  const shiver = reduced ? 0 : Math.sin(time * 17 + actor.seed) * alarm;
  const grip = capture?.grip ?? 0;
  const cover = capture?.cover ?? 0;
  const resistance = capture?.resistance ?? 0;
  const drop = capture?.drop ?? 0;
  const direction = capture?.side ?? 1;

  figure.position.y = Math.abs(stride) * .019 - .048 * grip - .11 * drop;
  poseBone(ribs, .11 * grief + .27 * reach + .22 * cover - .18 * drop,
    -.029 * grief + stride * .08 + direction * (.11 * grip - .07 * resistance),
    -.06 * grief + breath * .019 + direction * .076 * drop);
  poseBone(head, .26 * grief - .33 * reach + .031 * breath - .14 * grip + .34 * drop,
    -.075 * grief + shiver * .025 - direction * .14 * cover,
    .14 * grief - .085 * reach + .026 * shiver + direction * .17 * grip);
  poseBone(jaw, .035 * grief + .245 * reach + .24 * cover - .13 * grip, shiver * .026, 0);
  for (const [i, corner] of mouth.entries()) poseBone(corner, -.045 * reach - .057 * cover, 0, (i ? 1 : -1) * .107 * reach);
  for (const lid of lids) poseBone(lid, .15 * grip - .115 * cover, 0, 0);
  poseBone(wings, -.06 * grief - .11 * reach + .27 * cover, .054 * grief + stride * .066,
    .066 * reach - direction * .14 * drop);
  for (const part of wingBones) {
    const bend = (1 + part.segment) / 3;
    const restDrift = reduced ? 0 : breath * .018 * bend;
    poseBone(part, restDrift + .047 * cover * bend - .056 * drop,
      part.side * (.032 * reach + (.11 + bend * .06) * cover - .061 * drop),
      part.side * (.041 * resistance - .085 * reach + .095 * cover * bend));
  }

  for (const [index, { side, shoulder, elbow, wrist, fingers }] of arms.entries()) {
    const lift = index === 0;
    const swing = side * stride;
    const lead = side === direction ? 1 : .66;
    poseBone(shoulder, -.43 * grief * Number(lift) - reach * (1.53 + side * .09) + swing * .18
      - lead * .23 * grip + .34 * drop,
      side * (.083 + .16 * reach - .20 * grip), -side * (.40 + .10 * grief + .34 * reach + .13 * cover));
    poseBone(elbow, -.16 - (lift ? .96 : .20) * grief - .13 * reach - lead * .37 * grip + .17 * resistance,
      -.16 * side * reach - side * .18 * cover, side * ((lift ? .74 : .14) * grief + .12 * reach));
    poseBone(wrist, .21 * grief + .27 * reach - .27 * grip, -.16 * side - .23 * side * grip,
      side * (.15 * grief + .21 * cover));
    for (const finger of fingers) {
      finger.object.quaternion.setFromAxisAngle(finger.axis, finger.depth * (.10 + .82 * grip + .12 * drop));
      finger.object.quaternion.premultiply(finger.rest);
    }
  }
  let lowestFoot = Infinity;
  for (const [index, { hip, knee, ankle, standY }] of legs.entries()) {
    const step = stride * (index ? 1 : -1);
    const hipBend = step * .64 - .09 * reach - .25 * grip - .25 * drop;
    const kneeBend = Math.max(0, step) * .62 + .28 * grip + .38 * drop;
    poseBone(hip, hipBend, 0, (index ? 1 : -1) * .044);
    poseBone(knee, kneeBend, 0, 0);
    poseBone(ankle, capture ? -hipBend - kneeBend : 0, 0, 0);
    if (capture) {
      ankle.object.getWorldPosition(footPoint);
      lowestFoot = Math.min(lowestFoot, actor.body.group.worldToLocal(footPoint).y - standY);
    }
  }
  if (capture) figure.position.y -= lowestFoot;
}
