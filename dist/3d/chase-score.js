// A closed-corridor cue in D Phrygian. Sixteenths stay locked to the run clock;
// orchestration follows distance, so a near escape and a clean run phrase differently.
const STEP = 60 / 158 / 4;
const ROOTS = [38, 38, 39, 36, 38, 43, 39, 33];
const CELLO = [0, null, 0, 7, null, 1, 0, null, 0, 7, null, 3, 1, null, 7, null];
const ANSWER = [12, null, null, 13, null, 7, null, null, 10, null, 8, null, 7, null, null, null];
const CALLS = ['howl', 'snarl', 'snarl', 'scream', 'howl', 'snarl', 'scream'];
const SAMPLES = { howl: 'creature-howl', snarl: 'creature-growl', scream: 'creature-alert' };
const PITCH = n => 440 * 2 ** ((n - 69) / 12);
const clamp = n => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

function level(node, at, target, seconds = .04) {
  node.gain.setTargetAtTime(target, at, seconds / 3);
}

function envelope(node, at, peak, attack, duration) {
  node.gain.setValueAtTime(.00001, at);
  node.gain.exponentialRampToValueAtTime(Math.max(.00002, peak), at + attack);
  node.gain.exponentialRampToValueAtTime(.00001, at + duration);
}

function periodic(context, harmonics) {
  return context.createPeriodicWave(new Float32Array(harmonics.length), Float32Array.from(harmonics));
}

export class ChaseScore {
  constructor(context, { music, effects, noise, spatial = false, recording }) {
    this.context = context;
    this.music = music;
    this.effects = effects;
    this.noise = noise;
    this.spatial = spatial;
    this.recording = recording;
    // Precompute modest band-limited wave tables during audio unlock. The chase
    // never renders its vocal folds or strings in the game's animation callback.
    this.bow = periodic(context, [0, 1, .56, .23, .32, .105, .18, .04, .085, .07, .025]);
    this.reed = periodic(context, [0, 1, .13, .31, .06, .16, .04, .095, .02]);
    this.folds = periodic(context, [0, .54, 1, .38, .58, .17, .34, .093, .21, .072, .12, .036, .063]);
    this.live = null;
  }

  enter(now, elapsed) {
    const c = this.context;
    const score = c.createGain(), fx = c.createGain(), voice = c.createGain();
    const colour = c.createBiquadFilter();
    colour.type = 'lowpass';
    const emitter = this.spatial ? c.createPanner() : c.createStereoPanner();
    if (this.spatial) {
      // All other game audio has its own stereo renderer. Express this one HRTF
      // emitter in listener space so a player can turn and hear it move in front.
      emitter.panningModel = 'HRTF';
      emitter.rolloffFactor = 0;
    }
    const lowStrings = c.createStereoPanner(), violas = c.createStereoPanner(), rims = c.createStereoPanner();
    lowStrings.pan.value = -.24; violas.pan.value = .37; rims.pan.value = .18;
    for (const stem of [lowStrings, violas, rims]) stem.connect(score);
    score.connect(this.music);
    fx.connect(this.effects);
    const earBalance = this.spatial ? c.createStereoPanner() : null;
    const direct = earBalance ?? emitter;
    voice.connect(colour).connect(emitter);
    if (earBalance) emitter.connect(earBalance);
    direct.connect(fx);
    const echo = c.createDelay(.2), echoGain = c.createGain();
    echo.delayTime.value = .109;
    echoGain.gain.value = .21;
    direct.connect(echo).connect(echoGain).connect(fx);
    score.gain.value = 0;
    level(score, now, 1, .1);
    const section = { score, lowStrings, violas, rims, fx, voice, colour, emitter, earBalance, sources: new Set(),
      nodes: [score, lowStrings, violas, rims, fx, voice, colour, emitter, echo, echoGain].concat(earBalance ?? []),
      next: Math.ceil(elapsed / STEP), lastElapsed: elapsed, lastPosition: -Infinity,
      nextCall: elapsed + .53, callIndex: Math.floor(elapsed / 5), obstacle: null };
    this.live = section;
    return section;
  }

  leave(now = this.context.currentTime) {
    const section = this.live;
    if (!section) return;
    this.live = null;
    for (const node of [section.score, section.fx]) {
      node.gain.cancelScheduledValues(now);
      level(node, now, 0, .045);
    }
    for (const source of section.sources) source.stop(now + .065);
    const cleanup = this.context.createConstantSource();
    cleanup.offset.value = 0;
    cleanup.connect(section.fx);
    cleanup.onended = () => { cleanup.disconnect(); section.nodes.forEach(node => node.disconnect()); };
    cleanup.start(now);
    cleanup.stop(now + .09);
  }

  play(source, nodes, at, duration, offset = 0) {
    const group = this.live;
    group.sources.add(source);
    source.onended = () => {
      group.sources.delete(source);
      source.disconnect();
      nodes.forEach(node => node.disconnect());
    };
    if (source.buffer) source.start(at, offset); else source.start(at);
    source.stop(at + duration + .01);
  }

