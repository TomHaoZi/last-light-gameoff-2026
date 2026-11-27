import { Color } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { liftMotion } from './machinery-motion.js';

const file = new URL('./assets/env/service-lift.glb', import.meta.url).href;
const leafWidth = .379;

// The same folding hardware was finished for three different environments.
// Match the authored vertex-paint swatches; leave stamps, rivets and chips.
const paint = ['#5b726b', '#4f635c', '#82938a', '#a6a9a0'];
const finishes = [
  { paint: ['#6c704f', '#535640', '#959276', '#9f9b85'], metalness: .24, roughness: .67 },
  { paint: ['#7a6f59', '#5d5344', '#908771', '#a8a092'], metalness: .25, roughness: .59 },
  { paint: ['#8c9da7', '#445762', '#8a9da5', '#aab8bd'], metalness: .48, roughness: .44 }
];

function finishLanding(model, theme) {
  const finish = finishes[theme];
  const palette = paint.map((source, index) => [new Color(source), new Color(finish.paint[index])]);
  const materials = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    node.receiveShadow = node.castShadow = true;
    materials.add(node.material);
    const colors = node.geometry.getAttribute('color');
    if (!colors) return;
    for (let index = 0; index < colors.count; index++) {
      const r = colors.getX(index), g = colors.getY(index), b = colors.getZ(index);
      // Blender stores the swatches in an eight-bit paint layer. Account for
      // the tiny numerical difference when it is exported as linear glTF.
      const match = palette.find(([from]) =>
        Math.abs(r - from.r) < .004 && Math.abs(g - from.g) < .004 && Math.abs(b - from.b) < .004);
      if (!match) continue;
      const [, to] = match;
      colors.setXYZ(index, to.r, to.g, to.b);
    }
    colors.needsUpdate = true;
  });
  for (const material of materials) {
    material.metalness = finish.metalness;
    material.roughness = finish.roughness;
  }
}

export async function mountServiceLift(visual, mount, oldGate) {
  const stage = visual.stage;
  const model = (await new GLTFLoader().loadAsync(file)).scene;
  if (visual.stage !== stage) {
    const materials = new Set();
    model.traverse(node => {
      if (node.isMesh) {
        node.geometry.dispose();
        materials.add(node.material);
      }
    });
    for (const material of materials) material.dispose();
    return;
  }
  model.name = 'Inspection lift';
  finishLanding(model, visual.theme);
  const leaves = [-1, 1].map(side => {
    const name = side < 0 ? 'Left' : 'Right';
    const outer = model.getObjectByName('Gate' + name + 'Outer');
    const inner = model.getObjectByName('Gate' + name + 'Inner');
    const bolt = model.getObjectByName('Deadbolt' + name);
    inner.attach(bolt);
    return { side, outer, inner, bolt, boltRest: bolt.position.x, pivot: outer.position.x };
  });
  mount.add(model);
  oldGate.visible = false;
  visual.liftLeaves = leaves;
  visual.overlayFrame = null;
  visual.renderer.shadowMap.needsUpdate = true;
}

export function poseServiceLift(leaves, opening) {
  const { turn, latch } = liftMotion(opening);
  for (const { side, outer, inner, bolt, boltRest, pivot } of leaves) {
    // One end of each pair is pinned to the jamb, the free end runs in
    // the sill groove. Both panels retain their full width throughout.
    outer.rotation.y = side * turn;
    inner.rotation.y = -side * turn;
    inner.position.x = pivot - side * leafWidth * Math.cos(turn);
    inner.position.z = leafWidth * Math.sin(turn);
    bolt.position.x = boltRest + side * latch * .103;
  }
}
