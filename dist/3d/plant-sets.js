import {
  DynamicDrawUsage, Group, InstancedMesh, MathUtils, Matrix4, Quaternion, Vector3
} from 'three';
import { TILE } from './levels.js';
import { waitForRenderIdle } from './render-idle.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const staged = new WeakMap();
const NORTH = [0, -1];
const EAST = [1, 0];
const SOUTH = [0, 1];
const WEST = [-1, 0];
const TURN = new Vector3(0, 1, 0);
const UNIT = new Vector3(1, 1, 1);

function wall(map, col, row, toward, height) {
  const tile = map.get(col, row);
  const [dx, dz] = toward;
  if (tile?.kind !== '.' || map.get(col + dx, row + dz)?.kind !== '#') return null;
  return [tile.x + dx * 1.187, height, tile.z + dz * 1.187, Math.atan2(-dx, -dz)];
}

function edge(map, col, row, toward, height) {
  const tile = map.get(col, row);
  const [dx, dz] = toward;
  if (tile?.kind !== '.' || map.get(col + dx, row + dz)) return null;
  // Mount beneath the permanent deck or on its outside face. A phase
  // platform never owns a prop from this set.
  return [tile.x + dx * 1.218, height, tile.z + dz * 1.218, Math.atan2(dx, dz)];
}

function top(map, col, row, height, yaw = 0) {
  const tile = map.get(col, row);
  return tile?.kind === '#' ? [tile.x, 1.372 + height, tile.z, yaw] : null;
}

function floor(map, col, row, x, z, yaw = 0) {
  const tile = map.get(col, row);
  return tile?.kind === '.' ? [tile.x + x, .001, tile.z + z, yaw] : null;
}

export function plantPlacementPlan(theme, map) {
  const groups = new Map();
  const lamps = [];
  const add = (name, where) => {
    if (!where) return;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(where);
  };
  const light = (name, where, strength, type = 'general') => {
    add(name, where);
    if (where) lamps.push({ where, strength, type });
  };
  if (theme === 0) {
    for (const [col, row, side] of [[4,14,NORTH], [2,8,WEST], [12,9,WEST], [19,8,WEST], [20,14,EAST]]) {
      add('ReliefSkid', wall(map, col, row, side, .008));
    }
    for (const [col, row, side] of [[3,14,NORTH], [2,7,WEST], [4,10,SOUTH], [15,8,WEST], [20,10,EAST], [18,2,SOUTH]]) {
      add('SteamSaddle', wall(map, col, row, side, 2.176));
    }
    const gate = map.get(5,14);
    if (gate?.kind === '.' && map.get(6,14)?.kind === '.') {
      add('Gantry', [gate.x + TILE / 2, 2.981, gate.z - 1.12, 0]);
    }
    for (const [col, row, side] of [[4,14,NORTH], [2,7,WEST], [4,10,SOUTH], [12,9,EAST], [20,10,EAST], [18,2,SOUTH]]) {
      light('CageLight', wall(map, col, row, side, 2.526), 9.8);
    }
    for (const [col, row, x, z] of [[5,14,.66,.57],[3,7,-.62,.69],[7,10,.68,.53],
        [12,10,.49,-.58],[17,10,-.65,-.42],[20,14,.46,-.64],[18,2,-.55,.62]]) {
      add('SumpGrate', floor(map,col,row,x,z,col%2 * Math.PI/2));
    }
  } else if (theme === 2) {
    add('WaterTower', top(map, 21,8,0,Math.PI));
    add('WaterTower', top(map, 22,9,0,Math.PI/2));
    for (const row of [6,7]) add('Glasshouse', top(map, 9,row,0,Math.PI/2));
    for (const [col,row,angle] of [[22,8,.12],[21,9,-Math.PI/2],[2,6,.22]]) {
      add('LouvreHood', top(map,col,row,0,angle));
      add('LouvreRotor', top(map,col,row,.657,angle));
    }
    add('Planter', top(map,2,5,0));
    for (const [col,row,side] of [[9,14,NORTH],[13,14,NORTH],[9,17,SOUTH],[4,11,SOUTH],
        [14,10,SOUTH],[22,12,SOUTH],[24,10,EAST]]) {
      add('Planter', edge(map,col,row,side,-.181));
    }
    for (const [col,row,side] of [[8,16,WEST],[9,17,SOUTH],[4,11,SOUTH],[8,9,WEST],
        [20,12,SOUTH],[22,12,SOUTH],[24,10,EAST],[11,1,NORTH]]) {
      add('Scupper', edge(map,col,row,side,-.091));
    }
    for (const [col,row,side] of [[3,5,WEST],[10,6,WEST],[20,8,EAST],[23,9,WEST]]) {
      light('Beacon', wall(map,col,row,side,1.163),5.4,'alarm');
    }
  }
  return { groups, lamps };
}

