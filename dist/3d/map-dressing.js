import { Box3, Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/utils/BufferGeometryUtils.js';
import { TILE } from './levels.js';
import { dressingBounds, trackBoilerBatch } from './dressing-visibility.js';

const loader = new GLTFLoader();
const up = new Vector3(0,1,0);
const chunkSize = TILE * 2;

function dressingChunks(points) {
  const chunks = new Map();
  for (const point of points) {
    const key = Math.floor(point.x / chunkSize) + '/' + Math.floor(point.z / chunkSize);
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(point);
  }
  return chunks.values();
}

function batchParts(parts) {
  const byMaterial = new Map();
  const originals = new Set();
  for (const part of parts) {
    if (!byMaterial.has(part.material)) byMaterial.set(part.material, []);
    byMaterial.get(part.material).push(part.geometry.clone().applyMatrix4(part.matrixWorld));
    originals.add(part.geometry);
  }
  for (const geometry of originals) geometry.dispose();
  return [...byMaterial].flatMap(([material, geometries]) => {
    const combined = geometries.length > 1 ? mergeGeometries(geometries) : null;
    if (!combined) return geometries.map(geometry => ({geometry, material}));
    for (const geometry of geometries) geometry.dispose();
    return [{geometry: combined, material}];
  });
}

// Normalize a multi-object GLB to a floor-aligned envelope, without flattening
// its component meshes or materials. Only the display batch uses this transform.
export function fitModel(scene, size) {
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene, true);
  const center = bounds.getCenter(new Vector3());
  const source = bounds.getSize(new Vector3());
  const scale = new Vector3(...size).divide(source);
  const origin = new Vector3(center.x,bounds.min.y,center.z).multiply(scale).negate();
  return new Matrix4().makeScale(scale.x,scale.y,scale.z).setPosition(origin);
}

export async function mountMapDressing(visual) {
  const { stage, mapDressing } = visual;
  const results = await Promise.all([...mapDressing].map(async ([key, { file,size,points,fallback }]) => {
    if (!points.length) return [key,0];
    try {
      const { scene } = await loader.loadAsync(new URL('./assets/env/' + file + '.glb', import.meta.url).href);
      const parts = [], textures = new Set();
      const fit = fitModel(scene, size);
      scene.traverse(part => {
        if (!part.isMesh) return;
        parts.push(part);
        for (const value of Object.values(part.material)) if (value?.isTexture) textures.add(value);
      });
      if (visual.stage !== stage) {
        for (const part of parts) { part.geometry.dispose(); part.material.dispose(); }
        for (const texture of textures) texture.dispose();
        return [key,0];
      }
      const group = new Group();
      group.name = `Map dressing: ${key}`;
      const place = new Matrix4(), matrix = new Matrix4(), origin = new Vector3();
      const angle = new Quaternion(), scale = new Vector3(1,1,1), shade = new Color();
      const chunks = [...dressingChunks(points)].map(points => ({
        points, bounds: dressingBounds(points, size), instances: []
      }));
      for (const [partIndex, part] of batchParts(parts).entries()) {
        for (const chunk of chunks) {
          const batch = new InstancedMesh(part.geometry, part.material, chunk.points.length);
          batch.userData.dressingPart = partIndex;
          batch.castShadow = size[1] > .2;
          batch.receiveShadow = true;
          for (const [i,{x,y,z,yaw,light}] of chunk.points.entries()) {
            place.compose(origin.set(x,y,z),angle.setFromAxisAngle(up,yaw),scale);
            batch.setMatrixAt(i,matrix.multiplyMatrices(place,fit));
            batch.setColorAt(i,shade.setScalar(light));
          }
          // Each chunk has local bounds for the camera and headlamp shadow
          // frusta. Keep every original instance and its original material.
          batch.computeBoundingSphere();
          group.add(batch);
          chunk.instances.push(batch);
        }
      }
      if (group.children.length) {
        for (const texture of textures) {
          texture.anisotropy = Math.min(8,visual.renderer.capabilities.getMaxAnisotropy());
          visual.localTextures.push(texture);
        }
        stage.add(group);
        for (const chunk of chunks) trackBoilerBatch(visual, chunk.instances, chunk.bounds);
        fallback.visible = false;
        visual.renderer.shadowMap.needsUpdate = true;
      }
      return [key,group.children.length ? points.length : 0];
    } catch (error) {
      console.warn('Map dressing asset unavailable: ' + file,error);
      return [key,0];
    }
  }));
  return Object.fromEntries(results);
}

export const MAP_DRESSING = {
  cylinder: ['boiler-cylinder',[.54,.89,.54]],
  toolbox: ['boiler-maintenance-box',[.49,.27,.41]],
  desk: ['records-desk',[1.57,.82,.58]],
  notepads: ['archive-notepads',[.48,.068,.27]],
  cabinet: ['archive-drawer-cabinet',[.56,1.25,.46]],
  generator: ['boiler-service-generator',[.818,.577,.564]],
  utilityBox: ['archive-wall-utility-box',[.520,1.120,.432]],
  hose: ['roof-irrigation-wall-hose',[.467,.557,.250]]
};
