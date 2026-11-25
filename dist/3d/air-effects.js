import {
  BufferAttribute, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, ShaderMaterial, Vector3
} from 'three';

const capacity = 40;
const mouth = new Vector3();
const vertex = `
attribute vec3 origin;
attribute vec4 plume;
attribute vec3 ink;
varying vec2 point;
varying vec3 tint;
varying float opacity;
void main() {
  point = position.xy;
  float a = plume.z;
  vec2 corner = mat2(cos(a),sin(a),-sin(a),cos(a))*position.xy;
  vec4 center = modelViewMatrix * vec4(origin,1.);
  center.xy += corner * plume.xy;
  gl_Position = projectionMatrix * center;
  tint = ink;
  opacity = plume.w;
}`;
const fragment = `
varying vec2 point;
varying vec3 tint;
varying float opacity;
void main() {
  vec2 p = point;
  p.y += .16*sin(p.x*4.1 + .8);
  float core = dot(p,p) + .19*sin(6.*p.x-2.*p.y)*sin(p.y*4.+.2);
  float feather = 1.-smoothstep(.05,.94,core);
  gl_FragColor = vec4(tint, feather*feather*opacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function stream(geometry, name, size) {
  const field = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
  field.setUsage(DynamicDrawUsage);
  geometry.setAttribute(name, field);
  return field;
}

// All wisps share one draw. The simulation owns their source visibility.
export class AirEffects {
  constructor(stage) {
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]),3));
    geometry.setIndex([0,1,2,0,2,3]);
    this.centers = stream(geometry, 'origin', 3);
    this.shapes = stream(geometry, 'plume', 4);
    this.colors = stream(geometry, 'ink', 3);
    this.mesh = new Mesh(geometry, new ShaderMaterial({vertexShader:vertex, fragmentShader:fragment,
      transparent:true, depthWrite:false}));
    this.mesh.name = 'Breath and lift dust';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
    stage.add(this.mesh);
    this.slots = Array.from({ length: capacity }, () => ({ life: 0 }));
    this.cursor = 0;
    this.lastDoor = 0;
  }

  release(x, y, z, yaw, time, dust, seed, source = null) {
    const p = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % capacity;
    Object.assign(p, { x, y, z, yaw, time, dust, seed, source, life: dust ? .72 : .94 });
  }

  breathe(actor, distance, state, theme, reduced) {
    if (reduced || distance > 6 || state.mode !== 'playing' || (!state.night && theme !== 2)) return;
    const beat = state.time * (.62 + .23 * state.tension) + actor.seed;
    const cycle = Math.floor(beat);
    if (actor.lastExhale === cycle || beat-cycle > .23) return;
    actor.lastExhale = cycle;
    const yaw = actor.group.rotation.y;
    if (!actor.head) return;
    actor.head.getWorldPosition(mouth);
    const x = mouth.x + .115 * Math.sin(yaw);
    const z = mouth.z + .115 * Math.cos(yaw);
    for (let i = 0; i < 3; i++) {
      this.release(x, mouth.y + .075, z, yaw + .14 * Math.sin(actor.seed + i),
        state.time + i * .052, false, actor.seed + i, actor.group);
    }
  }

  captureDust(state, floor) {
    if (state.reduceMotion || !state.pursuer) return;
    const ghost = state.pursuer;
    const x = floor ? state.x : .62 * ghost.x + .38 * state.x;
    const z = floor ? state.z : .62 * ghost.z + .38 * state.z;
    const y = floor ? Math.max(.09, state.y + .09) : 1.42 + (ghost.y || 0);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const radius = floor ? .055 : .15;
      this.release(x + Math.sin(angle) * radius, y, z + Math.cos(angle) * radius,
        angle, state.time + i * .01, floor, i * 1.31);
    }
  }

  update(state, mount, reduced) {
    const changed = this.phase !== state.night;
    this.phase = state.night;
    const door = state.door || 0;
    if (mount && !reduced && door > .22 && door < .58 && door-this.lastDoor >= .049) {
      this.lastDoor = door;
      for (const side of [-1,1]) {
        mouth.set(side*(.22+door*.5),.082,-.14);
        mount.localToWorld(mouth);
        this.release(mouth.x,mouth.y,mouth.z,mount.rotation.y+Math.PI+side*.38,
          state.time,true,door*13+side);
      }
    }
    if (door === 0) this.lastDoor = 0;
    let count = 0;
    for (const p of this.slots) {
      if (changed || reduced || p.source?.visible === false) p.life = 0;
      if (!p.life) continue;
      const age = (state.time-p.time)/p.life;
      if (age < 0) continue;
      if (age >= 1) { p.life = 0; continue; }
      const growth = .032 + age * (p.dust ? .17 : .13);
      const drift = (p.dust ? .31 : .27) * age;
      this.centers.setXYZ(count,p.x+Math.sin(p.yaw)*drift,p.y+age*(p.dust ? .07 : .13),p.z+Math.cos(p.yaw)*drift);
      this.shapes.setXYZW(count,growth*1.42,growth,p.seed+.53*age,
        Math.sin(age*Math.PI)*(p.dust ? .21 : .17)*(1-.45*age));
      if (p.dust) this.colors.setXYZ(count,.50,.38,.25);
      else this.colors.setXYZ(count,.44,.55,.58);
      count++;
    }
    this.mesh.visible = count > 0;
    this.mesh.geometry.instanceCount = count;
    if (count) this.centers.needsUpdate = this.shapes.needsUpdate = this.colors.needsUpdate = true;
  }
}
