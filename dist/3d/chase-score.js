// The same D Phrygian motif accelerates on complete bar lines. The clock runs
// from the chase timer, while instrumentation and the pursuer react to distance.
const SECTION_PULSES = 8 * 16;
let sectionTime = 0;
const TEMPO = [168, 178, 190, 204].map((bpm, index) => {
  const step = 60 / bpm / 4;
  const section = { time: sectionTime, index: index * SECTION_PULSES, step };
  sectionTime += step * SECTION_PULSES;
  return section;
});
const pulseAt = (section, elapsed) => section.index + (elapsed - section.time) / section.step;
const nextPulse = elapsed => Math.ceil(pulseAt(TEMPO.findLast(section => elapsed >= section.time), elapsed));
const timeAt = index => {
  const section = TEMPO[Math.min(TEMPO.length - 1, Math.floor(index / SECTION_PULSES))];
  return section.time + (index - section.index) * section.step;
};
const ROOTS = [38, 38, 39, 36, 38, 43, 39, 33];
const CELLO = [0, null, 0, 7, null, 1, 0, null, 0, 7, null, 3, 1, null, 7, null];
const ANSWER = [12, null, null, 13, null, 7, null, null, 10, null, 8, null, 7, null, null, null];
const CALLS = ['howl', 'snarl', 'scream', 'snarl', 'howl', 'scream', 'snarl'];
const CALL_SPACING = [4.4, 4.05, 5, 4.35];
const WARNINGS = {
  hurdle: [690, 880, 0.066],
  rack: [785, 650, 0.066],
  gap: [740, 485, 0.078],
  bridge: [826, 1150, 0.084],
};
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

// The dynamics compressors leave short attack transients and add makeup gain.
// This last, symmetric stage is linear until the remaining headroom is used.
const ceilingCurve = Float32Array.from({ length: 2049 }, (_, i) => {
  const x = i / 1024 - 1;
  const abs = Math.abs(x);
  return abs < .84 ? x : Math.sign(x) * (.84 - .11 * Math.expm1(-((abs - .84) / .11)));
});

