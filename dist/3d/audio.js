import { SOB_FILES } from './mourning-audio.js';
import { ChaseScore, softPeakCeiling } from './chase-score.js';
import { CREATURE_SAMPLE_RATE, renderCreatureVoice } from './creature-voice.js';

const SILENCE = 0.0001;
const MAX_VOICES = 70;
const DIALOGUE_DUCK = [
  { bus: 'dialogueMusic', gain: .25, attack: .045, release: .32 },
  { bus: 'dialogueRoom', gain: .33, attack: .048, release: .30 },
  { bus: 'dialogueThreat', gain: .70, attack: .09, release: .21 }
];
const CUE_COOLDOWN = {
  step: .105, warning: 1.38, howl: 7.8, snarl: 2.65, breath: 2.25,
  'mourning-cry': 2.7, 'mourning-lock': .45, 'mourning-strike': 1.2
};
const MOURNING_SOUNDS = new Set(['mourning-cry', 'mourning-lock', 'mourning-strike', 'mourning-bind', 'mourning-floor']);
const VOCAL_GAIN = {
  howl: .57,    // At range its reverb and shape carry before the peak level.
  scream: .69,  // The short alert must sit above the pursuit score.
  snarl: .49,   // Audible beside footsteps without constant high-energy spikes.
  grab: .85,    // The attack has a quick crest with headroom left for the impact.
};
const RECORDED_VOCALS = {
  howl: { file: 'creature-howl', gain: .58 },
  scream: { file: 'creature-alert', gain: .59 },
  snarl: { file: 'creature-growl', gain: .61 },
  grab: { file: 'creature-grab', gain: .78 },
  breath: { file: 'creature-exhale', gain: .38 }
};
// Distinct acoustic footprints for the three pursuers. All layers share the
// actor's moving emitter, so a phase change can cut the whole performance.
const CREATURE_TIMBRES = [
  { rate: .86, metal: 732, breath: .12 },   // Boiler worker: slow chest, loose chain.
  { rate: 1.07, metal: 1410, breath: .16 }, // Night clerk: sharper intake, badge clip.
  { rate: .96, metal: 328, breath: .24 }    // Both-phase figure: double breath and a wet rattle.
];

const VOICE_CHANNELS = {
  stairwell: { low: 92, high: 7900 },
  archive: { low: 122, high: 5750 },
  intercom: { low: 190, high: 5100 },
  gramophone: { low: 176, high: 5100 },
  warning: { low: 108, high: 7800 }
};
const RECORDED_STEPS = {
  concrete: { file: 'step-stone', gain: .50 },
  metal: { file: 'step-grate', gain: .50 },
  grate: { file: 'step-grate', gain: .48 },
  carpet: { file: 'step-carpet', gain: .36 }
};
const ROOM_RECORDINGS = [
  { file: 'room-boiler', gain: .60, duration: 12.6 },
  { file: 'room-office', gain: .45, duration: 13.1 },
  { file: 'room-roof', gain: .63, duration: 15 }
];
const RECORDING_FILES = [
  ...Object.values(RECORDED_VOCALS).map(clip => clip.file),
  ...new Set(Object.values(RECORDED_STEPS).map(clip => clip.file)),
  'door-steel', ...SOB_FILES, ...ROOM_RECORDINGS.map(room => room.file)
];
const STEP_CLIP = .45;
const AAC_PRIMING = 2112 / 32_000;
const recordingOffset = (buffer, duration) =>
  buffer.duration - duration > .05 ? AAC_PRIMING : 0;
const ROOMS = [
  { decay: 1.65, reflections: [0.023, 0.051, 0.11], rumble: 47, air: 610, room: 0.38 },
  { decay: 0.86, reflections: [0.016, 0.033, 0.074], rumble: 58, air: 400, room: 0.24 },
  { decay: 1.13, reflections: [0.041, 0.086, 0.16], rumble: 39, air: 1100, room: 0.19 },
];
const SURFACES = {
  concrete: { grit: 1150, tread: 108, ring: 0 },
  metal: { grit: 2550, tread: 142, ring: 726 },
  grate: { grit: 3100, tread: 172, ring: 910 },
  carpet: { grit: 470, tread: 78, ring: 0 },
};
const MOTIF = [0, 7, 3, 2, 0, -5, -2, 2];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const freq = note => 440 * 2 ** ((note - 69) / 12);
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const ramp = (param, time, target, duration) => {
  if (param.cancelAndHoldAtTime) {
    param.cancelAndHoldAtTime(time);
  } else {
    const value = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(value, time);
  }
  param.linearRampToValueAtTime(target, time + duration);
};

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function roomImpulse(context, room, index) {
  const { sampleRate } = context;
  const length = Math.ceil(room.decay * sampleRate);
  const buffer = context.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const random = rng(0x10fe + index * 65 + channel * 1003);
    const samples = buffer.getChannelData(channel);
    let tail = 0;
    for (let i = Math.round(sampleRate * 0.025); i < length; i++) {
      tail = tail * 0.61 + (random() * 2 - 1) * 0.39;
      samples[i] = tail * 0.019 * Math.exp(-6.5 * i / length);
    }
    room.reflections.forEach((delay, reflection) => {
      const onset = Math.round((delay + channel * 0.007) * sampleRate);
      samples[onset] += 0.20 / (reflection + 1);
      samples[onset + 11] -= 0.08 / (reflection + 1);
    });
  }
  return buffer;
}

