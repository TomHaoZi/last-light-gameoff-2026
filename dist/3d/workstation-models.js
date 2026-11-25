import { Group } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
// Local +Z faces the operator. Each bracket clears the existing status lamp
// and the action below it while staying inside the cabinet's interaction cell.
const mounts = [
  { asset: 'station-pressure', right: .225, height: 1.168, front: .015 },
  { asset: 'station-timeclock', right: .198, height: 1.006, front: .102 },
  { asset: 'station-flow', right: .202, height: 1.178, front: .022 }
];

function discard(template) {
  const geometry = new Set();
  const materials = new Set();
  template.traverse(part => {
    if (!part.isMesh) return;
    geometry.add(part.geometry);
    materials.add(part.material);
  });
  for (const item of geometry) item.dispose();
  for (const item of materials) item.dispose();
}

export async function mountWorkstations(visual) {
  const { theme, stage } = visual;
  const mount = mounts[theme];
  if (!mount) return false;
  let template;
  try {
    const file = new URL('./assets/env/' + mount.asset + '.glb', import.meta.url);
    template = (await loader.loadAsync(file.href)).scene;
  } catch (error) {
    console.warn('Could not load the workstation instrument.', error);
    return false;
  }
  if (visual.stage !== stage) {
    discard(template);
    return false;
  }
  for (const tile of visual.decoded.stations) {
    const record = visual.objects.get(tile.key || tile.kind);
    if (!record) continue;
    const { x, z, dx, dz } = visual.edgeOffset(tile, .73);
    const frame = new Group();
    frame.name = mount.asset + '-' + (tile.key || tile.kind);
    frame.rotation.y = Math.atan2(-dx, -dz);
    frame.position.set(x, mount.height, z);
    const model = template.clone(true);
    model.position.set(mount.right, 0, mount.front);
    model.traverse(part => {
      if (!part.isMesh) return;
      part.castShadow = true;
      part.receiveShadow = true;
    });
    frame.add(model);
    stage.add(frame);
    const mechanism = model.getObjectByName('Mechanism');
    if (mechanism) {
      record.workstation = { theme, mechanism, base: mechanism.position.clone() };
    }
  }
  return true;
}

export function updateWorkstation(record, pose, time, reduced) {
  const instrument = record.workstation;
  if (!instrument) return;
  const { mechanism, theme, base } = instrument;
  const value = pose.meter;
  if (theme === 0) {
    const tremble = reduced ? 0 : Math.sin(time * 5.6) * .026 * pose.discharge;
    mechanism.rotation.z = -1.09 + value * 2.20 + tremble;
  } else if (theme === 1) {
    mechanism.position.z = base.z + value * .06;
    mechanism.position.y = base.y - value * .03;
    mechanism.rotation.x = value * .086;
  } else {
    const flow = reduced ? 0 : Math.sin(time * 11) * .0034 * pose.discharge;
    mechanism.position.y = base.y + value * .071 + flow;
  }
}
