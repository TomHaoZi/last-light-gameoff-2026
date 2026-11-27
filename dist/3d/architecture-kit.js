import { Box3, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { trackBoilerBatch } from './dressing-visibility.js';

const url = new URL('./assets/env/architecture-rc27.glb',import.meta.url).href;
const junctionUrl = new URL('./assets/env/junctions-rc29.glb',import.meta.url).href;
const utilityUrl = new URL('./assets/env/utilities-rc30.glb',import.meta.url).href;
const detailUrl = new URL('./assets/env/detail-rc31.glb',import.meta.url).href;
const fitUrl = new URL('./assets/env/fit-rc32.glb',import.meta.url).href;
const loader = new GLTFLoader();
const up = new Vector3(0,1,0);
const boilerCellSize = 6;
const spreadBoilerFamilies = new Set(['PipeSaddle', 'BoilerLouvre', 'PhaseDeckNight']);

function boilerCells(points) {
  const cells = new Map();
  for (const point of points) {
    const x = Math.floor(point[0] / boilerCellSize);
    const z = Math.floor(point[2] / boilerCellSize);
    const key = x + '/' + z;
    if (!cells.has(key)) cells.set(key, {points: [], instances: [], bounds: new Box3()});
    cells.get(key).points.push(point);
  }
  return [...cells.values()];
}

// Each stage owns its resources so rapid restart/transition cannot dispose
// materials still being drawn by a different stage.
export const mountArchitecture = visual => mountKit(visual,visual.architecture,url);
export const mountJunctions = visual => mountKit(visual,visual.junctions,junctionUrl);
export const mountUtilities = visual => mountKit(visual,visual.utilities,utilityUrl);
export const mountDetail = visual => mountKit(visual,visual.detail,detailUrl);
export const mountFit = visual => mountKit(visual,visual.fit,fitUrl);
const signMountUrl = new URL('./assets/env/sign-mount-rc33.glb',import.meta.url).href;
export const mountSignTrays = visual => mountKit(visual,visual.signMounts,signMountUrl);
const roofCornerUrl = new URL('./assets/env/roof-corners-rc34.glb',import.meta.url).href;
export const mountRoofCorners = visual => mountKit(visual,visual.roofCorners,roofCornerUrl);
const roofSpliceUrl = new URL('./assets/env/roof-splices-rc35.glb',import.meta.url).href;
export const mountRoofSplices = visual => mountKit(visual,visual.roofSplices,roofSpliceUrl);
const cityGroundUrl = new URL('./assets/env/city-ground-rc35.glb',import.meta.url).href;
export async function mountCityGround(visual) {
  const {stage,cityGround,cityGroundFallback}=visual;
  if(!cityGround.size)return {};
  const report=await mountKit(visual,cityGround,cityGroundUrl);
  if(visual.stage!==stage)return report;
  if(Object.keys(report).length!==cityGround.size) {
    // The blank grade remains airtight if the remote kit is missing a family.
    for(const [name,plan] of cityGround) {
      const partial=stage.getObjectByName('Architecture: '+name);
      if(partial) partial.visible=false;
      plan.fallback.visible=true;
    }
    return report;
  }
  cityGroundFallback.visible=false;
  visual.cityLamp=null;
  stage.getObjectByName('Architecture: CityStreetLight')?.traverse(o=>{
    if(o.isMesh&&o.material.name==='City lamp amber diffuser')visual.cityLamp=o.material;
  });
  return report;
}

async function mountKit(visual,architecture,file) {
  const { stage } = visual;
  if (!architecture?.size) return {};
  try {
    const { scene } = await loader.loadAsync(file);
    scene.updateMatrixWorld(true);
    const keepGeometry = new Set(), keepMaterial = new Set();
    const position = new Vector3(), size = new Vector3(), rotate = new Quaternion();
    const place = new Matrix4(), transformed = new Matrix4();
    const report = {};
    if (stage === visual.stage) for (const [name,{points,fallback,phase}] of architecture) {
      const source = scene.getObjectByName(name);
      if (!source) continue;
      const group = new Group();
      group.name = 'Architecture: ' + name;
      const split = visual.theme === 0 && spreadBoilerFamilies.has(name);
      const cells = split ? boilerCells(points) : [{points}];
      let partIndex = 0;
      source.traverse(part => {
        if (!part.isMesh) return;
        keepGeometry.add(part.geometry);
        keepMaterial.add(part.material);
        const distant = name.startsWith('FarCity') || name.startsWith('City');
        if (distant) part.material.fog = false;
        for (const cell of cells) {
          const mesh = new InstancedMesh(part.geometry,part.material,cell.points.length);
          mesh.userData.architecturePart = partIndex;
          mesh.receiveShadow = !distant;
          for (const [i,[x,y,z,yaw,sx=1,sy=1,sz=1]] of cell.points.entries()) {
            place.compose(position.set(x,y,z),rotate.setFromAxisAngle(up,yaw),size.set(sx,sy,sz));
            mesh.setMatrixAt(i,transformed.multiplyMatrices(place,part.matrixWorld));
          }
          mesh.computeBoundingSphere();
          group.add(mesh);
          if (split) {
            mesh.computeBoundingBox();
            cell.bounds.union(mesh.boundingBox);
            cell.instances.push(mesh);
          }
        }
        partIndex++;
      });
      if (!group.children.length) continue;
      (phase === 'neutral' ? stage : visual.groups[phase]).add(group);
      if (split) for (const {bounds: {min, max}, instances} of cells) {
        trackBoilerBatch(visual, instances, {
          minX: min.x, minY: min.y, minZ: min.z, maxX: max.x, maxY: max.y, maxZ: max.z,
          corners: [[min.x,min.z],[min.x,max.z],[max.x,min.z],[max.x,max.z]]
        });
      }
      fallback.visible = false;
      report[name] = points.length;
    }
    const discardGeometry = new Set(), discardMaterial = new Set();
    scene.traverse(part => {
      if (!part.isMesh) return;
      if (!keepGeometry.has(part.geometry)) discardGeometry.add(part.geometry);
      if (!keepMaterial.has(part.material)) discardMaterial.add(part.material);
    });
    for (const item of [...discardGeometry,...discardMaterial]) item.dispose();
    if (stage === visual.stage && Object.keys(report).length) visual.renderer.shadowMap.needsUpdate = true;
    return report;
  } catch (error) {
    console.warn('Architecture kit unavailable:',error);
    return {};
  }
}

let annexJunctions, annexUtilities, annexDetail, annexFit;
export function preloadAnnexFit() {
  return annexFit ??= annexFamily(fitUrl,{carpetbound:'AnnexCarpetBoundEdge',recessbar:'AnnexRecessBar'}).catch(error=>{
    annexFit=null; console.warn('Annex fit kit unavailable:',error); return new Map();
  });
}
export function preloadAnnexDetail() {
  return annexDetail ??= annexFamily(detailUrl,{paneljoint:'AnnexPanelJoint',bridgecorner:'AnnexBridgeCorner'}).catch(error=>{
    annexDetail=null; console.warn('Annex detail kit unavailable:',error); return new Map();
  });
}
export function preloadAnnexJunctions() {
  return annexJunctions ??= annexFamily(junctionUrl,{cove:'AnnexBase',crown:'AnnexCrown',
    doorframe:'AnnexFireCasing',doorsill:'AnnexDoorSill'}).catch(error=>{
    annexJunctions=null; console.warn('Annex junction kit unavailable:',error); return new Map();
  });
}

export function preloadAnnexUtilities() {
  return annexUtilities ??= annexFamily(utilityUrl,{dangerlip:'AnnexNosing',floorbar:'AnnexCarpetBar'}).catch(error=>{
    annexUtilities=null; console.warn('Annex utility kit unavailable:',error); return new Map();
  });
}

function annexFamily(file,names) {
  return loader.loadAsync(file).then(({scene}) => {
    scene.updateMatrixWorld(true);
    const use = new Set(), all = new Set(), geometry = new Set();
    const kits = new Map();
    for (const [name,sourceName] of Object.entries(names)) {
      const list = [];
      scene.getObjectByName(sourceName)?.traverse(part => {
        if (!part.isMesh) return;
        use.add(part.material);
        list.push({geometry:part.geometry.clone().applyMatrix4(part.matrixWorld),material:part.material});
      });
      if (list.length) kits.set(name,list);
    }
    scene.traverse(part => { if (part.isMesh) { all.add(part.material); geometry.add(part.geometry); } });
    for (const m of all) if (!use.has(m)) m.dispose();
    for (const g of geometry) g.dispose();
    return kits;
  });
}

let annex;
export function preloadAnnexPitLining() {
  return annex ??= loader.loadAsync(url).then(({scene}) => {
    scene.updateMatrixWorld(true);
    const parts = [];
    const lining = scene.getObjectByName('AnnexPitLining');
    const materials = new Set();
    lining?.traverse(part => {
      if (!part.isMesh) return;
      const geometry = part.geometry.clone().applyMatrix4(part.matrixWorld);
      geometry.name = 'Precast annex pit lining';
      materials.add(part.material);
      parts.push({geometry,material:part.material});
    });
    const waste = new Set();
    scene.traverse(part => {
      if (!part.isMesh) return;
      waste.add(part.geometry);
      if (!materials.has(part.material)) waste.add(part.material);
    });
    for (const item of waste) item.dispose();
    return parts;
  }).catch(error => { annex = null; console.warn('Annex pit detail unavailable:',error); return []; });
}