function envelope(param, at, attack, duration, strength) {
  param.setValueAtTime(SILENCE, at);
  param.exponentialRampToValueAtTime(Math.max(SILENCE * 2, strength), at + Math.min(attack, duration * 0.55));
  param.exponentialRampToValueAtTime(SILENCE, at + duration);
}

export class HorrorAudio {
  constructor() {
    this.context = null;
    this.muted = false;
    this.volume = 0.82;
    this.paused = false;
    this.night = false;
    this.level = -1;
    this.tension = 0;
    this.player = { x: 0, z: 0, yaw: 0 };
    this.lastFrame = -Infinity;
    this.lastCues = new Map();
    this.vocalBuffers = new Map();
    this.vocalEmitters = new Set();
    this.recordings = new Map();
    this.roomRecordings = new Map();
    this.recordingReady = null;
    this.currentDialogue = null;
    this.random = rng(0xfad24);
    this.liveVoices = 0;
    this.scoreIndex = 0;
  }

  async start() {
    if (!this.context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return false;
      this.initialize(new AudioContext());
    }
    this.loadRecordings();
    if (this.context.state === 'suspended') await this.context.resume();
    return true;
  }

  initialize(context) {
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 17;
    compressor.ratio.value = 3.6;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.09;
    const output = context.createGain();
    output.gain.value = .80; // Preserve peak headroom after the limiter's makeup gain.
    this.master.connect(compressor).connect(limiter).connect(output).connect(softPeakCeiling(context)).connect(context.destination);

    this.closeBus = context.createGain();
    this.worldBus = context.createGain();
    this.dialogueThreat = context.createGain();
    this.dialogueThreat.connect(this.worldBus);
    this.scoreBus = context.createGain();
    this.dialogueMusic = context.createGain();
    this.dialogueRoom = context.createGain();
    this.roomBus = context.createGain();
    this.roomRecordingFilter = context.createBiquadFilter();
    this.roomRecordingFilter.type = 'lowpass';
    this.roomRecordingFilter.frequency.value = 6800;
    this.dayBus = context.createGain();
    this.nightBus = context.createGain();
    this.wet = context.createGain();
    this.dayBus.gain.value = 1;
    this.nightBus.gain.value = 0;
    this.wet.gain.value = ROOMS[0].room;
    this.closeBus.connect(this.master);
    this.worldBus.connect(this.master);
    this.scoreBus.connect(this.dialogueMusic).connect(this.master);
    this.roomBus.connect(this.dialogueRoom).connect(this.master);
    this.roomRecordingFilter.connect(this.dialogueRoom);
    this.roomMusicGate = context.createGain();
    this.dayBus.connect(this.roomMusicGate);
    this.nightBus.connect(this.roomMusicGate);
    this.roomMusicGate.connect(this.scoreBus);

    this.convolver = context.createConvolver();
    this.convolver.normalize = false;
    this.impulses = ROOMS.map((room, index) => roomImpulse(context, room, index));
    this.worldBus.connect(this.convolver);
    this.dialogueMusic.connect(this.convolver);
    this.dialogueRoom.connect(this.convolver);
    this.convolver.connect(this.wet).connect(this.master);

    // Common voice treatment lifts quiet consonants and leaves the transients
    // from the tinny cabinets or archival tape well below the final limiter.
    const voiceCompressor = context.createDynamicsCompressor();
    voiceCompressor.threshold.value = -19;
    voiceCompressor.knee.value = 12;
    voiceCompressor.ratio.value = 2.45;
    voiceCompressor.attack.value = .009;
    voiceCompressor.release.value = .13;
    const voiceGain = context.createGain();
    voiceGain.gain.value = 1.30;
    voiceCompressor.connect(voiceGain).connect(this.master);
    this.voiceChannels = new Map();
    for (const [name, profile] of Object.entries(VOICE_CHANNELS)) {
      const input = context.createBiquadFilter();
      input.type = 'highpass';
      input.frequency.value = profile.low;
      const cabinet = context.createBiquadFilter();
      cabinet.type = 'lowpass';
      cabinet.frequency.value = profile.high;
      input.connect(cabinet).connect(voiceCompressor);
      this.voiceChannels.set(name, input);
    }

    const samples = context.sampleRate * 4;
    this.noiseBuffer = context.createBuffer(1, samples, context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = this.random() * 2 - 1;

    this.chaseScore = new ChaseScore(context, {
      music: this.scoreBus, effects: this.dialogueThreat, noise: this.noiseBuffer,
      spatial: true, recording: name => this.recordings.get(name),
    });

    this.vent = this.texture(context.createGain(), 'bandpass', 510, 0.54, 0.20, this.roomBus);
    this.wind = this.texture(context.createGain(), 'lowpass', 225, 0.7, 0, this.roomBus);
    this.ghosts = Array.from({ length: 3 }, (_, index) => this.buildGhost(index));
    this.engine = this.drone(47, 0.041, this.roomBus, 'triangle');
    this.engineMod = this.drone(47.23, 0.034, this.roomBus);
    this.nightSub = this.drone(35.5, 0, this.roomBus);
    this.setRoom(0, context.currentTime);
    this.nextScore = context.currentTime + 0.15;
    this.nextHeartbeat = this.nextScore;
    this.nextRoomEvent = this.nextScore + 3.5;
    this.nextHowl = context.currentTime + 3.4;
    this.nextSnarl = context.currentTime + 1.0;
    this.syncMaster();
  }

  loadRecordings() {
    if (!this.context || this.recordingReady) return this.recordingReady;
    const context = this.context;
    this.recordingReady = Promise.all(RECORDING_FILES.map(async file => {
      try {
        const response = await fetch(new URL('./audio/' + file + '.m4a', import.meta.url));
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.recordings.set(file, buffer);
        const room = ROOM_RECORDINGS.findIndex(recording => recording.file === file);
        if (room >= 0) this.attachRoomRecording(room, buffer);
      } catch {
        // Each missing clip leaves its established procedural voice or foley available.
      }
    }));
    return this.recordingReady;
  }

  attachRoomRecording(level, buffer) {
    const context = this.context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    const duration = ROOM_RECORDINGS[level].duration;
    // Some decoders expose the asset encoder's priming frames.
    source.loopStart = recordingOffset(buffer, duration);
    source.loopEnd = Math.min(buffer.duration, source.loopStart + duration);
    gain.gain.value = 0;
    source.connect(gain).connect(this.roomRecordingFilter);
    source.start(0, source.loopStart);
    this.roomRecordings.set(level, { source, gain });
    this.syncRoomRecordings(context.currentTime);
  }

  syncRoomRecordings(at) {
    const hasRecording = this.roomRecordings.has(this.level);
    ramp(this.roomBus.gain, at, hasRecording ? .47 : 1, .53);
    for (const [level, recorder] of this.roomRecordings) {
      ramp(recorder.gain.gain, at, level === this.level ? ROOM_RECORDINGS[level].gain : 0, .53);
    }
  }

  playBuffer(buffer, at, bus, volume, speed = 1, offset = 0, length = buffer.duration - offset) {
    if (this.liveVoices >= MAX_VOICES) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    gain.gain.value = volume;
    source.connect(gain).connect(bus);
    this.trackVoice(source, [gain]);
    source.start(at, offset, length);
    return source;
  }

  playRecording(file, at, bus, gain, speed, offset, length) {
    const buffer = this.recordings.get(file);
    if (!buffer) return null;
    const delay = file.startsWith('step-') ? recordingOffset(buffer, 3 * STEP_CLIP) : 0;
    return this.playBuffer(buffer, at, bus, gain, speed, (offset ?? 0) + delay, length);
  }

  playDialogue(buffer, channel, position) {
    if (!this.context || this.paused || this.muted || !buffer) return null;
    const at = this.context.currentTime + .008;
    const channelBus = this.voiceChannels.get(channel) ?? this.master;
    const bus = channel === 'gramophone' && position ?
      this.positionBus(position, at, buffer.duration + .15, false, channelBus) : channelBus;
    const source = this.playBuffer(buffer, at, bus, channel === 'warning' ? .83 : .90);
    if (source) {
      this.currentDialogue = source;
      if (channel === 'intercom') {
        // Contact bounce precedes the first consonant. Switching off or pausing
        // cuts the transmission without leaving a scheduled tail under the menu.
        this.noise(at, .032, .030, 2750, .83, bus, .002, 930);
        this.tone(at + .017, 176, 82, .048, .034, bus, 'triangle');
      }
      if (channel === 'gramophone') {
        this.noise(at, .043, .027, 1680, 1.55, bus, .002, 500);
      }
      for (const { bus, gain, attack, release } of DIALOGUE_DUCK) {
        const bed = this[bus].gain;
        const end = at + Math.max(attack, buffer.duration);
        ramp(bed, at, gain, attack);
        bed.setValueAtTime(gain, end);
        bed.linearRampToValueAtTime(1, end + release);
      }
      source.addEventListener('ended', () => {
        if (this.currentDialogue === source) this.currentDialogue = null;
      }, { once: true });
    }
    return source;
  }

  stopDialogue(source) {
    if (!source || this.currentDialogue !== source) return;
    this.currentDialogue = null;
    source.stop();
    for (const { bus, release } of DIALOGUE_DUCK) {
      ramp(this[bus].gain, this.context.currentTime, 1, release);
    }
  }

  texture(gain, filterType, frequency, q, amplitude, destination) {
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.value = amplitude;
    source.buffer = this.noiseBuffer;
    source.loop = true;
    source.connect(filter).connect(gain).connect(destination);
    source.start(0, this.random() * 2);
    return { source, filter, gain };
  }

  drone(frequency, amplitude, destination, type = 'sine') {
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    source.type = type;
    source.frequency.value = frequency;
    gain.gain.value = amplitude;
    source.connect(gain).connect(destination);
    source.start();
    return { source, gain };
  }

  buildGhost(index) {
    const context = this.context;
    const input = context.createGain();
    const gate = context.createGain();
    const pan = context.createStereoPanner();
    gate.gain.value = 0;
    input.connect(gate).connect(pan).connect(this.dialogueThreat);
    const breath = this.texture(context.createGain(), 'bandpass', 740 - index * 83, 1.55, 0, input);
    const wheeze = this.texture(context.createGain(), 'bandpass', 2330 - index * 141, 1.15, 0, input);
    return { breath, wheeze, gate, pan };
  }

  setVolume(value) {
    this.volume = clamp(finite(value, this.volume), 0, 1);
    this.syncMaster();
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.muted) {
      this.setChase(null);
      this.stopDialogue(this.currentDialogue);
    }
    this.syncMaster();
  }

