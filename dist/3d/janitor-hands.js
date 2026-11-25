import { Group, MathUtils, ShaderChunk } from 'three';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';

const asset = new URL('./assets/janitor/janitor.glb', import.meta.url).href;
const { damp, smoothstep } = MathUtils;

// The player sees a hand at an apparent half-metre. Compress the entire rig
// toward the eye together to keep fingertips on the player's side of a wall.
const depthScale = .37;
const minuteArc = 2 * Math.PI / 60;

// Compress only the projected depth. Lighting and the normal map still see
// the actual distance to every lamp, including the eye-mounted flashlight.
// The headlamp is eleven centimetres below the eye. Its real housing cuts
// off the rear/near spill onto the wrist; the room still lights the skin.
const armLights = ShaderChunk.lights_fragment_begin
  .replace('getPointLightInfo( pointLight, geometryPosition, directLight );',
    '$& if (dot(pointLight.position,pointLight.position) < 0.04) directLight.color *= 0.06;')
  .replace('getSpotLightInfo( spotLight, geometryPosition, directLight );',
    '$& if (dot(spotLight.position,spotLight.position) < 0.04) directLight.color *= 0.012;');

function nearWallProjection(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', armLights);
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
    `#include <project_vertex>
     gl_Position.z += projectionMatrix[3][2] * ${(1/depthScale - 1).toFixed(8)};`);
}

