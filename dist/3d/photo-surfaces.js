import {
  TextureLoader, RepeatWrapping, SRGBColorSpace, Vector2
} from 'three';
import { waitForRenderIdle } from './render-idle.js';

const FLOOR = ['boiler', 'archive-floor', 'roof'];
const SURFACES = {
  boiler: { tint: '#e3ded0', normal: .67 },
  block: { tint: '#acb9b7', normal: .67 },
  roof: { tint: '#e4e3dc', normal: .67 },
  'archive-floor': { tint: '#c2c7c1', normal: .82, roughness: .86 },
  'archive-plaster': { tint: '#b5beb3', normal: .76 }
};

export async function mountPhotoSurfaces(visual) {
  const stage = visual.stage;
  const loader = new TextureLoader();
  const anisotropy = Math.min(8, visual.renderer.capabilities.getMaxAnisotropy());
  const targets = [{ material: visual.materials.floor, asset: FLOOR[visual.theme] }];
  if (visual.theme === 0) targets.push({ material: visual.materials.wall, asset: 'block' });
  if (visual.theme === 1) targets.push({ material: visual.materials.wall, asset: 'archive-plaster' });

  return Promise.all(targets.map(async ({ material, asset }) => {
    const names = ['color', 'normal', 'arm'];
    const results = await Promise.allSettled(names.map(role => loader.loadAsync(
      new URL('./assets/surfaces/' + asset + '-' + role + '.webp', import.meta.url).href
    )));
    if (visual.stage !== stage || results.some(result => result.status !== 'fulfilled')) {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
      return { asset, loaded: false };
    }
    const previous = new Set([
      material.map, material.normalMap, material.aoMap, material.roughnessMap, material.metalnessMap
    ]);
    const [map, normalMap, surfaceMap] = results.map(result => result.value);
    for (const texture of [map, normalMap, surfaceMap]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    }
    map.colorSpace = SRGBColorSpace;
    if (asset.startsWith('archive-')) {
      // Prepare one photographed map per idle opportunity. The neutral
      // surfaces keep their existing material until all three maps are ready.
      for (const texture of [map, normalMap, surfaceMap]) {
        await waitForRenderIdle();
        if (visual.stage !== stage) {
          for (const item of [map, normalMap, surfaceMap]) item.dispose();
          return { asset, loaded: false };
        }
        visual.renderer.initTexture(texture);
      }
    }
    const { tint, normal, roughness = 1 } = SURFACES[asset];
    material.map = map;
    material.normalMap = normalMap;
    material.normalScale = new Vector2(normal, normal);
    if (asset === 'archive-floor') material.aoMapIntensity = .78;
    material.aoMap = surfaceMap;
    material.roughnessMap = surfaceMap;
    material.metalnessMap = surfaceMap;
    material.color.set(tint);
    material.roughness = roughness;
    material.needsUpdate = true;
    for (const texture of previous) texture?.dispose();
    visual.localTextures = visual.localTextures.filter(texture => !previous.has(texture));
    visual.localTextures.push(map, normalMap, surfaceMap);
    return { asset, loaded: true };
  }));
}