  syncMaster() {
    if (!this.context) return;
    const gain = this.muted || this.paused ? 0 : 0.82 * this.volume;
    ramp(this.master.gain, this.context.currentTime, gain, 0.05);
  }

  setRoom(level, time) {
    if (this.level === level) return;
    this.level = level;
    const room = ROOMS[level];
    this.convolver.buffer = this.impulses[level];
    ramp(this.wet.gain, time, room.room, 0.23);
    ramp(this.engine.source.frequency, time, room.rumble, 0.34);
    ramp(this.engineMod.source.frequency, time, room.rumble + 0.25, 0.34);
    ramp(this.vent.filter.frequency, time, room.air, 0.26);
    this.syncRoomRecordings(time);
  }

  spatial(position) {
    const dx = finite(position.x, this.player.x) - this.player.x;
    const dz = finite(position.z, this.player.z) - this.player.z;
    const distance = Math.hypot(dx, dz);
    const side = dx * Math.cos(this.player.yaw) + dz * Math.sin(this.player.yaw);
    return {
      distance,
      pan: clamp(side / (distance + 0.65), -0.93, 0.93),
      amplitude: 1 / (1 + distance * 0.16 + distance ** 2 * 0.014),
    };
  }

  setChase(state) {
    if (!this.chaseScore) return;
    const wasActive = Boolean(this.chaseScore.live);
    this.chaseScore.update(state, this.player);
    const active = Boolean(this.chaseScore.live);
    if (wasActive === active) return;
    const now = this.context.currentTime;
    this.roomMusicGate.gain.setTargetAtTime(active ? 0 : 1, now, .04);
    this.nextScore = now + .08;
    this.nextRoomEvent = now + 3.5;
  }

