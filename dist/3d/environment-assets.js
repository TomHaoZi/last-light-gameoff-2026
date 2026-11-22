import { Box3, BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const modelPath = file => new URL('./assets/env/' + file + '.glb', import.meta.url).href;

function plans(visual) {
  const { x, z } = visual.decoded.spawn;
  if (visual.theme === 0) return [
    { file: 'compressor', place: [x - 3.74, 0, z - 4.34, Math.PI / 2, 1.15], footprint: [2.42, 1.07] },
    { file: 'fire-alarm', place: [x - 1.70, 1.37, z - 5.96, 0, 1.20] }
  ];
  if (visual.theme === 1) return [
    { file: 'records-desk', place: [x - 2.52, 0, z - 4.63, 0, 1.10], replaces: 'F4 records desk', footprint: [2.55, 1.33] },
    { file: 'dispatch-radio', place: [x - 2.72, .866, z - 4.54, -.13, 1.44] },
    { file: 'records-lamp', place: [x - 1.79, .80, z - 4.82, Math.PI, .86] }
  ];
  return [
    { file: 'roof-condenser', place: [x + 4.26, -.24, z - 5.30, -.14, 1.32], replaces: 'Rooftop exhaust HVAC-03', footprint: [1.45, .80] }
  ];
}

function assetsFor(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse(item => {
    if (!item.isMesh) return;
    geometries.add(item.geometry);
    for (const material of [].concat(item.material)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures };
}

function releaseTexturesOnDispose(textures) {
  const references = new Map();
  for (const texture of textures) {
    const image = texture.source.data;
    if (typeof image?.close !== 'function') continue;
    references.set(image, (references.get(image) ?? 0) + 1);
    texture.addEventListener('dispose', () => {
      const count = references.get(image) - 1;
      if (count === 0) {
        image.close();
        references.delete(image);
      } else if (count > 0) {
        references.set(image, count);
      }
    });
  }
}

function placeModel(scene, target, dimensions) {
  const [x, y, z, yaw, scale] = dimensions;
  const frame = new Group();
  frame.rotation.y = yaw;
  frame.scale.setScalar(scale);
  frame.add(scene);
  frame.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(frame, true);
  const center = bounds.getCenter(new Vector3());
  frame.position.set(x - center.x, y - bounds.min.y, z - center.z);
  target.add(frame);
}

function contactShadow(visual, target, plan) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const falloff = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  falloff.addColorStop(0, 'rgba(0,0,0,0.36)');
  falloff.addColorStop(.55, 'rgba(0,0,0,0.26)');
  falloff.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = falloff;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  visual.localTextures.push(texture);
  const occlusion = new Mesh(new PlaneGeometry(...plan.footprint), new MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  }));
  const [x, , z, yaw] = plan.place;
  occlusion.position.set(x, .008, z);
  occlusion.rotation.set(-Math.PI / 2, 0, yaw);
  target.add(occlusion);
}

function condenserStand(visual, dressing, [x, , z, yaw]) {
  const base = new Group();
  base.position.set(x, 0, z);
  base.rotation.y = yaw;
  const runner = new BoxGeometry(.16, .27, .61);
  for (const side of [-1, 1]) {
    const rail = new Mesh(runner, visual.materials.dark);
    rail.position.set(side * .335, .135, -.013);
    rail.castShadow = true;
    rail.receiveShadow = true;
    base.add(rail);
  }
  dressing.add(base);
}

export async function mountEnvironment(visual) {
  const stage = visual.stage;
  const anisotropy = Math.min(8, visual.renderer.capabilities.getMaxAnisotropy());
  const placements = plans(visual);
  const results = await Promise.allSettled(placements.map(plan => loader.loadAsync(modelPath(plan.file))));
  // Keep the desk, radio and clamped lamp together if a file is missing.
  const usable = stage === visual.stage &&
    (visual.theme !== 1 || results.every(result => result.status === 'fulfilled'));

  for (const [index, result] of results.entries()) {
    if (result.status !== 'fulfilled') continue;
    const plan = placements[index];
    const scene = result.value.scene;
    const { geometries, materials, textures } = assetsFor(scene);
    releaseTexturesOnDispose(textures);

    // Chapters can change or a player can restart while an asset is loading.
    if (!usable) {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      continue;
    }

    for (const texture of textures) {
      texture.anisotropy = anisotropy;
      visual.localTextures.push(texture);
    }
    for (const material of materials) {
      material.envMapIntensity = .82;
      if (material.name === 'desk_lamp_arm_01_light') material.emissiveIntensity = .72;
    }
    scene.traverse(item => {
      if (!item.isMesh) return;
      item.castShadow = true;
      item.receiveShadow = true;
    });

    const dressing = new Group();
    dressing.name = 'Environment asset: ' + plan.file;
    placeModel(scene, dressing, plan.place);
    if (plan.footprint) contactShadow(visual, dressing, plan);
    if (plan.file === 'roof-condenser') condenserStand(visual, dressing, plan.place);
    stage.add(dressing);
    visual.renderer.shadowMap.needsUpdate = true;
    const fallback = plan.replaces && stage.getObjectByName(plan.replaces);
    if (fallback) fallback.visible = false;
  }
  return results.map((result, index) => ({
    file: placements[index].file, loaded: usable && result.status === 'fulfilled'
  }));
}
