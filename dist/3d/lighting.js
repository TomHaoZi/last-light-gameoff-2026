import * as THREE from 'three';

// Radiance field painted directly in linear light. Rectangular emitters appear
// as broad soft reflections on worn metal and elongated catches on polished parts.
export function makeReflectionProbe(outdoors) {
  const width = 128;
  const height = 64;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI * ((y + .5) / height - .5);
    const horizon = Math.exp(-12 * latitude ** 2);
    for (let x = 0; x < width; x++) {
      const azimuth = (x + .5) / width * 2 * Math.PI;
      const sunset = Math.exp(-5 * (1 - Math.cos(azimuth - .73)));
      const overhang = Math.max(0, Math.sin(latitude));
      const panels = (.5 + .5 * Math.cos(azimuth * 2 - 1.9)) ** 9
        * Math.exp(-40 * (latitude - .64) ** 2);
      const sidelights = (.5 + .5 * Math.cos(azimuth - 2.4)) ** 28
        * Math.exp(-10 * (latitude - .22) ** 2);
      const i = (y * width + x) * 4;
      if (outdoors) {
        pixels[i] = .09 + .38 * overhang + horizon * (.11 + sunset * .93);
        pixels[i + 1] = .11 + .58 * overhang + horizon * (.13 + sunset * .39);
        pixels[i + 2] = .14 + .93 * overhang + horizon * (.18 + sunset * .12);
      } else {
        pixels[i] = .08 + panels * 2.20 + sidelights * .55;
        pixels[i + 1] = .09 + panels * 1.88 + sidelights * .63;
        pixels[i + 2] = .10 + panels * 1.50 + sidelights * .71;
      }
      pixels[i + 3] = 1;
    }
  }
  const probe = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  probe.colorSpace = THREE.LinearSRGBColorSpace;
  probe.mapping = THREE.EquirectangularReflectionMapping;
  probe.minFilter = probe.magFilter = THREE.LinearFilter;
  probe.needsUpdate = true;
  return probe;
}

const SHAFT_VERTEX = /* glsl */ `
  varying vec2 coords;
  void main() {
    coords = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

const SHAFT_FRAGMENT = /* glsl */ `
  uniform sampler2D sceneDepth;
  uniform mat4 inverseProjection;
  uniform mat4 cameraToWorld;
  uniform vec4 bulbs[3];
  uniform vec3 tints[3];
  uniform float time;
  uniform float outdoors;
  varying vec2 coords;

  void main() {
    float depth = texture2D(sceneDepth, coords).r;
    vec4 surface = inverseProjection * vec4(coords * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec3 view = surface.xyz / surface.w;
    float lengthToSurface = min(length(view), 20.0);
    vec3 direction = mat3(cameraToWorld) * normalize(view);
    vec3 origin = cameraToWorld[3].xyz;
    float stride = lengthToSurface / 9.0;
    vec3 scatter = vec3(0.0);

    for (int stepIndex = 0; stepIndex < 9; stepIndex++) {
      float distanceAlongRay = (float(stepIndex) + .5) * stride;
      vec3 samplePoint = origin + direction * distanceAlongRay;
      float turbulence = .80 + .20 * sin(dot(samplePoint, vec3(1.3, .8, -1.1)) + time * .66);
      for (int source = 0; source < 3; source++) {
        vec3 delta = samplePoint - bulbs[source].xyz;
        float drop = -delta.y;
        float down = smoothstep(-.08, .27, drop) * (1.0 - smoothstep(1.9, 3.4, drop));
        float width = .18 + max(drop, 0.0) * .52;
        float crossSection = dot(delta.xz, delta.xz) / (width * width);
        float shaft = exp(-crossSection * 2.1) * down / (1.0 + drop * drop * .8);
        scatter += tints[source] * bulbs[source].w * shaft * turbulence;
      }
    }
    // The roof wind disperses mist. Interior fittings read through denser air.
    gl_FragColor = vec4(scatter * stride * mix(.054, .018, outdoors), 1.0);
  }
`;

export function makeAtmosphere() {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const uniforms = {
    sceneDepth: { value: null },
    inverseProjection: { value: new THREE.Matrix4() },
    cameraToWorld: { value: new THREE.Matrix4() },
    bulbs: { value: Array.from({ length: 3 }, () => new THREE.Vector4()) },
    tints: { value: Array.from({ length: 3 }, () => new THREE.Color()) },
    time: { value: 0 },
    outdoors: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SHAFT_VERTEX,
    fragmentShader: SHAFT_FRAGMENT,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plane.frustumCulled = false;
  scene.add(plane);
  return { scene, camera, target, uniforms };
}
