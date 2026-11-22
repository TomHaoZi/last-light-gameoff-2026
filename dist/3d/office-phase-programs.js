import { BackSide, DoubleSide, FrontSide, MeshDepthMaterial, Scene } from 'three';
import { waitForRenderIdle } from './render-idle.js';

const shadowSide = [BackSide, FrontSide, DoubleSide];

function depthMaterial(source) {
  // The normal PCF depth pass uses these flags from the visible material.
  return new MeshDepthMaterial({
    side: source.shadowSide ?? shadowSide[source.side],
    map: source.map,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaToCoverage ? .5 : source.alphaTest,
    displacementMap: source.displacementMap,
    displacementScale: source.displacementScale,
    displacementBias: source.displacementBias
  });
}

export function makeOfficeProgramWarmup(renderer, stage, rig, shadow, isCurrent) {
  const shadowScene = new Scene();
  // Borrow the light list for linking only. This scene is never rendered.
  shadowScene.children.push(rig);
  const reflected = new Set();
  const shadowVariants = new Map();
  stage.addEventListener('removed', () => {
    for (const material of shadowVariants.values()) material.dispose();
    shadowVariants.clear();
  });

  async function reflect(materials) {
    const programs = new Set();
    for (const material of materials) {
      const variants = renderer.properties.get(material).programs;
      if (variants) for (const program of variants.values()) programs.add(program);
    }
    // compileAsync links the shaders, but Three does uniform and attribute
    // reflection lazily. Give each unreflected program its own idle slot.
    for (const program of programs) {
      if (reflected.has(program)) continue;
      await waitForRenderIdle();
      if (!isCurrent()) return;
      if (!program.isReady()) continue;
      program.getUniforms();
      reflected.add(program);
    }
  }

  return async target => {
    const materials = new Set();
    const casters = [];
    target.traverse(object => {
      for (const source of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!source) continue;
        materials.add(source);
        if (object.isMesh && object.castShadow && !object.customDepthMaterial) casters.push([object, source]);
      }
    });
    await reflect(materials);

    for (const [object, source] of casters) {
      if (!isCurrent() || !shadow.map) return;
      const { attributes, morphAttributes } = object.geometry;
      const variant = [
        source.id,
        Boolean(object.isInstancedMesh), Boolean(object.instanceColor), Boolean(object.isSkinnedMesh),
        Boolean(attributes.normal), Boolean(attributes.tangent), attributes.color?.itemSize ?? 0,
        morphAttributes.position?.length ?? 0, morphAttributes.normal?.length ?? 0,
        morphAttributes.color?.length ?? 0
      ].join('/');
      if (shadowVariants.has(variant)) continue;
      await waitForRenderIdle();
      if (!isCurrent() || !shadow.map) return;

      const material = depthMaterial(source);
      shadowVariants.set(variant, material);
      const proxy = Object.create(object);
      proxy.children = [];
      proxy.material = material;
      const previous = renderer.getRenderTarget();
      let linked;
      try {
        renderer.setRenderTarget(shadow.map);
        linked = renderer.compileAsync(proxy, shadow.camera, shadowScene);
      } finally {
        renderer.setRenderTarget(previous);
      }
      await linked;
      await reflect([material]);
    }
  };
}
