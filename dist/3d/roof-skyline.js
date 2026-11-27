import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const source = new URL('./assets/env/roof-skyline.glb',import.meta.url).href;
const Y = new Vector3(0,1,0);

export async function mountRoofSkyline(visual) {
  const { stage, skyline } = visual;
  if (!skyline) return 0;
  try {
    const { scene } = await new GLTFLoader().loadAsync(source);
    const materials = new Set(), geometries = new Set();
    scene.updateMatrixWorld(true);
    scene.traverse(node => {
      if (!node.isMesh) return;
      materials.add(node.material);
      geometries.add(node.geometry);
    });
    if (visual.stage !== stage) {
      for (const resource of [...materials,...geometries]) resource.dispose();
      return 0;
    }
    const group = new Group();
    group.name = 'Modeled roof skyline';
    const position = new Vector3(), scale = new Vector3(), rotation = new Quaternion(), shade = new Color();
    const placement = new Matrix4(), transformed = new Matrix4();
    let drawn = 0;
    for (let style = 0; style < 3; style++) {
      const cluster = scene.getObjectByName('Skyline_' + style);
      const sites = skyline.sites.filter(point => point.style === style);
      if (!cluster || !sites.length) continue;
      cluster.traverse(node => {
        if (!node.isMesh) return;
        const batch = new InstancedMesh(node.geometry,node.material,sites.length);
        for (const [i,site] of sites.entries()) {
          position.set(site.x,-22,site.z);
          scale.set(site.width/5.26,site.height/16.42,site.depth/5.26);
          rotation.setFromAxisAngle(Y,site.turn);
          placement.compose(position,rotation,scale);
          batch.setMatrixAt(i,transformed.multiplyMatrices(placement,node.matrixWorld));
          batch.setColorAt(i,shade.setScalar(site.light));
        }
        batch.computeBoundingSphere();
        group.add(batch);
      });
      drawn += sites.length;
    }
    const lights = [];
    for (const material of materials) {
      material.fog = false;
      material.envMapIntensity = .46;
      if (material.emissive?.getHex()) lights.push(material);
    }
    if (drawn !== skyline.sites.length) {
      group.traverse(node => { if (node.isInstancedMesh) node.dispose(); });
      for (const resource of [...materials,...geometries]) resource.dispose();
      return 0;
    }
    stage.add(group);
    skyline.lights = lights;
    skyline.fallback.visible = false;
    return drawn;
  } catch (error) {
    console.warn('Modeled skyline unavailable.',error);
    return 0;
  }
}

export function updateRoofSkyline(skyline, night) {
  for (const material of skyline?.lights ?? []) {
    material.emissiveIntensity = material.name === 'Roof obstruction lights' ? .20 + night*1.33 : .24 + night*1.48;
  }
}
