import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { liftMotion } from './machinery-motion.js';

const file = new URL('./assets/env/service-lift.glb', import.meta.url).href;
const leafWidth = .379;

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
  model.traverse(node => {
    if (node.isMesh) node.receiveShadow = node.castShadow = true;
  });
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
