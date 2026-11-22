import { Texture, TextureSource, Vector2 } from 'three';
import { waitForRenderIdle } from './render-idle.js';

const STRIP_HEIGHT = 128;
const TEXTURE_FIELDS = ['map', 'normalMap'];
const rendererPreparations = new WeakMap();

function uploaded(renderer, texture) {
  return renderer.properties.has(texture) && !!renderer.properties.get(texture).__webglTexture;
}

function officeTextures(template) {
  const textures = new Set();
  template.traverse(object => {
    if (!object.isMesh) return;
    for (let node = object; node; node = node.parent) {
      if (node.name.startsWith('uniform_') && node.name !== 'uniform_office') return;
    }
    for (const field of TEXTURE_FIELDS) {
      const texture = object.material[field];
      if (texture?.image instanceof ImageBitmap && !texture.mipmaps.length) textures.add(texture);
    }
  });
  return [...textures].sort((a, b) => b.image.width * b.image.height - a.image.width * a.image.height);
}

async function uploadTexture(renderer, original, canContinue) {
  if (!canContinue()) return null;
  const image = original.image;
  let warmed;
  let committed = false;

  try {
    for (let y = 0; y < image.height; y += STRIP_HEIGHT) {
      if (!canContinue()) return null;
      const height = Math.min(STRIP_HEIGHT, image.height - y);
      const bitmap = await createImageBitmap(image, 0, y, image.width, height, {
        colorSpaceConversion: 'none', premultiplyAlpha: 'none'
      });
      try {
        await waitForRenderIdle();
        if (!canContinue()) return null;
        if (!warmed) {
          warmed = original.clone();
          // Keep the full source for normal re-upload after context restoration.
          // Allocate a separate target so an early encounter uses the original.
          warmed.source = new TextureSource(image);
          warmed.source.dataReady = false;
          warmed.needsUpdate = true;
          const autoMips = warmed.mipmapsAutoUpdate;
          warmed.mipmapsAutoUpdate = false;
          try {
            renderer.initTexture(warmed);
          } finally {
            warmed.source.dataReady = true;
            warmed.mipmapsAutoUpdate = autoMips;
          }
        }
        const autoMips = warmed.mipmapsAutoUpdate;
        warmed.mipmapsAutoUpdate = autoMips && y + height === image.height;
        try {
          renderer.copyTextureToTexture(new Texture(bitmap), warmed, null, new Vector2(0, y));
        } finally {
          warmed.mipmapsAutoUpdate = autoMips;
        }
      } finally {
        bitmap.close();
      }
    }
    committed = true;
    return warmed;
  } finally {
    if (!committed) warmed?.dispose();
  }
}

export function prepareOfficeTextures(renderer, template) {
  if (typeof createImageBitmap !== 'function' || typeof ImageBitmap === 'undefined' ||
      typeof requestIdleCallback !== 'function' || rendererPreparations.has(renderer)) return;

  const preparation = { textures: new Map(), version: 0 };
  rendererPreparations.set(renderer, preparation);
  const context = renderer.getContext();
  let contextLost = false;
  const stop = () => { contextLost = true; };
  renderer.domElement.addEventListener('webglcontextlost', stop, { once: true });
  const upload = async () => {
    try {
      for (const texture of officeTextures(template)) {
        if (contextLost) break;
        const canContinue = () => !contextLost && !context.isContextLost() && !uploaded(renderer, texture);
        const warmed = await uploadTexture(renderer, texture, canContinue);
        if (warmed) {
          preparation.textures.set(texture, warmed);
          preparation.version++;
        }
      }
    } catch {
      // The authored texture remains available if staging is unsupported.
    } finally {
      renderer.domElement.removeEventListener('webglcontextlost', stop);
    }
  };
  void upload();
}

export function applyPreparedCreatureTextures(actor) {
  const { renderer } = actor;
  const prepared = rendererPreparations.get(renderer);
  if (!prepared?.version || actor.officeTextureVersion === prepared.version) return;
  actor.officeTextureVersion = prepared.version;

  actor.body.group.traverse(object => {
    if (!object.isMesh) return;
    for (const field of TEXTURE_FIELDS) {
      const original = object.material[field];
      const warmed = prepared.textures.get(original);
      if (warmed && !uploaded(renderer, original)) object.material[field] = warmed;
    }
  });
}