  update({ x = 0, z = 0, yaw = 0, night = false, level = 0, tension = 0, ghosts = [], paused = false, chase = null } = {}) {
    this.player = { x: finite(x), z: finite(z), yaw: finite(yaw) };
    this.tension = clamp(finite(tension), 0, 1);
    if (this.paused !== paused) {
      this.paused = paused;
      this.syncMaster();
    }
    if (!this.context) return;
    const now = this.context.currentTime;
    const activeLevel = clamp(Math.trunc(finite(level)), 0, ROOMS.length - 1);
    this.setRoom(activeLevel, now);
    if (this.night !== night) {
      this.night = night;
      ramp(this.dayBus.gain, now, night ? 0 : 1, 0.18);
      ramp(this.nightBus.gain, now, night ? 1 : 0, 0.18);
      ramp(this.vent.gain.gain, now, night ? 0.075 : 0.20, 0.18);
      ramp(this.wind.gain.gain, now, night ? 0.27 : 0.03, 0.18);
      ramp(this.engine.gain.gain, now, night ? 0.013 : 0.041, 0.18);
      ramp(this.engineMod.gain.gain, now, night ? 0.004 : 0.034, 0.18);
      ramp(this.nightSub.gain.gain, now, night ? 0.063 : 0, 0.18);
      ramp(this.roomRecordingFilter.frequency, now, night ? 2800 : 6800, 0.18);
    }
    this.setChase(!paused && !this.muted ? chase : null);
    if (paused || now - this.lastFrame < 0.045) return;
    this.lastFrame = now;

    this.updateCreatureSounds(now, this.chaseScore.live ? [] : ghosts);
    if (this.chaseScore.live) return;
    if (now + 0.09 >= this.nextScore) {
      this.score(Math.max(now + 0.02, this.nextScore));
      this.nextScore = Math.max(now, this.nextScore) + 0.48;
    }
    if (this.tension > 0.17 && now >= this.nextHeartbeat) {
      const power = 0.060 + 0.068 * this.tension;
      this.tone(now, 58, 31, 0.21, power, this.closeBus);
      this.tone(now + 0.15, 49, 27, 0.16, power * 0.59, this.closeBus);
      this.nextHeartbeat = now + 1.25 - this.tension * 0.64;
    }
    if (now >= this.nextRoomEvent) {
      this.roomEvent(now + 0.05);
      this.nextRoomEvent = now + 4.7 + this.random() * 4.5;
    }
  }