  note(at, hz, endHz, duration, volume, bus, shape = 'sine', attack = .007) {
    const c = this.context, source = c.createOscillator(), gain = c.createGain();
    if (typeof shape === 'string') source.type = shape; else source.setPeriodicWave(shape);
    source.frequency.setValueAtTime(hz, at);
    if (hz !== endHz) source.frequency.exponentialRampToValueAtTime(endHz, at + duration);
    envelope(gain, at, volume, attack, duration);
    source.connect(gain).connect(bus);
    this.play(source, [gain], at, duration);
  }

  scrape(at, duration, volume, from, to, bus, offset = .13) {
    const c = this.context, source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'bandpass';
    filter.Q.value = .95;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    envelope(gain, at, volume, .006, duration);
    source.connect(filter).connect(gain).connect(bus);
    this.play(source, [filter, gain], at, duration, offset % this.noise.duration);
  }

  beat(index, at, progress, danger) {
    const { score, lowStrings, violas, rims } = this.live;
    const bar = Math.floor(index / 16), pulse = index % 16;
    const root = ROOTS[bar % ROOTS.length];
    const rise = progress > .23, high = progress > .51, final = progress > .77;
    const breath = bar % 8 === 7 && pulse >= 12 && !final;
    // A low drum and an iron rim answer each other in a 3+3+2 figure.
    if (pulse === 0 || pulse === 6 || (pulse === 10 && rise) || (pulse === 14 && final)) {
      this.note(at, 119, 38, .22, pulse === 0 ? .27 : .18, score);
      this.scrape(at + .003, .07, .115, 1850, 420, score, index * .07);
    }
    if (pulse === 8 || (high && pulse === 14 && !breath)) {
      this.scrape(at, .20, .17, 2400, 590, rims, index * .13);
      this.note(at + .011, 316, 169, .13, .065, rims, this.reed);
    }
    const bowNote = CELLO[pulse];
    if (bowNote !== null && !breath && (rise || pulse % 2 === 0 || pulse === 3)) {
      const pitch = PITCH(root + bowNote);
      this.note(at + .006, pitch * .986, pitch, .22, pulse % 4 ? .083 : .12, lowStrings, this.bow, .019);
      if (high && pulse % 4 === 0) this.note(at + .012, pitch * 1.995, pitch * 2.003, .21, .046, violas, this.reed, .032);
    }
    if (pulse === 0) {
      this.note(at, PITCH(root - 12), PITCH(root - 12), .78, .14, score, 'sine', .065);
      if (rise && bar % 2 === 0) {
        const note = PITCH(root + (bar % 4 ? 19 : 13));
        this.note(at, note, note * .993, STEP * 23, .084, violas, this.bow, .31);
        this.note(at + .023, note * 1.009, note * 1.002, STEP * 21, .050, lowStrings, 'triangle', .4);
      }
    }
    if (high && (pulse % 4 === 2 || final && pulse % 2 === 1) && !breath) {
      this.scrape(at, .055 + danger * .035, .052, 4800 + (pulse % 3) * 430, 2100, rims, index * .17);
    }
    const answer = ANSWER[pulse];
    if ((final || high && bar % 2 === 1) && answer !== null) {
      const pitch = PITCH(root + 12 + answer);
      this.note(at, pitch * 1.013, pitch, .32, .061, violas, this.reed, .023);
      this.note(at + .085, pitch * 1.503, pitch * 1.496, .22, .023, lowStrings, 'triangle');
    }
  }

  duck(at, depth, duration) {
    const gain = this.live.score.gain;
    gain.cancelScheduledValues(at);
    gain.setTargetAtTime(depth, at, .019);
    gain.setTargetAtTime(1, at + duration, .083);
  }

  finalPhrase(at) {
    const { lowStrings, violas, rims } = this.live;
    // The green fire door comes into view. The top voice finally gives the
    // ostinato its tonic, answered a fifth below by the lower strings.
    for (const [beat, note, length] of [[0,77,.34],[1,76,.29],[2,75,.35],[3,74,1.04]]) {
      const pitch = PITCH(note);
      this.note(at + beat * STEP * 3, pitch * .995, pitch, length, .088, violas, this.bow, .046);
      this.note(at + beat * STEP * 3 + .037, pitch * .667, pitch * .668, length, .054, lowStrings, this.reed, .055);
    }
    this.scrape(at, .88, .1, 510, 3850, rims);
  }

  position(state, listener, now) {
    const { emitter, voice, colour, earBalance } = this.live;
    const near = clamp(state.danger);
    colour.frequency.setTargetAtTime(1050 + 5900 * near, now, .055);
    level(voice, now, .53 + .55 * near, .11);
    if (!this.spatial) {
      // In the side view the escape is east; the runner hears the creature on the left.
      emitter.pan.setTargetAtTime(-.76 + .32 * near, now, .04);
    } else if (listener && state.threat) {
      const dx = state.threat.x - listener.x, dz = state.threat.z - listener.z;
      const cs = Math.cos(listener.yaw), sn = Math.sin(listener.yaw);
      const side = dx * cs + dz * sn;
      emitter.positionX.setTargetAtTime(side, now, .035);
      // Preserve lateral readability for bass-heavy calls even where the HRTF
      // has little interaural level difference at their fundamental.
      earBalance.pan.setTargetAtTime(.28 * side / Math.max(.4, Math.hypot(dx, dz)), now, .04);
      emitter.positionY.setTargetAtTime(.17, now, .035);
      emitter.positionZ.setTargetAtTime(-dx * sn + dz * cs, now, .035);
    }
  }