export function softPeakCeiling(context) {
  const ceiling = context.createWaveShaper();
  ceiling.curve = ceilingCurve;
  return ceiling;
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
      next: nextPulse(elapsed), lastElapsed: elapsed, lastPosition: -Infinity,
      nextCall: elapsed + .43, callIndex: Math.floor(elapsed / 5),
      nextStep: elapsed + .21, stepIndex: 0, obstacle: null,
      duckUntil: -Infinity, duckDepth: 1 };
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
    const rise = progress > .21, high = progress > .49, final = progress > .76;
    const breath = bar % 8 === 7 && pulse >= 12 && !final;
    // Stable low accents introduce the run. Tighter rim rolls and broken
    // drum patterns take over as the corridor starts demanding combinations.
    const roll = final && bar % 2 === 1;
    if (pulse === 0 || pulse === 6 || (pulse === 10 && rise) || (pulse === 14 && final)) {
      this.note(at, 125, 38, .18, pulse === 0 ? .27 : .16, score);
      this.scrape(at + .003, .062, .104, 1850, 420, score, index * .07);
    }
    if (pulse === 8 || (high && pulse === 14 && !breath)) {
      this.scrape(at, .20, .17, 2400, 590, rims, index * .13);
      this.note(at + .011, 316, 169, .13, .065, rims, this.reed);
    }
    const bowNote = CELLO[pulse];
    if (bowNote !== null && !breath && (rise || pulse % 2 === 0 || pulse === 3)) {
      const pitch = PITCH(root + bowNote);
      this.note(at + .006, pitch * .986, pitch, final ? .17 : .21, pulse % 4 ? .077 : .115, lowStrings, this.bow, .016);
      if (high && pulse % 4 === 0) this.note(at + .012, pitch * 1.995, pitch * 2.003, .21, .046, violas, this.reed, .032);
    }
    if (pulse === 0) {
      this.note(at, PITCH(root - 12), PITCH(root - 12), .78, .14, score, 'sine', .065);
      if (rise && bar % 2 === 0) {
        const note = PITCH(root + (bar % 4 ? 19 : 13));
        this.note(at, note, note * .993, 1.83, .078, violas, this.bow, .29);
        this.note(at + .023, note * 1.009, note * 1.002, 1.67, .049, lowStrings, 'triangle', .34);
      }
    }
    if (high && (pulse % 4 === 2 || final && pulse % 2 === 1 || roll && pulse > 11) && !breath) {
      this.scrape(at, .045 + danger * .027, roll ? .042 : .05, 4800 + (pulse % 3) * 430, 2100, rims, index * .17);
    }
    const answer = ANSWER[pulse];
    if ((final || high && bar % 2 === 1) && answer !== null) {
      const pitch = PITCH(root + 12 + answer);
      this.note(at, pitch * 1.013, pitch, .26, .058, violas, this.reed, .021);
      this.note(at + .071, pitch * 1.503, pitch * 1.496, .18, .025, lowStrings, 'triangle');
    } else if (roll && (pulse === 7 || pulse === 13)) {
      const pitch = PITCH(root + (pulse === 7 ? 24 : 25));
      this.note(at, pitch * .98, pitch, .19, .042, violas, this.bow, .012);
    }
  }

  duck(at, depth, duration) {
    const group = this.live;
    const gain = group.score.gain;
    // An overlapping obstacle tick must not cancel a stronger cry's duck.
    const until = at + duration;
    if (at < group.duckUntil) {
      depth = Math.min(depth, group.duckDepth);
      duration = Math.max(until, group.duckUntil) - at;
    }
    group.duckDepth = depth;
    group.duckUntil = at + duration;
    gain.cancelScheduledValues(at);
    gain.setTargetAtTime(depth, at, .015);
    gain.setTargetAtTime(1, group.duckUntil, .067);
  }

  finalPhrase(at) {
    const { lowStrings, violas, rims } = this.live;
    // The green fire door comes into view. The top voice finally gives the
    // ostinato its tonic, answered a fifth below by the lower strings.
    for (const [offset, note, length] of [[0,77,.30],[.22,76,.26],[.44,75,.30],[.66,74,.91]]) {
      const pitch = PITCH(note);
      this.note(at + offset, pitch * .995, pitch, length, .086, violas, this.bow, .042);
      this.note(at + offset + .037, pitch * .667, pitch * .668, length, .052, lowStrings, this.reed, .051);
    }
    this.scrape(at, .88, .1, 510, 3850, rims);
  }

  position(state, listener, now) {
    const { emitter, voice, colour, earBalance } = this.live;
    const near = clamp(state.danger);
    colour.frequency.setTargetAtTime(1050 + 5900 * near, now, .055);
    level(voice, now, .54 + .53 * near, .086);
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

  stepBehind(at, index, danger) {
    const { voice } = this.live;
    // Long and short strides alternate. Only the creature bus sends the footfall
    // through rear panning and distance coloration, apart from the player's feet.
    this.note(at, index % 2 ? 93 : 112, 42, .087, .024 + danger * .047, voice, 'triangle');
    this.scrape(at + .015, .088, .052 + danger * .036, 790, 370, voice, .21 * index);
  }

  warn(at, type) {
    const { fx } = this.live;
    const [first, second, volume] = WARNINGS[type] ?? WARNINGS.hurdle;
    this.duck(at, .79, .15);
    this.note(at, first, first * .84, .097, volume, fx, this.reed);
    this.note(at + .052, second, second * .92, .106, volume * .9, fx, 'triangle');
    this.scrape(at + .045, .045, volume * .77, 2520, 1540, fx);
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
    this.duck(at, kind === 'scream' ? .61 : .71, .46);
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
    // A slow frame, browser suspension or restored run never queues a backlog.
    group.next = Math.max(group.next, nextPulse(Math.max(0, elapsed - .02)));
    while (timeAt(group.next) < elapsed + .115) {
      this.beat(group.next, now + .009 + Math.max(0, timeAt(group.next) - elapsed), progress, danger);
      group.next++;
    }
    if (progress >= .95 && !group.cadence) { this.finalPhrase(now + .025); group.cadence = true; }
    if (elapsed >= group.nextCall) {
      const kind = CALLS[group.callIndex % CALLS.length];
      this.roar(now + .012, kind, danger);
      group.callIndex++;
      group.nextCall = elapsed + CALL_SPACING[group.callIndex % CALL_SPACING.length] - progress * .66 - danger * .73;
    }
    if (elapsed >= group.nextStep) {
      this.stepBehind(now + .012, group.stepIndex, danger);
      group.stepIndex++;
      group.nextStep = elapsed + .347 - progress * .041 - danger * .034 + (group.stepIndex % 2 ? .018 : -.018);
    }
    if (state.obstacle != null && group.obstacle !== state.obstacle) {
      group.obstacle = state.obstacle;
      // The cue bus is centered ahead; the creature remains separately spatialized.
      this.warn(now + .02, state.obstacleType);
    }
  }
}
