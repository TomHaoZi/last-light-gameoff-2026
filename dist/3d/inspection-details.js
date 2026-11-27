import { Group, InstancedMesh, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const url = new URL('./assets/env/inspection-rc28.glb',import.meta.url).href;
const themes = ['Boiler','Archive','Roof'];
const recordThemes = ['Boiler','Office','Roof'];

export const evidenceStand = theme => themes[theme] + 'EvidenceStand';
export const evidenceModel = (theme, key) => recordThemes[theme] + 'Record' + key;

export async function mountInspectionDetails(visual) {
  const { stage, inspection } = visual;
  if (!inspection?.length) return {};
  try {
    const { scene } = await loader.loadAsync(url);
    scene.updateMatrixWorld(true);
    const keepGeometry = new Set(), keepMaterial = new Set();
    const remember = part => {
      keepGeometry.add(part.geometry);
      keepMaterial.add(part.material);
      part.receiveShadow = true;
    };
    const position = new Matrix4(), transform = new Matrix4(), offset = new Vector3();
    const report = {};
    if (visual.stage === stage) {
      const fixtures = new Map();
      for (const plan of inspection) {
        if (plan.indicator) {
          const source = scene.getObjectByName(plan.name);
          if (!source) continue;
          const copy = source.clone(true);
          copy.traverse(part => { if (part.isMesh) remember(part); });
          // The indicator group already owns the authoritative evidence
          // visibility. Attaching now cannot resurrect collected documents.
          plan.indicator.add(copy);
          plan.fallback.visible = false;
          report[plan.name] = 1;
        } else {
          if (!fixtures.has(plan.name)) fixtures.set(plan.name,[]);
          fixtures.get(plan.name).push(plan);
        }
      }
      for (const [name, plans] of fixtures) {
        const source = scene.getObjectByName(name);
        if (!source) continue;
        const group = new Group();
        group.name = 'Inspection: ' + name;
        source.traverse(part => {
          if (!part.isMesh) return;
          remember(part);
          const mesh = new InstancedMesh(part.geometry,part.material,plans.length);
          mesh.receiveShadow = true;
          for (const [i,{x,y,z,yaw}] of plans.entries()) {
            position.makeRotationY(yaw).setPosition(offset.set(x,y,z));
            mesh.setMatrixAt(i,transform.multiplyMatrices(position,part.matrixWorld));
          }
          mesh.computeBoundingSphere();
          group.add(mesh);
        });
        if (!group.children.length) continue;
        const phase = plans[0].phase;
        (phase ? visual.groups[phase] : stage).add(group);
        for (const { fallback } of plans) fallback.visible = false;
        report[name] = plans.length;
      }
    }
    const discard = new Set();
    scene.traverse(part => {
      if (!part.isMesh) return;
      if (!keepGeometry.has(part.geometry)) discard.add(part.geometry);
      if (!keepMaterial.has(part.material)) discard.add(part.material);
    });
    for (const resource of discard) resource.dispose();
    return report;
  } catch (error) {
    console.warn('Inspection detail kit unavailable:',error);
    return {};
  }
}