  updateCreatureSounds(now, ghosts) {
    const nearby = ghosts
      .filter(ghost => ghost.kind !== 'mourning' && ghost.active !== false && ghost.visible !== false)
      .map(ghost => ({ ...this.spatial(ghost), ghost }))
      .filter(channel => channel.distance < 27)
      .sort((a, b) => a.distance - b.distance);
    const grabbed = now - (this.lastCues.get('death') ?? -Infinity) < 1.55;
    this.ghosts.forEach((slot, index) => {
      const source = grabbed ? null : nearby[index];
      const proximity = source ? clamp((7.1 - source.distance) / 4.9, 0, 1) : 0;
      const airLevel = this.recordings.has('creature-exhale') ? .28 : .63;
      ramp(slot.gate.gain, now, proximity * (source?.amplitude ?? 0) * airLevel, 0.11);
      if (proximity <= 0) return;
      const alert = clamp(finite(source.ghost.alert, this.tension), 0, 1);
      const rhythm = now * (2.05 + alert * 2.8) + index * 2.37 + .24 * Math.sin(now * 1.83);
      const inhale = (.5 - .5 * Math.sin(rhythm)) ** 3.1;
      const rattle = .77 + .23 * Math.sin(now * 33 + index * 6);
      ramp(slot.pan.pan, now, source.pan, 0.08);
      ramp(slot.breath.filter.frequency, now, 490 + inhale * 420 + alert * 235, 0.11);
      ramp(slot.breath.gain.gain, now, (.12 + inhale * .64) * rattle, 0.08);
      ramp(slot.wheeze.gain.gain, now, (.048 + inhale * .27) * (.64 + alert * .36), 0.08);
    });

    for (const emitter of this.vocalEmitters) {
      if (emitter.finished) continue;
      const present = emitter.position.key == null || (
        emitter.floor === this.level && ghosts.includes(emitter.position)
      );
      if (!present || emitter.position.active === false || emitter.position.visible === false) {
        // Finish this phrase after a shift. A return to the old phase gets a new call.
        this.finishCreatureCall(emitter, now);
        continue;
      }
      const located = this.spatial(emitter.position);
      ramp(emitter.gain.gain, now, located.amplitude, .075);
      ramp(emitter.pan.pan, now, located.pan, .075);
      ramp(emitter.filter.frequency, now, this.distanceCutoff(located.distance), .10);
    }

    if (grabbed || this.muted) return;
    const closest = nearby[0];
    if (now >= this.nextSnarl && closest && closest.distance < 6.0) {
      const breathe = this.recordings.has('creature-exhale') && this.random() < .51;
      this.cue(breathe ? 'breath' : 'snarl', closest.ghost);
      this.nextSnarl = now + 2.9 + this.random() * 2.8;
    }
    if (now >= this.nextHowl && this.tension < .39) {
      const distant = nearby.find(source => source.distance > 7.0 && finite(source.ghost.alert) < .32);
      if (distant) {
        this.cue('howl', distant.ghost);
        this.nextHowl = now + 9.8 + this.random() * 6.4;
      }
    }
  }

  creatureCue(name, at, position) {
    if (this.muted || this.liveVoices >= MAX_VOICES) return;
    const clip = RECORDED_VOCALS[name];
    const recording = this.recordings.get(clip.file);
    if (recording) {
      const actor = CREATURE_TIMBRES[position?.index] ?? CREATURE_TIMBRES[0];
      const speed = actor.rate * (.96 + this.random() * .08);
      const inhale = name === 'scream' ? .093 : name === 'howl' ? .16 : 0;
      const held = name === 'grab' ? 1.75 : 1;
      const bus = this.positionBus(position, at, Math.max(held, inhale + recording.duration / speed) + .19, true);
      this.playBuffer(recording, at + inhale, bus, clip.gain, speed);
      if (inhale) {
        this.playRecording('creature-exhale', at, bus, actor.breath, 1.16 * speed, .01, inhale + .095);
      }
      if (name === 'scream' || name === 'snarl') {
        // Clothing and loose fittings follow the lunge a few frames after the mouth.
        this.noise(at + .09, .14, .055, 1460, .8, bus, .018, 410);
        this.tone(at + .132, actor.metal, actor.metal * .93, .092, .036, bus, 'triangle');
        this.tone(at + .203, actor.metal * 1.48, actor.metal * 1.42, .087, .019, bus);
      }
      if (name === 'howl') {
        // A slowed take puts a second, lower throat underneath the held note.
        this.playRecording('creature-growl', at + inhale + .24, bus, .19, .76 * speed, .16, .78);
      }
      if (name === 'grab') {
        this.playRecording('creature-exhale', at + .39, bus, .25, .86);
        this.noise(at + .07, .29, .097, 2310, 1.1, bus, .021, 660);
        this.noise(at + .25, .21, .076, 590, 1.2, bus, .038, 165);
      }
      return;
    }
    if (name === 'breath') return;
    const variant = (this.level + Math.floor(this.random() * 3)) % 3;
    const key = name + '/' + variant;
    let buffer = this.vocalBuffers.get(key);
    if (!buffer) {
      const samples = renderCreatureVoice(name, variant);
      buffer = this.context.createBuffer(1, samples.length, CREATURE_SAMPLE_RATE);
      buffer.copyToChannel(samples, 0);
      this.vocalBuffers.set(key, buffer);
    }
    const bus = this.positionBus(position, at, buffer.duration + .11, true);
    this.playBuffer(buffer, at, bus, VOCAL_GAIN[name]);
  }