  roar(at, kind, proximity) {
    const { voice } = this.live, c = this.context;
    const duration = kind === 'howl' ? 1.7 : kind === 'snarl' ? .88 : 1.15;
    const clip = this.recording?.(SAMPLES[kind]);
    if (clip) {
      const source = c.createBufferSource(), gain = c.createGain();
      source.buffer = clip;
      source.playbackRate.value = kind === 'howl' ? .84 : kind === 'snarl' ? .93 : 1.04;
      const length = Math.min(clip.duration / source.playbackRate.value, duration + .32);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.64, at + .025);
      gain.gain.setValueAtTime(.64, at + length * .78);
      gain.gain.linearRampToValueAtTime(0, at + length);
      source.connect(gain).connect(voice);
      this.play(source, [gain], at, length);
    }
    // False-fold excitation splits into three shifting mouth resonances. The
    // rasp and breath are independent, leaving an intake before the voiced cry.
    this.duck(at, .75, .41);
    this.scrape(at, .31, .29, 1560, 650, voice);
    const onset = at + .115;
    const throat = c.createOscillator(), vocal = c.createGain();
    throat.setPeriodicWave(this.folds);
    const apex = kind === 'scream' ? 208 : kind === 'howl' ? 148 : 78;
    throat.frequency.setValueAtTime(apex * .59, onset);
    throat.frequency.exponentialRampToValueAtTime(apex, onset + duration * .29);
    throat.frequency.exponentialRampToValueAtTime(apex * .46, onset + duration);
    const effects = [vocal];
    const tremor = c.createOscillator(), depth = c.createGain();
    tremor.frequency.value = 32 + proximity * 11;
    depth.gain.value = 6.5;
    tremor.connect(depth).connect(throat.frequency);
    this.play(tremor, [depth], onset, duration);
    envelope(vocal, onset, clip ? .34 : .81, duration * .22, duration);
    throat.connect(vocal);
    for (const [closed, open, amplitude, q] of [[400, 750, 1.15, 3], [1070, 1510, .76, 4], [2290, 2770, .38, 5]]) {
      const mouth = c.createBiquadFilter(), band = c.createGain();
      mouth.type = 'bandpass'; mouth.Q.value = q; band.gain.value = amplitude;
      mouth.frequency.setValueAtTime(closed, onset);
      mouth.frequency.exponentialRampToValueAtTime(open, onset + duration * .32);
      mouth.frequency.exponentialRampToValueAtTime(closed * .82, onset + duration);
      vocal.connect(mouth).connect(band).connect(voice);
      effects.push(mouth, band);
    }
    this.play(throat, effects, onset, duration);
    this.scrape(onset + duration * .29, duration * .6, .25, 2870, 990, voice, .73);
    this.note(onset + .035, 53, 31, duration * .75, .14, voice, 'triangle', .09);
  }

  update(state, listener = null) {
    const now = this.context.currentTime;
    if (!state || !Number.isFinite(state.elapsed)) { this.leave(now); return; }
    const elapsed = Math.max(0, state.elapsed);
    if (this.live && elapsed + .20 < this.live.lastElapsed) this.leave(now);
    const group = this.live ?? this.enter(now, elapsed);
    const progress = clamp(state.progress), danger = clamp(state.danger);
    group.lastElapsed = elapsed;
    if (now - group.lastPosition >= .040) {
      this.position(state, listener, now);
      group.lastPosition = now;
    }
    const beat = elapsed / STEP;
    // A long frame, browser suspension, or restored run cannot queue a backlog.
    group.next = Math.max(group.next, Math.floor(beat));
    while (group.next * STEP < elapsed + .115) {
      this.beat(group.next, now + .009 + Math.max(0, group.next * STEP - elapsed), progress, danger);
      group.next++;
    }
    if (progress >= .95 && !group.cadence) { this.finalPhrase(now + .025); group.cadence = true; }
    if (elapsed >= group.nextCall) {
      const kind = CALLS[group.callIndex % CALLS.length];
      this.roar(now + .012, kind, danger);
      group.callIndex++;
      group.nextCall = elapsed + [5.3, 4.55, 6.2, 4.9][group.callIndex % 4] - danger * 1.25;
    }
    if (state.obstacle != null && group.obstacle !== state.obstacle) {
      group.obstacle = state.obstacle;
      // A pair of dry relay clicks in front separates the obstacle cue from
      // the longer rear cries and the metallic subdivisions in the score.
      const at = now + .02;
      this.duck(at, .78, .16);
      this.note(at, 805, 665, .13, .11, group.fx, this.reed);
      this.note(at + .077, 1013, 924, .16, .105, group.fx, 'triangle');
      this.scrape(at + .08, .06, .078, 2430, 1590, group.fx);
    }
  }
}
