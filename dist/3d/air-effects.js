import {
  BufferAttribute, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
  Mesh, ShaderMaterial, Vector3
} from 'three';

const capacity = 40;
const mouth = new Vector3();
const vertex = `
attribute vec3 origin;
attribute vec4 plume;
attribute vec4 ink;
varying vec2 point;
varying vec4 tint;
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
varying vec4 tint;
varying float opacity;
void main() {
  vec2 p = point;
  p.y += .16*sin(p.x*4.1 + .8);
  float core = dot(p,p) + .19*sin(6.*p.x-2.*p.y)*sin(p.y*4.+.2);
  float feather = 1.-smoothstep(.05,.94,core);
  float bead = 1.-smoothstep(.20,.91,dot(point,point));
  float glint = (1.-smoothstep(.0,.31,length(point-vec2(-.11,.29)))) * tint.w;
  gl_FragColor = vec4(tint.xyz + glint*.29, mix(feather*feather,bead,tint.w)*opacity);
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
    this.colors = stream(geometry, 'ink', 4);
    this.mesh = new Mesh(geometry, new ShaderMaterial({vertexShader:vertex, fragmentShader:fragment,
      transparent:true, depthWrite:false}));
    this.mesh.name = 'Vent steam, runoff, breath, lift dust and contact droplets';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
    stage.add(this.mesh);
    this.slots = Array.from({ length: capacity }, () => ({ life: 0 }));
    this.cursor = 0;
    this.lastDoor = 0;
  }

  release(x, y, z, yaw, time, dust, seed, source = null, motion = '', force = 1) {
    const p = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % capacity;
    const life = motion === 'blood' ? .39 + .11*force : motion === 'water' ? .49 : dust ? .72 : .94;
    Object.assign(p, { x, y, z, yaw, time, dust, seed, source, motion, force, life });
  }

  roofImpact(state, { x, z, banished }) {
    if (state.reduceMotion || state.reducedMotion || state.reducedEffects) return;
    this.contactBlood(state,{x,z},banished ? 6 : 4,1.39);
    const count = banished ? 9 : 4;
    for (let i = 0; i < count; i++) {
      const yaw = i * 2.399 + state.time * 1.8;
      this.release(x + .18*Math.sin(yaw), .74 + .09*i, z + .18*Math.cos(yaw), yaw,
        state.time + i*.013, true, i + state.time, null, '', banished ? 1 : .73);
    }
  }

  contactBlood(state, ghost, count = 8, height = 1.49) {
    if (!ghost || state.reduceMotion || state.reducedMotion || state.reducedEffects) return;
    const facing = Math.atan2(state.x-ghost.x,state.z-ghost.z);
    for(let i=0;i<count;i++) {
      const seed=(i+.7)*2.399;
      const yaw=facing+.86*Math.sin(seed);
      const force=.32+.62*(.5+.5*Math.cos(seed));
      const offset=.065+.04*Math.sin(seed);
      this.release(ghost.x+Math.sin(yaw)*offset,height+(ghost.y||0)+.10*Math.cos(seed*1.8),
        ghost.z+Math.cos(yaw)*offset,yaw,state.time+i*.008,false,seed,null,'blood',force);
    }
  }

  discharge(record, state, motion, force) {
    if (force < .045) return;
    const { x, y, z, yaw, source } = record.outlet;
    if ((x - state.x) ** 2 + (z - state.z) ** 2 > 58) return;
    const water = motion === 'water';
    const interval = water ? .095 : .152;
    if (state.time - (record.lastDischarge ?? -Infinity) < interval) return;
    record.lastDischarge = state.time;
    for (let i = 0; i < (water ? 4 : 3); i++) {
      const seed = i * 2.27 + state.time * 1.93;
      const span = (i - 1.3) * (water ? .047 : .19);
      this.release(x + Math.cos(yaw) * span, y, z - Math.sin(yaw) * span,
        yaw + .31 * Math.sin(seed), state.time + i * .024, false, seed, source, motion, force);
    }
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
    if (mount && !reduced && door > .22 && (door < .58 || (door > .86 && this.lastDoor < .86)) &&
        door - this.lastDoor >= .049) {
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
      const steam = p.motion === 'steam';
      const water = p.motion === 'water';
      const blood = p.motion === 'blood';
      const growth = steam ? .053 + age * .215 * p.force : .032 + age * (p.dust ? .17 : .13);
      const drift = blood ? age*(.24 + p.force*.71) : steam ? age * .35 * p.force : (water ? .26 : p.dust ? .31 : .27) * age;
      const rise = blood ? age*(.26*p.force-.91*age) : steam ? (.19 + p.force * .69) * age * (2 - age) :
        water ? .091 * age - 1.04 * age * age : age * (p.dust ? .07 : .13);
      if ((water || blood) && p.y + rise <= .08) { p.life = 0; continue; }
      this.centers.setXYZ(count,p.x+Math.sin(p.yaw)*drift,p.y+rise,p.z+Math.cos(p.yaw)*drift);
      const alpha = Math.sin(age*Math.PI) * (1 - .45*age);
      if (blood) {
        this.shapes.setXYZW(count,.011+.017*p.force,.018+.041*p.force,p.yaw*.53+age*.43,
          .91*(1-age*age)*Math.min(1,age*31));
        this.colors.setXYZW(count,.168+.095*p.force,.005,.011,.42);
      } else if (water) {
        this.shapes.setXYZW(count, .013, .03 + .052 * age, -.12, .67 * alpha * p.force);
        this.colors.setXYZW(count, .52, .72, .75, 1);
      } else {
        this.shapes.setXYZW(count, growth * 1.42, growth, p.seed + .53 * age,
          alpha * (steam ? .37 * p.force : p.dust ? .21 : .17));
        if (p.dust) this.colors.setXYZW(count,.50,.38,.25,0);
        else if (steam) this.colors.setXYZW(count,.64,.70,.69,0);
        else this.colors.setXYZW(count,.44,.55,.58,0);
      }
      count++;
    }
    this.mesh.visible = count > 0;
    this.mesh.geometry.instanceCount = count;
    if (count) this.centers.needsUpdate = this.shapes.needsUpdate = this.colors.needsUpdate = true;
  }
}
