import { InstancedMesh, Matrix4 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const asset = new URL('./assets/env/checkpoint-lamp.glb', import.meta.url);
const loader = new GLTFLoader();

export async function mountCheckpointLamps(visual, fallback) {
  if (!visual.safeLamps.length) return;
  const { stage, safeLamps } = visual;
  try {
    const { scene } = await loader.loadAsync(asset.href);
    scene.updateMatrixWorld(true);
    const pose = new Matrix4();
    const matrix = new Matrix4();
    const meshes = [];
    scene.traverse(part => { if (part.isMesh) meshes.push(part); });
    if (stage !== visual.stage) {
      for (const geometry of new Set(meshes.map(part => part.geometry))) geometry.dispose();
      for (const material of new Set(meshes.map(part => part.material))) material.dispose();
      return;
    }
    for (const part of meshes) {
      const draw = new InstancedMesh(part.geometry, part.material, safeLamps.length);
      draw.name = 'Checkpoint lantern · ' + part.name;
      draw.castShadow = part.material.emissiveIntensity <= 1;
      draw.receiveShadow = true;
      for (const [i, { x, z, angle }] of safeLamps.entries()) {
        pose.makeRotationY(angle).setPosition(x, 0, z);
        draw.setMatrixAt(i, matrix.multiplyMatrices(pose, part.matrixWorld));
      }
      draw.computeBoundingSphere();
      stage.add(draw);
    }
    if (meshes.length) fallback.visible = false;
  } catch (error) {
    console.warn('Checkpoint lantern asset unavailable; retaining its fallback.', error);
  }
}