  finishCreatureCall(emitter, at) {
    if (emitter.finished) return;
    emitter.finished = true;
    ramp(emitter.gain.gain, at, 0, .075);
  }

  tone(at, start, end, duration, strength, bus, type = 'sine', attack = 0.008) {
    if (this.liveVoices >= MAX_VOICES) return;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    source.type = type;
    source.frequency.setValueAtTime(start, at);
    if (start !== end) source.frequency.exponentialRampToValueAtTime(end, at + duration);
    envelope(gain.gain, at, attack, duration, strength);
    source.connect(gain).connect(bus);
    this.trackVoice(source, [gain]);
    source.start(at);
    source.stop(at + duration + 0.025);
  }

  noise(at, duration, strength, frequency, q, bus, attack = 0.006, endFrequency = frequency) {
    if (this.liveVoices >= MAX_VOICES) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, at);
    if (frequency !== endFrequency) filter.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    envelope(gain.gain, at, attack, duration, strength);
    source.connect(filter).connect(gain).connect(bus);
    this.trackVoice(source, [filter, gain]);
    source.start(at, this.random() * 1.5);
    source.stop(at + duration + 0.025);
  }

  trackVoice(source, effects) {
    this.liveVoices++;
    source.onended = () => {
      source.disconnect();
      effects.forEach(effect => effect.disconnect());
      this.liveVoices--;
    };
  }

  bell(at, pitch, strength, bus, length = 1.2) {
    this.tone(at, pitch, pitch * 0.996, length, strength, bus);
    this.tone(at, pitch * 2.01, pitch * 2.008, length * 0.42, strength * 0.25, bus);
    this.tone(at, pitch * 3.96, pitch * 3.95, length * 0.22, strength * 0.12, bus);
  }

  score(at) {
    const beat = this.scoreIndex++;
    const frame = beat % 8;
    const base = [45, 43, 48][this.level];
    const harmony = [0, -4, -2, -5][Math.floor(beat / 8) % 4];
    if (frame === 0) {
      const root = freq(base + harmony);
      this.tone(at, root / 2, root / 2, 3.5, 0.047, this.dayBus, 'sine', 0.55);
      this.tone(at, root, root * 1.003, 3.5, 0.028, this.dayBus, 'triangle', 0.35);
      this.tone(at, root / 2 * 0.998, root / 2, 3.5, 0.052, this.nightBus, 'sine', 0.60);
      this.tone(at, root * 1.416, root * 1.408, 3.25, 0.021, this.nightBus, 'triangle', 0.75);
      this.tone(at, root * 1.5, root * 1.49, 2.85, 0.013, this.nightBus, 'sine', 0.68);
    }
    const degree = MOTIF[frame];
    const dayDegree = degree === 3 ? 4 : degree;
    if ([0, 1, 2, 3, 5, 7].includes(frame)) {
      const pitch = freq(base + 24 + harmony + dayDegree);
      this.bell(at, pitch, 0.033, this.dayBus, 0.88);
    }
    if ([0, 2, 5].includes(frame)) {
      const pitch = freq(base + 24 + harmony + degree);
      this.bell(at + 0.035, pitch * 0.993, 0.028, this.nightBus, 1.37);
      this.tone(at, pitch / 2 * 1.002, pitch / 2, 1.4, 0.016, this.nightBus, 'triangle', 0.40);
    }
  }

  roomEvent(at) {
    const theta = this.random() * Math.PI * 2;
    const position = { x: this.player.x + Math.cos(theta) * 5, z: this.player.z + Math.sin(theta) * 5 };
    const bus = this.positionBus(position, at, 1.9);
    if (this.level === 0) {
      this.bell(at, 1145, 0.075, bus, 0.3);
      this.noise(at + 0.03, 0.42, 0.09, 2100, 1.25, bus, 0.12, 350);
    } else if (this.level === 1) {
      this.tone(at, 490, 272, 0.27, 0.051, bus, 'triangle', 0.03);
      this.noise(at + 0.16, 0.3, 0.08, 760, 1.6, bus);
    } else {
      this.noise(at, 1.3, 0.23, 520, 0.47, bus, 0.51, 190);
      this.tone(at + 0.35, 438, 323, 0.85, 0.036, bus, 'triangle', 0.13);
    }
  }

  distanceCutoff(distance) {
    return clamp(10500 - distance * 525, 850, 10500);
  }

  positionBus(position, at, length = 2.1, follow = false, bus = follow ? this.dialogueThreat : this.worldBus) {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return bus;
    const context = this.context;
    const channel = this.spatial(position);
    const filter = context.createBiquadFilter();
    const pan = context.createStereoPanner();
    const gain = context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = this.distanceCutoff(channel.distance);
    pan.pan.value = channel.pan;
    gain.gain.value = channel.amplitude;
    gain.connect(filter).connect(pan).connect(bus);
    const emitter = follow ? { position, gain, filter, pan, floor: this.level } : null;
    if (emitter) this.vocalEmitters.add(emitter);
    // A silent source fires onended on the audio clock even in suspended tabs.
    const cleanup = context.createConstantSource();
    cleanup.offset.value = 0;
    cleanup.connect(gain);
    cleanup.onended = () => {
      if (emitter) this.vocalEmitters.delete(emitter);
      cleanup.disconnect();
      gain.disconnect();
      filter.disconnect();
      pan.disconnect();
    };
    cleanup.start(at);
    cleanup.stop(at + length);
    return gain;
  }

  duck(at, floor, release) {
    const gain = this.scoreBus.gain;
    ramp(gain, at, floor, 0.045);
    gain.setValueAtTime(floor, at + release * 0.45);
    gain.linearRampToValueAtTime(1, at + release);
  }

  cueMourning(name, at, position) {
    if (this.muted) return;
    const bus = this.positionBus(position, at, 3.65, name === 'mourning-cry');
    if (name === 'mourning-cry') {
      const file = SOB_FILES[Math.floor(this.random() * SOB_FILES.length)];
      if (this.playRecording(file, at, bus, .91, .98 + this.random() * .08)) return;
      for (const delay of [0, .25, .68]) {
        this.noise(at + delay, .37, .12, 710, 2.15, bus, .067, 390);
        this.tone(at + delay + .035, 324, 178, .27, .026, bus, 'triangle', .055);
      }
    } else if (name === 'mourning-lock') {
      // Lead with an unmistakable intake rather than obscuring the warning's vowels.
      this.noise(at, .16, .12, 1350, 1.9, bus, .012, 2850);
      this.tone(at + .11, 90, 54, .23, .08, this.closeBus);
    } else if (name === 'mourning-strike') {
      this.playRecording(SOB_FILES[1], at, bus, .68, .78, .05, 1.09);
      this.noise(at, .35, .22, 1750, 1.35, bus, .009, 690);
      this.duck(at, .35, 1.1);
    } else if (name === 'mourning-bind') {
      this.noise(at, .33, .152, 2700, 1.1, bus, .007, 880);
      this.tone(at + .045, 390, 167, .42, .047, bus, 'triangle', .020);
      this.tone(at, 102, 55, .37, .052, this.closeBus);
    } else {
      this.playRecording('step-stone', at, this.closeBus, .37, .68, STEP_CLIP, STEP_CLIP);
      this.tone(at, 70, 29, .37, .12, this.closeBus);
      this.noise(at + .024, .27, .15, 1080, .81, this.closeBus, .012, 268);
    }
  }

  cue(name, position) {
    const context = this.context;
    if (!context || this.paused) return;
    const at = context.currentTime + 0.006;
    const cooldown = CUE_COOLDOWN[name] ?? .065;
    if (at - (this.lastCues.get(name) ?? -Infinity) < cooldown) return;
    this.lastCues.set(name, at);
    if (MOURNING_SOUNDS.has(name)) {
      this.cueMourning(name, at, position);
      return;
    }
    if (name === 'howl' || name === 'snarl' || name === 'breath') {
      this.creatureCue(name, at, position);
      return;
    }
    if (name === 'warning') {
      this.creatureCue('scream', at, position);
      this.nextSnarl = Math.max(this.nextSnarl, at + 1.8);
      this.duck(at, 0.33, 1.18);
      return;
    }
    const local = ['step', 'jump', 'land', 'death', 'revive', 'blocked', 'shift', 'hit', 'ending'].includes(name);
    let bus = local ? this.closeBus : this.worldBus;
    if (Number.isFinite(position?.x) && Number.isFinite(position?.z)) {
      bus = this.positionBus(position, at, name === 'ending' ? 3.5 : 2.4);
    }
    const tone = (delay, start, end, length, gain, type, attack) =>
      this.tone(at + delay, start, end, length, gain, bus, type, attack);
    const noise = (delay, length, gain, start, q, attack, end) =>
      this.noise(at + delay, length, gain, start, q, bus, attack, end);

    switch (name) {
      case 'step': {
        const surfaceName = position?.surface ?? 'concrete';
        const clip = RECORDED_STEPS[surfaceName] ?? RECORDED_STEPS.concrete;
        if (this.recordings.has(clip.file)) {
          const step = Math.floor(this.random() * 3);
          const speed = .92 + this.random() * .18;
          if (this.playRecording(clip.file, at, bus, clip.gain, speed, step * STEP_CLIP, STEP_CLIP)) break;
        }
        const surface = SURFACES[surfaceName] ?? SURFACES.concrete;
        const variation = 0.89 + this.random() * 0.22;
        tone(0, surface.tread * variation, 56, 0.095, 0.078, 'triangle');
        noise(0.017, 0.12, 0.085, surface.grit * variation, 0.9, 0.013, surface.grit * 0.67);
        if (surface.ring) tone(0.013, surface.ring * variation, surface.ring * 0.97, 0.24, 0.047);
        break;
      }
      case 'shift':
        noise(0, 0.073, 0.20, 3900, 1.1, 0.003, 1380);
        tone(0.028, 114, 34, 0.58, 0.21);
        noise(0.038, 0.61, 0.28, this.night ? 2300 : 240, 0.72, 0.052, this.night ? 120 : 3450);
        tone(0.082, 498, this.night ? 180 : 761, 0.38, 0.066, 'triangle', 0.012);
        tone(0.15, 93, 61, 0.7, 0.054, 'triangle');
        this.duck(at, 0.48, 0.72);
        break;
      case 'blocked':
        tone(0, 145, 69, 0.16, 0.087, 'triangle');
        noise(0.025, 0.11, 0.083, 629, 1.2);
        break;
      case 'interact':
        noise(0, 0.13, 0.14, 1870, 1.2, 0.009, 670);
        tone(0.045, 183, 94, 0.25, 0.12, 'triangle');
        break;
      case 'hatch':
        // The stationary valve falls quiet; someone knocks from the far side.
        for (const delay of [.32, .65, 1.21]) {
          tone(delay, 191, 115, .15, .17, 'triangle', .003);
          tone(delay + .007, 467, 444, .27, .052);
          noise(delay, .075, .15, 1340, 1.3, .004, 710);
        }
        break;
      case 'pickup':
        [0, 3, 7].forEach((note, i) => this.bell(at + i * 0.09, freq(57 + note), 0.052, bus, 1.25));
        noise(0, 0.24, 0.082, 2750, 0.85, 0.03);
        break;
      case 'hit':
        tone(0, 105, 36, 0.32, 0.185);
        noise(0.014, 0.32, 0.27, 2800, 0.68, 0.004, 590);
        tone(0.03, 482, 261, 0.23, 0.068, 'triangle');
        this.duck(at, 0.57, 0.55);
        break;
      case 'death':
        for (const emitter of this.vocalEmitters) this.finishCreatureCall(emitter, at);
        if (position?.kind === 'mourning') {
          // Leave room for the authored bind and impact beats that follow contact.
          tone(0, 94, 42, .28, .151);
          noise(.009, .22, .112, 985, 1.18, .008, 375);
          this.duck(at, .25, 1.55);
          break;
        }
        if (Number.isFinite(position?.x) && Number.isFinite(position?.z)) {
          this.creatureCue('grab', at, position);
        }
        tone(0, 76, 22, 1.25, 0.23);
        tone(0.047, 142, 42, 0.76, 0.063, 'sawtooth', 0.021);
        noise(0.015, 1.28, 0.31, 740, 1.2, 0.105, 100);
        tone(0.17, 1182, 410, 0.92, 0.032, 'triangle', 0.081);
        this.duck(at, 0.28, 1.55);
        break;
      case 'revive':
        [0, 2, 7, 9].forEach((note, i) => this.bell(at + i * 0.11, freq(53 + note), 0.045, bus, 1.22));
        noise(0, 0.64, 0.102, 210, 0.7, 0.16, 1290);
        break;
      case 'door':
        if (this.playRecording('door-steel', at, bus, .63, .97)) {
          tone(.7, 88, 38, .32, .085);
          this.duck(at, .64, .95);
          break;
        }
        tone(0, 99, 32, 0.39, 0.16);
        noise(0.035, 0.82, 0.20, 810, 0.9, 0.088, 320);
        tone(0.062, 72, 93, 0.72, 0.050, 'triangle', 0.09);
        noise(0.60, 0.19, 0.16, 1990, 0.75, 0.009, 620);
        tone(0.67, 118, 44, 0.30, 0.15);
        this.duck(at, 0.64, 0.95);
        break;
      case 'jump':
        tone(0, 110, 70, 0.13, 0.062, 'triangle');
        noise(0, 0.21, 0.088, 1320, 0.7, 0.017, 640);
        break;
      case 'land':
        this.playRecording('step-stone', at, bus, .34, .82, STEP_CLIP, STEP_CLIP);
        tone(0, 99, 37, 0.22, 0.122);
        noise(0.008, 0.18, 0.154, 860, 0.72, 0.012, 430);
        break;
      case 'ending':
        this.duck(at, 0.28, 2.5);
        tone(0, 70, 55, 2.7, 0.10, 'sine', 0.4);
        [0, 7, 12, 16].forEach((note, i) => this.bell(at + i * 0.18, freq(55 + note), 0.054, bus, 2.1));
        break;
      default:
        break;
    }
  }
}
