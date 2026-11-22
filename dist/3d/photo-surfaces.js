import {
  TextureLoader, RepeatWrapping, SRGBColorSpace, Vector2
} from 'three';

const FLOOR = ['boiler', 'office', 'roof'];

export async function mountPhotoSurfaces(visual) {
  const stage = visual.stage;
  const loader = new TextureLoader();
  const anisotropy = Math.min(8, visual.renderer.capabilities.getMaxAnisotropy());
  const targets = [{ material: visual.materials.floor, asset: FLOOR[visual.theme] }];
  if (visual.theme === 0) targets.push({ material: visual.materials.wall, asset: 'block' });

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
    material.map = map;
    material.normalMap = normalMap;
    material.normalScale = new Vector2(.67, .67);
    material.aoMap = surfaceMap;
    material.roughnessMap = surfaceMap;
    material.metalnessMap = surfaceMap;
    material.color.set(asset === 'roof' ? '#e4e3dc' : asset === 'block' ? '#acb9b7' : '#e3ded0');
    material.roughness = 1;
    material.needsUpdate = true;
    for (const texture of previous) texture?.dispose();
    visual.localTextures = visual.localTextures.filter(texture => !previous.has(texture));
    visual.localTextures.push(map, normalMap, surfaceMap);
    return { asset, loaded: true };
  }));
}
