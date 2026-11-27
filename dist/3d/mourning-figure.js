import { Euler, Group, MathUtils, Quaternion, Skeleton, Sphere, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { applyPreparedCreatureTextures, prepareOfficeTextures } from './creature-textures.js';
import { fingerJoints } from './creature-rig.js';
import { faceDetails, installWoundFinish, woundKind } from './wound-finish.js';

const loader = new GLTFLoader();
const shared = new WeakSet();
const bounds = new Sphere(new Vector3(0, .9, 0), 1.55);
let prepared = null;
let request = null;
let prepareGeometry = null;

export function preloadMourningFigure(warmGeometry) {
  if (warmGeometry && !prepared) prepareGeometry ??= warmGeometry;
  if (!request) {
    const asset = file => new URL('./assets/creature/' + file + '.glb', import.meta.url).href;
    request = loader.loadAsync(asset('archive-nurse')).then(async ({ scene: figure }) => {
      figure.traverse(object => {
        if (object.isMesh) shared.add(object.geometry);
      });
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
  const wounds = [];
  const boneLabel = object => object.userData.name ?? object.name;
  figure.traverse(object => {
    if (object.isBone) joints.set(boneLabel(object), object);
  });
  figure.traverse(object => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    const wet = installWoundFinish(object.material,woundKind(object.material.name,true),-1);
    if (wet) wounds.push(wet);
    object.castShadow = true;
    object.receiveShadow = true;
    if (object.isSkinnedMesh) {
      const original = object.skeleton;
      object.boundingSphere = bounds;
      if (!skins.has(original)) {
        skins.set(original, new Skeleton(original.bones.map(bone => joints.get(boneLabel(bone))), original.boneInverses));
      }
      object.skeleton = skins.get(original);
    }
  });
  actor.head = joints.get('head');
  const rest = object => ({ object, rest: object.quaternion.clone() });
  const joint = name => rest(joints.get(name));
  const fingers = side => fingerJoints(joints, side).map(({ bone, axis, depth }) => ({
    ...rest(bone), axis: axis.applyQuaternion(bone.getWorldQuaternion(new Quaternion()).invert()), depth
  }));
  actor.pose = {
    figure, wounds, ribs: joint('spine02'), head: rest(actor.head), jaw: joint('jaw'),
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
    mouth: ['R', 'L'].map(side => joint('oris03.' + side))
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

export function poseMourningFigure(actor, { time, gaze, watching, charging, attack, reduced, travel, moving, capture, dt = 0 }) {
  attachMourningFigure(actor);
  const pose = actor.pose;
  if (!pose) return;
  applyPreparedCreatureTextures(actor);
  const { arms, legs, figure, ribs, head, jaw, mouth } = pose;
  const alarm = MathUtils.smoothstep(gaze, 0, .78);
  if (charging) actor.release = 1;
  else actor.release = Math.max(0, (actor.release ?? 0) - dt * 3.7);
  const release = (charging || capture ? 0 : actor.release) * (reduced ? .45 : 1);
  const recognition = watching && !charging && !capture ? MathUtils.smoothstep(gaze, .03, .41) : 0;
  const reach = Math.max(attack, charging ? .77 + alarm * .23 : alarm * .23);
  const grief = (1 - Math.max(alarm, attack)) * (1 - release*.68);
  const breath = reduced ? 0 : Math.sin(time * 3.15 + actor.seed) * (1-recognition*.9);
  if (moving) actor.movementTime += travel * 5;
  const stride = reduced || !moving ? 0 : Math.sin(actor.movementTime);
  // Short, irregular neck corrections instead of supernatural wing motion.
  const shiver = reduced ? 0 : Math.sin(time * 17 + actor.seed) * alarm;
  const hitch = reduced ? 0 : Math.sin(time * 2.9 + actor.seed) ** 11 * (.021 + .050 * alarm);
  const grip = capture?.grip ?? 0;
  const cover = capture?.cover ?? 0;
  const resistance = capture?.resistance ?? 0;
  const drop = capture?.drop ?? 0;
  const direction = capture?.side ?? 1;
  const expression=faceDetails(time,actor.seed,Math.max(alarm,release*.65),Math.max(grip,cover),reduced);
  for (const wet of pose.wounds) wet.value=expression.wet;

  figure.position.y = Math.abs(stride) * .019 - .048 * grip - .11 * drop;
  poseBone(ribs, .11 * grief + .27 * reach + .22 * cover - .18 * drop - .15*recognition - .32*release,
    -.029 * grief + stride * .08 + direction * (.11 * grip - .07 * resistance),
    -.06 * grief + breath * .019 + direction * .076 * drop);
  poseBone(head, .30 * grief - .33 * reach + .024 * breath - .14 * grip + .34 * drop - hitch - .16*recognition + .26*release,
    -.075 * grief + shiver * .025 - direction * .14 * cover + hitch * .7 - .24*release,
    .16 * grief - .085 * reach + .026 * shiver + direction * .17 * grip + .13*recognition);
  poseBone(jaw, .035 * grief + .245 * reach + .24 * cover - .13 * grip + .16*release - .039*recognition + expression.chatter,
    shiver * .026, (expression.left-expression.right)*.081);
  for (const [i, corner] of mouth.entries()) {
    const twitch = i ? expression.left : expression.right;
    poseBone(corner, -.045 * reach - .057 * cover - twitch*.068, 0, (i ? 1 : -1) * (.107 * reach + twitch*.077));
  }


  for (const [index, { side, shoulder, elbow, wrist, fingers }] of arms.entries()) {
    const lift = index === 0;
    const swing = side * stride;
    const lead = side === direction ? 1 : .66;
    poseBone(shoulder, -.43 * grief * Number(lift) - reach * (1.53 + side * .09) + swing * .18
      - lead * .23 * grip + .34 * drop + .37*release - (lift ? 0 : .23*recognition),
      side * (.083 + .16 * reach - .20 * grip), -side * (.40 + .10 * grief + .34 * reach + .13 * cover));
    poseBone(elbow, -.16 - (lift ? .96 : .20) * grief - .13 * reach - lead * .37 * grip + .17 * resistance,
      -.16 * side * reach - side * .18 * cover, side * ((lift ? .74 : .14) * grief + .12 * reach));
    poseBone(wrist, .21 * grief + .27 * reach - .27 * grip, -.16 * side - .23 * side * grip,
      side * (.15 * grief + .21 * cover));
    for (const finger of fingers) {
      finger.object.quaternion.setFromAxisAngle(finger.axis, finger.depth * (.10 + .64 * grip + .12 * drop + .31*recognition + .28*release + .30*expression.grip));
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
