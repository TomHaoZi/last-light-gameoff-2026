import {
  DataTexture, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Vector2
} from 'three';

const TAU = Math.PI * 2;
const fract = number => number - Math.floor(number);
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;

function smooth(low, high, value) {
  const t = clamp((value - low) / (high - low));
  return t * t * (3 - 2 * t);
}

function tileField(width, height, seed) {
  const noise = new Float32Array(width * height);
  for (let i = 0; i < noise.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    noise[i] = seed / 4294967296;
  }

  return (u, v) => {
    const x = u * width;
    const y = v * height;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const nextX = (ix + 1) % width;
    const nextY = ((iy + 1) % height) * width;
    const row = iy * width;
    const sx = (x - ix) ** 2 * (3 - 2 * (x - ix));
    const sy = (y - iy) ** 2 * (3 - 2 * (y - iy));
    return mix(mix(noise[row + ix], noise[row + nextX], sx), mix(noise[nextY + ix], noise[nextY + nextX], sx), sy);
  };
}

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >>> 16, (value >>> 8) & 255, value & 255];
}

function colorBytes(buffer, index, substrate, coating, amount, variation) {
  const r = mix(substrate[0], coating[0], amount) * variation;
  const g = mix(substrate[1], coating[1], amount) * variation;
  const b = mix(substrate[2], coating[2], amount) * variation;
  buffer[index] = clamp(r, 0, 255);
  buffer[index + 1] = clamp(g, 0, 255);
  buffer[index + 2] = clamp(b, 0, 255);
  buffer[index + 3] = 255;
}

