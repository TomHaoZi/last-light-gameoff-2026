import { Group, MathUtils } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const shared = new WeakSet();
let prepared = null;
let request = null;

export function preloadMourningFigure() {
  if (!request) {
    const asset = file => new URL('./assets/creature/' + file + '.glb', import.meta.url).href;
    request = Promise.all([
      loader.loadAsync(asset('mourning-clerk')),
      loader.loadAsync(asset('mourning-wings'))
    ]).then(([{ scene: figure }, { scene: wings }]) => {
      for (const model of [figure, wings]) {
        model.traverse(object => {
          if (object.isMesh) shared.add(object.geometry);
        });
      }
      figure.getObjectByName('WingAnchor').add(wings);
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

export function attachMourningFigure(actor) {
  if (!prepared || actor.pose) return;
  const figure = prepared.clone();
  figure.traverse(object => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    object.castShadow = true;
    object.receiveShadow = true;
  });
  const pivot = name => figure.getObjectByName(name);
  actor.body.group.add(figure);
  actor.head = pivot('Crown');
  actor.pose = {
    figure: pivot('Figure'), ribs: pivot('Ribcage'), skirt: pivot('Drape'),
    lip: pivot('LowerLip'), wings: pivot('WingAnchor'),
    arms: ['L', 'R'].map(side => ({
      shoulder: pivot('Shoulder_' + side), elbow: pivot('Elbow_' + side), palm: pivot('Palm_' + side)
    }))
  };
  actor.group.userData.authoredCreature = true;
}

export function createMourningFigure(group, seed, theme) {
  const body = { group: new Group() };
  group.add(body.group);
  const actor = { body, group, seed, theme, kind: 'mourning', movementTime: 0 };
  if (prepared) attachMourningFigure(actor);
  else void preloadMourningFigure();
  return actor;
}

export function poseMourningFigure(actor, { time, gaze, attack, reduced, travel, moving, dt }) {
  attachMourningFigure(actor);
  const pose = actor.pose;
  if (!pose) return;
  const { arms, figure, ribs, skirt, lip, wings } = pose;
  const alarm = MathUtils.smoothstep(gaze, 0, 0.9);
  const grief = (1 - Math.max(alarm, attack));
  const breath = reduced ? 0 : Math.sin(time * 3.15 + actor.seed);
  if (moving) actor.movementTime += travel * 4.6;
  const stride = reduced || !moving ? 0 : Math.sin(actor.movementTime);
  const creep = Math.sin(time * 16 + actor.seed) * alarm * (reduced ? 0 : 1);

  figure.position.y = Math.max(0, stride * .014);
  ribs.rotation.set(.113 * grief - .23 * attack, -.032 * grief, -.068 * grief + breath * .015);
  actor.head.rotation.set(.40 * grief - .177 * attack + .028 * breath, -.076 * grief + creep * .028,
    .16 * grief + .033 * creep);
  lip.position.y = -.013 * attack - .005 * alarm;
  skirt.rotation.set(.035 * stride - .061 * attack, stride * .035, -.024 * stride);
  wings.rotation.set(-.061 * grief - .11 * attack, .052 * grief, .05 * attack);

  for (const [index, arm] of arms.entries()) {
    const side = index === 0 ? -1 : 1;
    const raised = index === 0;
    arm.shoulder.rotation.set(-.22 - .92 * attack - (raised ? .16 * grief : 0),
      -.10 * side * attack, side * (.125 + .34 * attack - .18 * grief));
    arm.elbow.rotation.set(-.16 - (raised ? .68 * grief : .29 * grief) - .22 * attack,
      -.11 * side * attack, -side * (raised ? .95 : .20) * grief - side * .11 * attack);
    arm.palm.rotation.set(.20 * grief + .11 * attack, -.18 * side, .13 * side * grief);
  }
}
