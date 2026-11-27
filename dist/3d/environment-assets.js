import { Box3, BoxGeometry, CanvasTexture, Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const modelPath = file => new URL('./assets/env/' + file + '.glb', import.meta.url).href;

function plans(visual) {
  const { x, z } = visual.decoded.spawn;
  if (visual.theme === 0) return [
    { file: 'steamtrap', place: [x - 4.58, 0, z - 2.83, .65, .95], footprint: [1.55, .74] },
    { file: 'compressor', place: [x - 3.74, 0, z - 4.34, Math.PI / 2, 1.15], footprint: [2.42, 1.07] },
    { file: 'fire-alarm', place: [x - 1.70, 1.37, z - 5.96, 0, 1.20] },
    { file: 'boiler-tool-chest', place: [x + 4.91, 0, z - 5.10, -.14, 1.16], footprint: [.93, .56] },
    { file: 'boiler-arrival-extractor', place: [x + 4.91, 1.67, z - 5.99, 0, 1], authoredOrigin: true,
      replaces: 'Arrival extractor fallback' }
  ];
  if (visual.theme === 1) {
    const note = visual.decoded.notes?.find(tile => tile.kind === 'N');
    const cabinet = visual.decoded.get(9, 16);
    return [
    ...(cabinet?.kind === '.' ? [{ file: 'archive-drawer-cabinet', place: [cabinet.x, 0, cabinet.z + .76, Math.PI, 1],
      optional: true, replaces: 'Personnel drawers', footprint: [1.15, .54] }] : []),
    ...(note ? [{ file: 'office-phonograph', place: [note.x - .38, 0, note.z, .12, 1.04],
      optional: true, footprint: [.98, .76] }] : []),
    { file: 'ticketcase', place: [x - 5.83, .93, z + .90, Math.PI / 2, 1.1], optional: true },
    { file: 'records-desk', place: [x - 2.52, 0, z - 4.63, 0, 1.10], replaces: 'F4 records desk', footprint: [2.55, 1.33] },
    { file: 'dispatch-radio', place: [x - 2.72, .866, z - 4.54, -.13, 1.44] },
    { file: 'records-lamp', place: [x - 1.79, .80, z - 4.82, Math.PI, .86] }
    ];
  }
  const header = visual.decoded.get(9, 6);
  return [
    { file: 'rainhead', place: [x + 6.20, 0, z - 4.30, -.14, 1.02], footprint: [.90, .50] },
    { file: 'roof-condenser', place: [x + 4.26, -.24, z - 5.30, -.14, 1.32], replaces: 'Rooftop exhaust HVAC-03', footprint: [1.45, .80] },
    { file: 'roof-garden-bed', place: [x - 3.58, 0, z - 4.42, -.12, 1], authoredOrigin: true,
      replaces: 'Rooftop rain-fed herb bed', footprint: [1.86, .83] },
    ...(header?.kind === '#' ? [{ file: 'roof-irrigation-header', place: [header.x + 1.23, 0, header.z, Math.PI / 2, 1],
      authoredOrigin: true, replaces: 'Roof irrigation header' }] : [])
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

function placeModel(scene, target, dimensions, authoredOrigin = false) {
  const [x, y, z, yaw, scale] = dimensions;
  const frame = new Group();
  frame.rotation.y = yaw;
  frame.scale.setScalar(scale);
  frame.add(scene);
  if (authoredOrigin) frame.position.set(x, y, z);
  else {
    frame.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(frame, true);
    const center = bounds.getCenter(new Vector3());
    frame.position.set(x - center.x, y - bounds.min.y, z - center.z);
  }
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

export async function mountRoofNurseries(visual, fallback) {
  if (!visual.roofNurseries.length) return false;
  const { stage, roofNurseries } = visual;
  try {
    const { scene } = await loader.loadAsync(modelPath('roof-nursery-box'));
    const resources = assetsFor(scene);
    if (visual.stage !== stage) {
      for (const set of Object.values(resources)) for (const resource of set) resource.dispose();
      return false;
    }
    scene.updateMatrixWorld(true);
    const placement = new Matrix4(), world = new Matrix4();
    const color = new Color();
    const group = new Group();
    group.name = 'Modeled nursery boxes';
    scene.traverse(part => {
      if (!part.isMesh) return;
      const instances = new InstancedMesh(part.geometry, part.material, roofNurseries.length);
      instances.castShadow = instances.receiveShadow = true;
      for (const [i, { x, z, angle, flip, shade }] of roofNurseries.entries()) {
        placement.makeRotationY(angle + flip * Math.PI).setPosition(x, .001, z);
        instances.setMatrixAt(i, world.multiplyMatrices(placement, part.matrixWorld));
        instances.setColorAt(i, color.setScalar(shade));
      }
      instances.computeBoundingSphere();
      group.add(instances);
    });
    if (!group.children.length) return false;
    stage.add(group);
    visual.localTextures.push(...resources.textures);
    fallback.visible = false;
    visual.renderer.shadowMap.needsUpdate = true;
    return true;
  } catch (error) {
    console.warn('The modeled roof nursery boxes could not load.', error);
    return false;
  }
}

async function mountGroup(visual, stage, anisotropy, placements, fitted = false) {
  const results = await Promise.allSettled(placements.map(plan => loader.loadAsync(modelPath(plan.file))));
  const usable = stage === visual.stage && (!fitted || results.every(result => result.status === 'fulfilled'));

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
    placeModel(scene, dressing, plan.place, plan.authoredOrigin);
    if (plan.footprint) contactShadow(visual, dressing, plan);
    if (plan.file === 'roof-condenser') condenserStand(visual, dressing, plan.place);
    if (plan.file === 'boiler-arrival-extractor') {
      const rotor = scene.getObjectByName('ExtractorRotor');
      if (rotor) visual.kinetics.push({ rotor, speed: 3.8 });
    }
    stage.add(dressing);
    visual.overlayFrame = null;
    visual.renderer.shadowMap.needsUpdate = true;
    const fallback = plan.replaces && stage.getObjectByName(plan.replaces);
    if (fallback) fallback.visible = false;
  }
  return results.map((result, index) => ({
    file: placements[index].file, loaded: usable && result.status === 'fulfilled'
  }));
}

export async function mountEnvironment(visual) {
  const stage = visual.stage;
  const anisotropy = Math.min(8, visual.renderer.capabilities.getMaxAnisotropy());
  const placements = plans(visual);
  if (visual.theme !== 1) return mountGroup(visual, stage, anisotropy, placements);

  // The radio and clamp lamp use the fitted desk surface as their support.
  // Mount that trio together; unrelated props can finish in any order.
  const fitted = placements.filter(plan => !plan.optional);
  const optional = placements.filter(plan => plan.optional);
  const groups = await Promise.all([
    mountGroup(visual, stage, anisotropy, fitted, true),
    ...optional.map(plan => mountGroup(visual, stage, anisotropy, [plan]))
  ]);
  const byFile = new Map(groups.flat().map(result => [result.file, result]));
  return placements.map(({ file }) => byFile.get(file));
}
