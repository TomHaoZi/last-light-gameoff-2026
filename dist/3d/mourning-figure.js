import { Euler, Group, MathUtils, Skeleton, Sphere, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { applyPreparedCreatureTextures, prepareOfficeTextures } from './creature-textures.js';

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
      object.boundingSphere = bounds;
      const original = object.skeleton;
      if (!skins.has(original)) {
        skins.set(original, new Skeleton(original.bones.map(bone => joints.get(boneLabel(bone))), original.boneInverses));
      }
      object.skeleton = skins.get(original);
    }
  });
  actor.body.group.add(figure);
  actor.head = joints.get('head');
  const wing = figure.getObjectByName('WingAnchor');
  const rest = object => ({ object, rest: object.quaternion.clone() });
  const joint = name => rest(joints.get(name));
  actor.pose = {
    figure, ribs: joint('spine02'), head: rest(actor.head), jaw: joint('jaw'), wings: rest(wing),
    arms: ['R', 'L'].map((side, index) => ({
      side: index ? 1 : -1,
      shoulder: joint('upperarm01.' + side), elbow: joint('lowerarm01.' + side),
      wrist: joint('wrist.' + side)
    })),
    legs: ['R', 'L'].map(side => ({ hip: joint('upperleg01.' + side), knee: joint('lowerleg01.' + side) })),
    mouth: ['R', 'L'].map(side => joint('oris03.' + side))
  };
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
function poseBone(joint, pitch, yaw, roll) {
  joint.object.quaternion.setFromEuler(offset.set(pitch, yaw, roll)).premultiply(joint.rest);
}

export function poseMourningFigure(actor, { time, gaze, charging, attack, reduced, travel, moving }) {
  attachMourningFigure(actor);
  const pose = actor.pose;
  if (!pose) return;
  applyPreparedCreatureTextures(actor);
  const { arms, legs, figure, ribs, head, jaw, mouth, wings } = pose;
  const alarm = MathUtils.smoothstep(gaze, 0, .78);
  const reach = Math.max(attack, charging ? .77 + alarm * .23 : alarm * .23);
  const grief = 1 - Math.max(alarm, attack);
  const breath = reduced ? 0 : Math.sin(time * 3.15 + actor.seed);
  if (moving) actor.movementTime += travel * 5;
  const stride = reduced || !moving ? 0 : Math.sin(actor.movementTime);
  const shiver = reduced ? 0 : Math.sin(time * 17 + actor.seed) * alarm;

  figure.position.y = Math.abs(stride) * .019;
  poseBone(ribs, .11 * grief + .27 * reach, -.029 * grief + stride * .08, -.06 * grief + breath * .019);
  poseBone(head, .26 * grief - .33 * reach + .031 * breath, -.075 * grief + shiver * .025,
    .14 * grief - .085 * reach + .026 * shiver);
  poseBone(jaw, .035 * grief + .245 * reach, shiver * .026, 0);
  for (const [i, corner] of mouth.entries()) poseBone(corner, -.045 * reach, 0, (i ? 1 : -1) * .107 * reach);
  poseBone(wings, -.06 * grief - .11 * reach, .054 * grief + stride * .066, .066 * reach);

  for (const [index, { side, shoulder, elbow, wrist }] of arms.entries()) {
    const lift = index === 0;
    const swing = side * stride;
    poseBone(shoulder, -.43 * grief * Number(lift) - reach * (1.53 + side * .09) + swing * .18,
      side * (.083 + .16 * reach), -side * (.40 + .10 * grief + .34 * reach));
    poseBone(elbow, -.16 - (lift ? .96 : .20) * grief - .13 * reach,
      -.16 * side * reach, side * ((lift ? .74 : .14) * grief + .12 * reach));
    poseBone(wrist, .21 * grief + .27 * reach, -.16 * side, side * .15 * grief);
  }
  for (const [index, { hip, knee }] of legs.entries()) {
    const step = stride * (index ? 1 : -1);
    poseBone(hip, step * .64 - .09 * reach, 0, (index ? 1 : -1) * .044);
    poseBone(knee, Math.max(0, step) * .62, 0, 0);
  }
}
