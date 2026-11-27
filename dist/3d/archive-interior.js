import {
  Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3
} from 'three';
import { TILE } from './levels.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const file = new URL('./assets/env/archive-interior.glb', import.meta.url);
const Y = new Vector3(0, 1, 0);
const scale = new Vector3(1, 1, 1);
const axes = [[0,-1], [1,0], [0,1], [-1,0]];

function wallMount(map, col, row, height, directions = axes) {
  const tile = map.get(col, row);
  if (!tile || tile.phase || tile.kind !== '.') return null;
  for (const [dx, dz] of directions) {
    if (map.get(col + dx, row + dz)?.kind === '#') {
      return [tile.x + dx * 1.186, height, tile.z + dz * 1.186, Math.atan2(-dx,-dz)];
    }
  }
  return null;
}

function plans(map, fixtures) {
  const kit = new Map();
  const add = (asset, placement, color) => {
    if (!placement) return;
    if (!kit.has(asset)) kit.set(asset, []);
    kit.get(asset).push({ placement, color });
  };
  for (const tile of map.floors) {
    // Hazard metadata also has a phase, but only bridge tiles lose their
    // floor when the phase changes. Keep a slab under machinery in both.
    if (tile.kind === 'd' || tile.kind === 'n') continue;
    const code = (tile.col * 73 + tile.row * 109) % 17;
    const tone = .83 + code * .009;
    add('FloorSlab', [tile.x, -.0002, tile.z, code % 4 * Math.PI / 2],
      new Color(tone, tone * (code % 2 ? .975 : 1), tone * 1.012));
  }
  for (const {x, y, z, damaged, angle} of fixtures) {
    add(damaged ? 'DamagedFitting' : 'FluorescentFitting', [x,y,z,angle]);
  }
  for (const [x, z] of [[8,14], [12,13], [9,10], [12,6], [14,2], [17,2], [19,9], [2,6], [3,13]]) {
    add('RegisterCabinet', wallMount(map, x, z, 0));
  }
  for (const [x,z] of [[8,15],[9,15],[12,11],[10,5],[14,2],[21,9],[4,13]]) {
    add('ReturnGrille', wallMount(map, x, z, 2.54));
  }
  const bulkheads = [[8,15], [12,11], [11,3], [15,2], [19,10], [3,13]]
    .map(([x,z]) => wallMount(map,x,z,2.16)).filter(Boolean);
  for (const placement of bulkheads) add('FireBulkhead', placement);
  for (const [col, row] of [[9,15],[12,12],[11,4],[14,2],[18,6],[21,10],[3,11]]) {
    const tile = map.get(col,row);
    if (tile?.kind === '.' && !tile.phase) {
      add('FloorDrain', [tile.x + .66,0,tile.z - .67, (row % 2) * Math.PI/2]);
    }
  }
  for (const [col,row] of [[8,14],[11,11],[10,6],[12,3],[14,2],[21,9],[2,12]]) {
    const tile = map.get(col,row);
    if (tile?.kind === '.' && !tile.phase) {
      add('LedgerSpill',[tile.x - .41,.009,tile.z + .43,(col + row) * .79]);
    }
  }
  return { kit, bulkheads };
}

export async function mountArchiveInterior(visual) {
  const stage = visual.stage;
  if (visual.theme !== 1) return false;
  const { kit, bulkheads } = plans(visual.decoded, visual.archiveFixtures);
  let scene;
  try {
    ({ scene } = await new GLTFLoader().loadAsync(file.href));
  } catch (error) {
    console.warn('The modeled archive interior could not load.', error);
    return false;
  }
  const geometries = new Set();
  const materials = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    materials.add(object.material);
  });
  if (visual.stage !== stage || [...kit.keys()].some(name => !scene.getObjectByName(name))) {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    return false;
  }
  const ownedGeometry = new Set();
  const ownedMaterials = new Set();
  const dressing = new Group();
  dressing.name = 'Authored archive interior';
  const floor = visual.materials.floor;
  const origin = new Vector3();
  const rotation = new Quaternion();
  const matrix = new Matrix4();
  const placementMatrix = new Matrix4();
  scene.updateMatrixWorld(true);
  for (const [name, placements] of kit) {
    const isFloor = name === 'FloorSlab';
    const sectors = new Map();
    for (const entry of placements) {
      const [x,,z] = entry.placement;
      const sector = Math.floor(x / (8*TILE)) + '/' + Math.floor(z / (8*TILE));
      if (!sectors.has(sector)) sectors.set(sector, []);
      sectors.get(sector).push(entry);
    }
    scene.getObjectByName(name).traverse(source => {
      if (!source.isMesh) return;
      const material = isFloor ? floor : source.material;
      ownedGeometry.add(source.geometry);
      ownedMaterials.add(material);
      if (material.name === 'GlassPhosphor') visual.archiveTube = material;
      if (material.name === 'BulkheadGlass') visual.archiveBulkhead = material;
      for (const instances of sectors.values()) {
        const mesh = new InstancedMesh(source.geometry, material, instances.length);
        mesh.name = source.name;
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = !isFloor && ['RegisterCabinet', 'FireBulkhead', 'FluorescentFitting', 'DamagedFitting'].includes(name);
        mesh.receiveShadow = true;
        for (const [index, { placement, color }] of instances.entries()) {
          const [x,y,z,yaw] = placement;
          placementMatrix.compose(origin.set(x,y,z), rotation.setFromAxisAngle(Y,yaw), scale);
          mesh.setMatrixAt(index,matrix.multiplyMatrices(placementMatrix,source.matrixWorld));
          if (color) mesh.setColorAt(index,color);
        }
        mesh.computeBoundingSphere();
        dressing.add(mesh);
      }
    });
  }
  for (const geometry of geometries) if (!ownedGeometry.has(geometry)) geometry.dispose();
  for (const material of materials) if (!ownedMaterials.has(material)) material.dispose();
  for (const surface of stage.children) if (surface.isInstancedMesh && surface.material === floor) surface.visible = false;
  visual.archiveFixtureFallback.visible = false;
  stage.add(dressing);
  for (const [x,y,z,yaw] of bulkheads) {
    visual.lightSource(x + Math.sin(yaw)*.26, y, z + Math.cos(yaw)*.26, 8, 'bulkhead', .56);
  }
  visual.fixtureSearchTime = -Infinity;
  visual.renderer.shadowMap.needsUpdate = true;
  return true;
}