export class JanitorHands {
  constructor(camera) {
    this.camera = camera;
    this.group = new Group();
    this.group.name = 'Janitor first-person hand';
    this.group.visible = false;
    this.counterHand = new Group();
    this.counterHand.name = 'Janitor free hand';
    this.counterHand.visible = false;

    camera.add(this.group, this.counterHand);
    this.fingers = [];
    this.counterFingers = [];
    this.action = 0;
    this.grip = 0;
    this.brace = 0;
    this.air = 0;
    this.roll = 0;
    this.shiftPose = 0;
    this.ready = new GLTFLoader().loadAsync(asset).then(({ scene }) => {
      scene.traverse(object => {
        if (!object.isMesh) return;
        if (object.name === 'JanitorMinute') this.minute = object;
        if (object.morphTargetDictionary?.Operate != null) this.fingers.push(object);
        object.material.onBeforeCompile = nearWallProjection;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      this.group.add(scene);
      const opposite = scene.clone();
      const watch = [];
      opposite.traverse(object => {
        const name = object.userData.name ?? object.name;
        if (name === 'JanitorMinute' || name.includes('watch dial') || name.includes('nickel case')) watch.push(object);
        if (object.morphTargetDictionary?.Operate != null) this.counterFingers.push(object);
      });
      for (const part of watch) part.removeFromParent();
      opposite.scale.x = -1;
      this.counterHand.add(opposite);
      return scene;
    }).catch(error => {
      console.warn('Could not load the janitor hand.', error);
      return null;
    });
  }

  operate() {
    this.action = .63;
  }

  update(state, dt, walk = 0, velocity = 0, capture = null) {
    const group = this.group;
    group.visible = state.mode === 'playing' || state.mode === 'paused';
    this.counterHand.visible = false;
    if (!group.visible) {
      this.action = 0;
      return;
    }
    const reduced = Boolean(state.reduceMotion || state.reducedMotion || state.reducedEffects);
    const time = state.time || 0;
    const active = this.action > 0;
    this.action = Math.max(0, this.action - dt);
    const cycle = 1 - this.action / .63;
    const reach = active ? smoothstep(cycle, 0, .34) * (1 - smoothstep(cycle, .61, 1)) : 0;
    const contact = smoothstep(cycle, .24, .52) * (1 - smoothstep(cycle, .65, .96));
    const phaseFlash = state.shiftFx || 0;
    this.shiftPose = damp(this.shiftPose, phaseFlash, phaseFlash > this.shiftPose ? 24 : 12, dt);
    const shift = this.shiftPose;
    const caught = state.life === 'dying' && state.deathCause === 'ghost';
    const fallen = state.life === 'dying' && !caught && !capture;
    const protect = caught ? smoothstep(state.lifeTimer, 0, .14) * (1 - smoothstep(state.lifeTimer, .50, 1.02)) : 0;
    this.air = damp(this.air, state.grounded === false && !fallen ? 1 : 0, 8, dt);
    this.grip = damp(this.grip, Math.min(1, .27 + contact*.59 + shift*.25 + (state.sprint ? .26 : 0)), 12, dt);
    this.brace = damp(this.brace, Math.min(1, this.air*.65 + protect + reach*(1-contact)*.28), 15, dt);
    const sway = reduced ? 0 : Math.min(1, velocity / 4);
    const breath = reduced ? 0 : Math.sin(time * 1.54);
    this.roll = damp(this.roll, state.night ? 1 : 0, 13, dt);
    // Screen-edge placement scales down on tall/narrow mobile viewports.
    const side = Math.min(1, this.camera.aspect / 1.4);
    const lift = reduced ? .38 : 1;
    const running = state.chase?.started && state.sprint && state.life === 'alive' && !reduced;
    const pump = running ? Math.sin(walk * .65) * sway : 0;
    const swing = running ? Math.cos(walk * .65) * sway : 0;
    const drop = fallen ? smoothstep(state.lifeTimer, .18, .86) * .21 : 0;
    group.position.set(
      .223*side - reach*.055 - protect*.087 - swing*.014 + Math.sin(walk*.53)*sway*.006,
      -.230 - drop + pump*.016 + (breath*.002 + this.air*.022 + shift*.065 + reach*.106 + protect*.127)*lift +
        Math.sin(walk)*sway*.005,
      -.423 - reach*.062 + protect*.058 - swing*.024 + Math.cos(walk)*sway*.003
    );
    group.rotation.set(
      .38 + pump*.07 + (shift*.27 + reach*.20 + protect*.48 - this.air*.09)*lift,
      .40 + (reach*.09 + protect*.16)*lift,
      -.04 - this.roll*.15 - (shift*.32 - reach*.22 - protect*.45)*lift
    );
    for (const mesh of this.fingers) {
      const { Operate, Brace } = mesh.morphTargetDictionary;
      mesh.morphTargetInfluences[Operate] = this.grip * (1 - this.brace);
      mesh.morphTargetInfluences[Brace] = this.brace;
    }
    if (capture) this.defend(capture, side, lift);
    if (this.minute) this.minute.rotation.y = -this.roll*minuteArc;
  }

  defend(capture, side, lift) {
    const { brace, resistance = 0, drop = 0, impulse = 0 } = capture;
    const recovery = capture.beat === 'revival' ? 1 - capture.rise : 0;
    const action = Math.max(brace, .53 * recovery, .30 * drop);
    if (action <= .004) return;
    const pressure = lift * action;
    const turn = capture.side * resistance;
    this.group.position.set(.223 * side - .11 * pressure - .041 * turn, -.23 + .17 * pressure
      - (.17 * drop + .09 * recovery) * lift, -.423 - .16 * pressure + .059 * impulse);
    this.group.rotation.set(.38 + .69 * pressure - .37 * drop, .40 - .80 * pressure + .22 * turn,
      -.04 + .48 * pressure + .17 * drop);
    this.counterHand.visible = action > .04;
    this.counterHand.position.set(-.26 * side + .14 * pressure + .026 * turn, -.38 + .27 * pressure
      - (.12 * drop + .072 * recovery) * lift, -.39 - .20 * pressure + .05 * impulse);
    this.counterHand.rotation.set(.56 + .56 * pressure - .32 * drop, -.40 + .71 * pressure,
      -.02 - .52 * pressure - .18 * drop);
    for (const mesh of [...this.fingers, ...this.counterFingers]) {
      const { Operate, Brace } = mesh.morphTargetDictionary;
      mesh.morphTargetInfluences[Operate] = .42 * resistance;
      mesh.morphTargetInfluences[Brace] = Math.min(1, .87 * action + .14 * drop);
    }
  }
}
