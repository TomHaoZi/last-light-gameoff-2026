// Rest-space stains stay on the same skin, linen or teeth as the rig deforms.
// No screen tint, extra textures or gameplay dependence.
const MASKS = {
  worker: `
    vec3 p = vec3(woundSide*restWound.x, restWound.yz);
    float face = smoothstep(.065,.112,p.z);
    float drag = woundMark(vec2(p.x-(.057-(1.70-p.y)*.23),p.y),vec2(0.,1.650),vec2(.019,.062))*face;
    float lip = woundMark(vec2(p.x+.31*(p.y-1.60),p.y),vec2(.019,1.597),vec2(.052,.022))*face;
    float fingers = woundMark(vec2(abs(p.x),p.y),vec2(.521,1.123),vec2(.039,.084));
    float wound = max(max(drag*.95,lip),fingers*.69);`,
  wraps: `
    vec3 p = restWound;
    float front = smoothstep(.06,.13,p.z);
    float split = woundMark(vec2(p.x+.62*(p.y-1.65),p.y),vec2(-.035,1.646),vec2(.042,.068))*front;
    float wick = woundMark(vec2(p.x-.38*(p.y-1.64),p.y),vec2(.02,1.621),vec2(.081,.024))*front;
    float wound = max(split*.94,wick*.71);`,
  fabric: `
    vec3 p = restWound;
    float sleeve = woundMark(vec2(abs(p.x)+p.z*.09,p.y),vec2(.472,1.136),vec2(.082,.085));
    float collar = woundMark(vec2(p.x-.25*(p.y-1.48),p.y),vec2(.037,1.475),vec2(.083,.102))*smoothstep(.077,.15,p.z);
    float wound = max(collar*.86,sleeve*.67);`,
  hands: `
    vec3 p = restWound;
    float knuckles = woundMark(vec2(p.x+.34*(p.z+.12),p.z),vec2(-.011,-.128),vec2(.056,.04));
    float drag = woundMark(vec2(p.x+.28*p.z,p.z),vec2(-.031,-.048),vec2(.016,.047));
    float wound = max(knuckles*.85,drag*.74)*smoothstep(.025,.68,woundWet);`,
  teeth: `
    vec3 p = restWound;
    float gutter = smoothstep(.007,.026,abs(p.x));
    float wound = max(gutter*.68,woundMark(p.xy,vec2(-.01,1.598),vec2(.043,.017)));`
};
const DECLARATIONS = `
varying vec3 restWound;
uniform float woundWet;
uniform float woundSide;
float woundMark(vec2 p,vec2 centre,vec2 size) {
  vec2 d = (p-centre)/size;
  float rag = sin(p.y*378. + sin(p.x*109.)*1.8)*.11 + sin(p.x*514.+p.y*189.)*.085;
  return 1.-smoothstep(.31,.99,dot(d,d)+rag);
}`;

export function woundKind(name, nurse = false) {
  if (name === 'Teeth') return 'teeth';
  if (nurse && /layered face wraps|inner linen wrap|wrap seams/i.test(name)) return 'wraps';
  if (nurse && name === 'Laundered ivory twill') return 'fabric';
  if (name === 'Weathered skin' || (nurse && name === 'Mineral skin')) return 'worker';
  return null;
}

export function installWoundFinish(material, kind, side = 1) {
  if (!kind || !MASKS[kind]) return null;
  const wet = {value:0};
  const prior = material.onBeforeCompile;
  material.customProgramCacheKey = () => 'wound-finish-v1:'+kind;
  material.userData.woundFinish = kind;
  material.onBeforeCompile = function(shader, renderer) {
    prior.call(this, shader, renderer);
    shader.uniforms.woundWet = wet;
    shader.uniforms.woundSide = {value:side};
    shader.vertexShader = 'varying vec3 restWound;\n'+shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nrestWound=position;');
    shader.fragmentShader = DECLARATIONS+'\n'+shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      {
        ${MASKS[kind]}
        float grain = sin(p.y*461.+sin(p.x*211.)*1.7)*sin(p.x*339.+p.z*128.);
        float stain = clamp(wound+grain*min(wound,.2)*.95,0.,1.);
        float glazed = smoothstep(.38,.87,stain) * (.32+.68*woundWet);
        vec3 dryBlood = diffuseColor.rgb*.21 + vec3(.049,.006,.005);
        vec3 freshBlood = vec3(.21,.009,.013) * (.81 + .19*grain);
        diffuseColor.rgb = mix(diffuseColor.rgb,mix(dryBlood,freshBlood,glazed),smoothstep(.0,.53,stain)*.93);
        roughnessFactor = mix(roughnessFactor,${kind==='wraps'||kind==='fabric' ? '.43' : '.24'},glazed*.88);
      }
    `);
  };
  return wet;
}

const smooth = (x,a,b) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function faceDetails(time, seed, alarm, capture, reduced = false) {
  const t = Math.max(0,time)+seed;
  const swell = smooth(alarm,.2,.78);
  const hold = smooth(capture,.10,.62);
  const pulse = reduced ? 0 : Math.sin(t*7.3 + Math.sin(t*2.1));
  const split = reduced ? 0 : Math.max(0,Math.sin(t*13.7))**7;
  return {
    left: (1-hold)*(.25+.75*swell)*(.55+.45*pulse),
    right: (1-hold)*(.17+.83*swell)*(.62-.38*pulse),
    chatter: (1-hold)*split*(.018+.067*swell),
    grip: .14*swell + .78*hold + .07*split*swell,
    wet: Math.max(swell*.72,hold)
  };
}