function surfaceTexture(data, size, anisotropy, isAlbedo = false) {
  const texture = new DataTexture(data, size, size);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = true;
  if (isAlbedo) texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function textureMaps(size, sample, anisotropy, relief) {
  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const packed = new Uint8Array(pixelCount * 4);
  const normals = new Uint8Array(pixelCount * 4);
  const height = new Float32Array(pixelCount);

  for (let y = 0; y < size; y++) {
    const v = (y + .5) / size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      height[i] = sample((x + .5) / size, v, i * 4, albedo, packed);
    }
  }

  // Derive tangent-space normals from a periodic height field rather than independent RGB noise.
  for (let y = 0; y < size; y++) {
    const previous = ((y + size - 1) % size) * size;
    const next = ((y + 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const row = y * size;
      const dx = (height[row + (x + size - 1) % size] - height[row + (x + 1) % size]) * relief;
      const dy = (height[previous + x] - height[next + x]) * relief;
      const inverse = 127.5 / Math.sqrt(1 + dx * dx + dy * dy);
      const index = (row + x) * 4;
      normals[index] = 127.5 + dx * inverse;
      normals[index + 1] = 127.5 + dy * inverse;
      normals[index + 2] = 127.5 + inverse;
      normals[index + 3] = 255;
    }
  }

  return {
    map: surfaceTexture(albedo, size, anisotropy, true),
    normalMap: surfaceTexture(normals, size, anisotropy),
    packed: surfaceTexture(packed, size, anisotropy)
  };
}

function physical(a, index, occlusion, roughness, metalness) {
  a[index] = clamp(occlusion) * 255;
  a[index + 1] = clamp(roughness) * 255;
  a[index + 2] = clamp(metalness) * 255;
  a[index + 3] = 255;
}

function sampleWall(theme, palette, noise) {
  const masonry = theme === 0;
  const office = theme === 1;
  const face = rgb(palette.wall);
  const joint = rgb(masonry ? '#51473e' : office ? '#655d52' : '#4b4c48');
  const scale = rgb(masonry ? '#755338' : office ? '#7b7263' : '#766858');
  const stain = rgb('#4c3932');
  const column = tileField(36, 3, 177216);
  const rustSources = masonry ? [.19, .81] : [.211, .651];
  const runoffHeight = masonry ? .73 : .84;

  return (u, v, i, albedo, packed) => {
    const { macro, stone, grain, pin, streak } = noise;
    const colour = macro(u, v);
    const pore = grain(u, v);
    const chip = stone(u, v);
    const fine = pin(u, v);
    const vertical = streak(u, v);
    const row = Math.floor(v * 4);
    const brickX = fract(u * 3 + (row % 2) * .5);
    const brickY = fract(v * 4);
    const horizontalJoint = Math.min(brickY, 1 - brickY);
    const verticalJoint = Math.min(brickX, 1 - brickX);
    const jointWidth = .012 + chip * .014;
    let fill = office
      ? smooth(.005, .014, Math.min(fract(u * 2), 1 - fract(u * 2)))
      : smooth(jointWidth, jointWidth + .019, Math.min(horizontalJoint, masonry ? verticalJoint : 1));
    if (office && colour > .33) fill = mix(fill, 1, .76);

    let runoff = 0;
    for (const x of rustSources) {
      const dx = Math.min(Math.abs(u - x), 1 - Math.abs(u - x));
      const fall = fract(runoffHeight - v);
      const width = (.011 + fall * .052) * (.56 + vertical * .86);
      const trace = (1 - smooth(.001, width, dx)) * (1 - smooth(.018, .65, fall));
      runoff = Math.max(runoff, trace * (vertical * .84 + .16));
    }
    const damp = smooth(.47, .81, column(u, v) * .67 + colour * .33) * (1 - smooth(.04, .47, v));
    const exfoliation = smooth(office ? .64 : .56, .90, colour * .4 + chip * .42 + pore * .18);
    const brightness = .89 + colour * .12 + chip * .12 + (fine - .5) * (office ? .05 : .092) - runoff * .10 - damp * .09;
    if (fill < .99) {
      colorBytes(albedo, i, joint, face, .19 + fill * .81, brightness);
    } else {
      const weather = runoff > exfoliation && !office;
      colorBytes(albedo, i, face, weather ? stain : scale, weather ? runoff * .74 : exfoliation * .74, brightness);
    }
    physical(packed, i, .72 + fill * .27 - damp * .08, (office ? .72 : .87) + pore * .10 - damp * .24 - runoff * .10, 0);
    return fill * .25 - exfoliation * .058 + chip * .12 + pore * (office ? .046 : .102) + fine * .025;
  };
}

function aggregateField(seed, cols, rows) {
  const cells = new Float32Array(cols * rows * 4);
  for (let i = 0; i < cells.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    cells[i] = seed / 4294967296;
  }
  return (u, v, irregularity) => {
    const x = u * cols;
    const y = v * rows;
    const xx = Math.floor(x), yy = Math.floor(y);
    const i = (yy * cols + xx) * 4;
    const dx = (x - xx - .25 - cells[i] * .5) * (1 + cells[i + 2] * .45);
    const dy = y - yy - .27 - cells[i + 1] * .46;
    const radius = .115 + cells[i + 2] * .10 + irregularity * .07;
    return (1 - smooth(radius * .70, radius, Math.hypot(dx, dy))) * (cells[i + 3] < .32 ? -.85 : .6 + cells[i + 3] * .4);
  };
}

function sampleFloor(theme, palette, noise) {
  const office = theme === 1;
  const roof = theme === 2;
  const face = rgb(palette.floor);
  const joint = rgb(roof ? '#303a3b' : '#382f25');
  const weather = rgb(roof ? '#808586' : office ? '#9b8470' : '#8d7c6b');
  const wet = rgb(roof ? '#505e65' : '#5b4c3f');
  const aggregate = aggregateField(37924 + theme * 5901, roof ? 78 : 104, roof ? 81 : 91);

  return (u, v, i, albedo, packed) => {
    const { macro, stone, grain, pin } = noise;
    const cloud = macro(u, v);
    const meso = stone(u, v);
    const fine = grain(u, v);
    const sharp = pin(u, v);
    const grains = aggregate(u, v, fine);
    const wear = smooth(.42, .87, cloud * .54 + meso * .30 + fine * .16);
    const edgeX = fract(u * (office ? 3 : 1));
    const edgeY = fract(v * (office ? 3 : 1));
    const edgeDist = Math.min(edgeX, 1 - edgeX, edgeY, 1 - edgeY);
    const seam = smooth(.0015 + fine * .003, .009 + fine * .005, edgeDist);
    const crackY = .51 + .06 * Math.sin(TAU * (u * 1.0 + .2)) + (meso - .5) * .04;
    const fracture = roof || office ? 0 : (1 - smooth(.0015, .0050, Math.abs(v - crackY))) * smooth(.58, .80, cloud + fine * .11);
    const patch = smooth(roof ? .57 : .62, .84, cloud * .68 + meso * .19 + fine * .13);
    const fill = seam * (1 - fracture * .35);
    const brightness = .92 + cloud * .081 + meso * .070 + (sharp - .5) * .067 + grains * (office ? .29 : roof ? .30 : .22);
    if (fill < .99) {
      colorBytes(albedo, i, joint, face, fill, brightness);
    } else {
      colorBytes(albedo, i, face, patch > wear * .7 ? wet : weather, patch > wear * .7 ? patch * .38 : wear * .30, brightness);
    }
    const roughness = (roof ? .91 : office ? .63 : .76) + fine * .117 - patch * (office ? .18 : .22);
    physical(packed, i, .73 + fill * .25 - patch * .03, mix(.91, roughness, fill), 0);
    return .215 * fill + meso * .065 + fine * .092 + grains * (roof ? .14 : office ? .032 : .062);
  };
}

function sampleCeiling(theme, palette, noise) {
  const face = rgb(palette.ceiling);
  const joint = rgb('#292825');
  const scale = rgb('#86765e');
  const office = theme === 1;

  return (u, v, i, albedo, packed) => {
    const cloud = noise.macro(u, v);
    const medium = noise.stone(u, v);
    const grain = noise.grain(u, v);
    const grainHigh = noise.pin(u, v);
    const x = fract(u * (office ? 3 : 2));
    const y = fract(v * (office ? 3 : 2));
    const distance = Math.min(x, y, 1 - x, 1 - y);
    const seam = smooth(.007, .022, distance);
    const drip = smooth(.57, .79, cloud * .51 + medium * .30 + grain * .19);
    const holes = smooth(.64, .89, grain * .65 + grainHigh * .35);
    const brightness = .91 + cloud * .13 + medium * .085 + grainHigh * .075 - drip * .095 - holes * (office ? .221 : .083);
    colorBytes(albedo, i, seam < .99 ? joint : face, seam < .99 ? face : scale, seam < .99 ? seam : drip * .34, brightness);
    physical(packed, i, .78 + seam * .21 - drip * .06, .85 + grain * .10, 0);
    return seam * .25 + medium * .064 + grainHigh * .04 - holes * (office ? .068 : .035);
  };
}

function sampleMetal(palette, noise, coated) {
  const face = rgb(coated ? palette.accent : palette.steel);
  const oxide = rgb(coated ? '#62321d' : '#6f4d36');
  const substrate = rgb('#8a908c');
  const scratch = tileField(9, 83, 35279 + (coated ? 911 : 0));

  return (u, v, i, albedo, packed) => {
    const cloud = noise.macro(u, v);
    const meso = noise.stone(u, v);
    const fine = noise.grain(u, v);
    const sharp = noise.pin(u, v);
    const vertical = noise.streak(u, v);
    const scored = scratch(u, v);
    const scratchMask = smooth(.77, .93, scored) * (.4 + sharp * .6);
    const abrasion = smooth(.59, .84, cloud * .46 + meso * .32 + fine * .22) + scratchMask * .51;
    const corrosion = smooth(.52, .84, cloud * .31 + meso * .24 + vertical * .45);
    const coating = corrosion > abrasion * .58 ? oxide : substrate;
    const wear = Math.max(0, corrosion > abrasion * .58 ? corrosion * .83 : abrasion * .74);
    const zinc = coated ? 0 : (meso - .5) * .16;
    const brightness = .90 + cloud * .18 + zinc + fine * .09 + (sharp - .5) * .09 + scratchMask * .30;
    colorBytes(albedo, i, face, coating, wear, brightness);
    const roughness = (coated ? .56 : .51) + meso * .13 + corrosion * .32 - abrasion * .12;
    const metalness = (coated ? .05 : .62) + abrasion * .32 - corrosion * .46;
    physical(packed, i, .98 - corrosion * .10, roughness, metalness);
    return .34 + fine * .07 + sharp * .053 + corrosion * .17 - scratchMask * .14 - abrasion * .035;
  };
}

/** All textures are generated from repeatable height and weathering fields at chapter load. */
export function createSurfaceSet(themeIndex, palette, anisotropy = 4) {
  const seed = 480931 + themeIndex * 100003;
  const noise = {
    macro: tileField(5, 7, seed),
    stone: tileField(22, 18, seed + 3131),
    grain: tileField(149, 137, seed + 7883),
    pin: tileField(302, 269, seed + 15371),
    streak: tileField(69, 8, seed + 18617)
  };
  const result = { textures: [] };
  const profiles = [
    ['wall', 512, sampleWall(themeIndex, palette, noise), 5.1, 1.0],
    ['floor', 512, sampleFloor(themeIndex, palette, noise), 5.6, .90],
    ['ceiling', 256, sampleCeiling(themeIndex, palette, noise), 3.9, .72],
    ['steel', 256, sampleMetal(palette, noise, false), 3.1, .77],
    ['accent', 256, sampleMetal(palette, noise, true), 3.7, .84]
  ];
  for (const [name, size, sample, relief, strength] of profiles) {
    const { map, normalMap, packed } = textureMaps(size, sample, anisotropy, relief);
    result.textures.push(map, normalMap, packed);
    result[name] = {
      color: 0xffffff, map, normalMap, normalScale: new Vector2(strength, strength),
      roughnessMap: packed, roughness: 1, metalnessMap: packed, metalness: 1,
      aoMap: packed, aoMapIntensity: .8
    };
  }
  return result;
}

const WORLD_WEATHER = `
vec2 weatherHash(vec2 point) {
  vec3 partial = fract(point.xyx * vec3(.1031, .11369, .13787));
  partial += dot(partial, partial.yzx + 19.19);
  return fract((partial.xx + partial.yz) * partial.zy);
}

float weatherNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);
  vec2 blend = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(
    mix(weatherHash(cell).x, weatherHash(cell + vec2(1.0, 0.0)).x, blend.x),
    mix(weatherHash(cell + vec2(0.0, 1.0)).x, weatherHash(cell + vec2(1.0, 1.0)).x, blend.x),
    blend.y
  );
}
`;

const FLOOR_WEATHER = `
  vec2 worldFloor = vWeatherPosition.xz;
  float area = weatherNoise(worldFloor * vec2(.15, .21) + weatherSeed);
  float smaller = weatherNoise(worldFloor * vec2(.46, .37) + vec2(area * .72, .33));
  float marking = area * .66 + smaller * .34;
  vec2 panel = abs(fract(worldFloor / 2.4 + .5) - .5);
  float nearJoint = 1.0 - smoothstep(.004, .057, min(panel.x, panel.y));
  float wet = smoothstep(.54, .79, marking + nearJoint * .07);
  float dust = smoothstep(.55, .91, 1.0 - area + smaller * .12) * (1.0 - wet);
  diffuseColor.rgb *= (.87 + .23 * area) * mix(vec3(1.0), vec3(.61, .65, .69), wet);
  diffuseColor.rgb *= mix(vec3(1.0), weatherDust, dust);
  diffuseColor.rgb *= 1.0 - nearJoint * smaller * .13;
`;

const WALL_WEATHER = `
  vec2 worldWall = vec2(dot(vWeatherPosition.xz, vec2(.83, .56)), vWeatherPosition.y);
  float area = weatherNoise(worldWall * vec2(.24, .49) + weatherSeed);
  float smaller = weatherNoise(worldWall * vec2(.83, 1.15) + vec2(area * .76, .58));
  float ground = 1.0 - smoothstep(.20, 1.45, vWeatherPosition.y);
  float wet = smoothstep(.48, .83, area * .63 + smaller * .29 + ground * .25);
  float dust = smoothstep(.45, .93, (1.0 - area) * .8 + smaller * .28) * (1.0 - wet);
  diffuseColor.rgb *= (.92 + area * .18) * mix(vec3(1.0), vec3(.67, .59, .48), wet);
  diffuseColor.rgb *= mix(vec3(1.0), weatherDust, dust * .49);
`;

const CEILING_WEATHER = `
  vec2 worldCeiling = vWeatherPosition.xz;
  float area = weatherNoise(worldCeiling * vec2(.17, .24) + weatherSeed);
  float smaller = weatherNoise(worldCeiling * vec2(.45, .67) + vec2(area * .84, .0));
  float wet = smoothstep(.56, .83, area * .67 + smaller * .33);
  diffuseColor.rgb *= (.91 + area * .15) * mix(vec3(1.0), vec3(.69, .61, .53), wet);
`;

/** Give continuous surfaces large wear patterns that cross the repeated tile meshes. */
export function applyWorldWeather(material, role, themeIndex) {
  const pattern = { floor: FLOOR_WEATHER, wall: WALL_WEATHER, ceiling: CEILING_WEATHER }[role];
  if (!pattern) return material;

  const roof = themeIndex === 2;
  const dust = roof ? 'vec3(1.10, 1.12, 1.12)' : 'vec3(1.13, 1.085, 1.024)';
  const seed = (2.74 + themeIndex * 7.1).toFixed(2);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>', '#include <common>\nvarying vec3 vWeatherPosition;'
    ).replace('#include <project_vertex>', `
      #include <project_vertex>
      vec4 weatherPosition = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        weatherPosition = batchingMatrix * weatherPosition;
      #endif
      #ifdef USE_INSTANCING
        weatherPosition = instanceMatrix * weatherPosition;
      #endif
      vWeatherPosition = (modelMatrix * weatherPosition).xyz;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 vWeatherPosition;
      const vec2 weatherSeed = vec2(${seed}, 4.29);
      const vec3 weatherDust = ${dust};
      ${WORLD_WEATHER}
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      ${pattern}
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor *= 1.0 - wet * ${role === 'floor' ? '.33' : '.17'};
    `);
  };
  material.customProgramCacheKey = () => `weather:${role}:${themeIndex}`;
  return material;
}