function inventory(template) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  template.traverse(part => {
    if (!part.isMesh) return;
    geometries.add(part.geometry);
    materials.add(part.material);
    for (const value of Object.values(part.material)) if (value?.isTexture) textures.add(value);
  });
  const references = new Map();
  for (const texture of textures) {
    const data = texture.source.data;
    if (typeof data?.close !== 'function') continue;
    references.set(data,(references.get(data) ?? 0) + 1);
    texture.addEventListener('dispose', () => {
      const remaining = references.get(data);
      if (remaining > 1) references.set(data,remaining - 1);
      else if (remaining === 1) {
        data.close();
        references.delete(data);
      }
    });
  }
  return { geometries, materials, textures };
}

function release(resources) {
  for (const group of Object.values(resources)) {
    for (const resource of group) resource.dispose();
  }
}

export async function mountPlantSets(visual) {
  const {stage, theme, renderer} = visual;
  const chapter = theme === 0 ? 'boiler' : theme === 2 ? 'roof' : null;
  if (!chapter) return false;
  const {groups, lamps} = plantPlacementPlan(theme, visual.decoded);
  let template;
  try {
    const file = new URL('./assets/env/' + chapter + '-plant.glb', import.meta.url);
    template = (await loader.loadAsync(file.href)).scene;
  } catch (error) {
    console.warn('The modeled plant structure could not load.', error);
    return false;
  }

  const resources = inventory(template);
  const modules = new Map([...groups.keys()].map(name => [name, template.getObjectByName(name)]));
  if ([...modules.values()].some(part => !part) || visual.stage !== stage) {
    release(resources);
    return false;
  }
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const texture of resources.textures) {
    texture.anisotropy = anisotropy;
    await waitForRenderIdle();
    if (visual.stage !== stage) {
      release(resources);
      return false;
    }
    renderer.initTexture(texture);
  }

  template.updateMatrixWorld(true);
  const stageSet = new Group();
  stageSet.name = chapter === 'boiler' ? 'Modeled pressure gallery' : 'Modeled roof services';
  const rotors = [];
  const poweredLenses = new Set();
  const matrix = new Matrix4(), origin = new Vector3(), rotation = new Quaternion();
  const fixed = new Matrix4();
  const owned = { geometries: new Set(), materials: new Set(), textures: resources.textures };
  for (const [name, transforms] of groups) {
    modules.get(name).traverse(source => {
      if (!source.isMesh) return;
      const mesh = new InstancedMesh(source.geometry, source.material, transforms.length);
      mesh.name = source.name;
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = ['ReliefSkid','Gantry','WaterTower','Glasshouse','LouvreHood','Planter'].includes(name);
      mesh.receiveShadow = true;
      owned.geometries.add(source.geometry);
      owned.materials.add(source.material);
      if (['ServiceLens','RedBeacon'].includes(source.material.name)) poweredLenses.add(source.material);
      const rotor = name === 'LouvreRotor';
      if (rotor) {
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        rotors.push({mesh, transforms, local:source.matrixWorld.clone()});
      }
      for (const [index, [x,y,z,yaw]] of transforms.entries()) {
        fixed.compose(origin.set(x,y,z),rotation.setFromAxisAngle(TURN,yaw),UNIT);
        mesh.setMatrixAt(index,matrix.multiplyMatrices(fixed,source.matrixWorld));
      }
      mesh.computeBoundingSphere();
      stageSet.add(mesh);
    });
  }
  for (const geometry of resources.geometries) if (!owned.geometries.has(geometry)) geometry.dispose();
  for (const material of resources.materials) if (!owned.materials.has(material)) material.dispose();
  visual.localTextures.push(...owned.textures);
  staged.set(visual, {stage, rotors, poweredLenses, startedAt: null, shaft:0, speed:1.9,
    matrix, origin, rotation, fixed});
  stage.add(stageSet);
  for (const { where, strength, type } of lamps) {
    const [x,y,z,yaw] = where;
    visual.lightSource(x + Math.sin(yaw)*.226, y, z + Math.cos(yaw)*.226,
      strength, type, .44);
  }
  visual.fixtureSearchTime = -Infinity;
  renderer.shadowMap.needsUpdate = true;
  return true;
}

export function updatePlantSets(visual, time, night, reduced) {
  const set = staged.get(visual);
  if (!set || set.stage !== visual.stage) return;
  for (const lens of set.poweredLenses) {
    const isBeacon = lens.name === 'RedBeacon';
    const gain = isBeacon ? night ? 2.4 : 1.25 : night ? .86 : 1.87;
    lens.emissiveIntensity = gain * (reduced ? 1 : .96 + .04 * Math.sin(time * (isBeacon ? 2.2 : 3.9)));
  }
  const elapsed = set.startedAt === null ? 0 : MathUtils.clamp(time - set.startedAt,0,.05);
  set.startedAt = time;
  if (reduced || !elapsed || !set.rotors.length) return;
  set.speed = MathUtils.damp(set.speed, night ? .52 : 5.7, 3, elapsed);
  set.shaft = (set.shaft + elapsed * set.speed) % (2 * Math.PI);
  const { matrix, origin, rotation, fixed } = set;
  for (const {mesh,transforms,local} of set.rotors) {
    for (const [index,[x,y,z,yaw]] of transforms.entries()) {
      fixed.compose(origin.set(x,y,z),rotation.setFromAxisAngle(TURN,yaw + set.shaft),UNIT);
      mesh.setMatrixAt(index,matrix.multiplyMatrices(fixed,local));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
