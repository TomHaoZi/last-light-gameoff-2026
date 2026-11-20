export const CREATURE_SAMPLE_RATE = 24_000;

// Time, glottal pitch, mouth opening, vocal pressure and breath pressure.
const vocalContours = {
  howl: {
    duration: 2.36,
    knots: [
      [0, 106, .13, 0, 0], [.055, 112, .32, .13, .22],
      [.19, 151, .62, .67, .20], [.38, 193, .51, .78, .14],
      [.51, 202, .36, .82, .12], [.71, 149, .26, .55, .24],
      [.86, 91, .20, .24, .38], [1, 61, .12, 0, 0]
    ],
    grit: .39,
    upper: .61
  },
  scream: {
    duration: 1.07,
    knots: [
      [0, 166, .30, 0, 0], [.04, 205, .60, .26, .42],
      [.14, 415, .86, .94, .54], [.33, 536, .97, .98, .45],
      [.47, 502, .68, .76, .48], [.62, 376, .73, .70, .54],
      [.78, 250, .48, .42, .60], [1, 128, .25, 0, 0]
    ],
    grit: .55,
    upper: 1
  },
  snarl: {
    duration: 1.29,
    knots: [
      [0, 67, .13, 0, 0], [.14, 69, .18, .04, .48],
      [.28, 88, .29, .50, .39], [.41, 104, .57, .84, .26],
      [.54, 81, .35, .71, .34], [.74, 61, .44, .42, .49],
      [.89, 48, .21, .23, .56], [1, 39, .10, 0, 0]
    ],
    grit: .88,
    upper: .57
  },
  grab: {
    duration: 1.19,
    knots: [
      [0, 154, .26, 0, 0], [.032, 343, .55, .49, .49],
      [.084, 486, .94, .92, .75], [.21, 590, .86, .91, .54],
      [.33, 451, .70, .62, .79], [.51, 188, .56, .62, .80],
      [.66, 109, .38, .37, .67], [.84, 71, .19, .24, .73],
      [1, 44, .11, 0, 0]
    ],
    grit: .74,
    upper: .92
  }
};

function smooth(fraction) {
  return fraction * fraction * (3 - 2 * fraction);
}

function linear(a, b, amount) {
  return a + (b - a) * amount;
}

function seededNoise(seed) {
  return () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
}

function chamber(bandwidth) {
  const radius = Math.exp(-Math.PI * bandwidth / CREATURE_SAMPLE_RATE);
  return { radius, decay: radius * radius, scale: (1 - radius) * 2, gain: 0, older: 0, previous: 0 };
}

function tune(chamber, frequency) {
  chamber.gain = 2 * chamber.radius * Math.cos(2 * Math.PI * frequency / CREATURE_SAMPLE_RATE);
}

function resonate(chamber, input) {
  const output = chamber.scale * input + chamber.gain * chamber.previous - chamber.decay * chamber.older;
  chamber.older = chamber.previous;
  chamber.previous = output;
  return output;
}

/**
 * Aperiodic vocal folds excite a moving resonant tract. Separate turbulent
 * air and coarse false-fold vibration keep each call from becoming a pitch sweep.
 * The output is short generated PCM. Rooms, panning and level live in HorrorAudio.
 */
export function renderCreatureVoice(name, variant = 0) {
  const profile = vocalContours[name];
  const samples = new Float32Array(Math.ceil(profile.duration * CREATURE_SAMPLE_RATE));
  const random = seededNoise(0xa42e8 + 7_919 * variant + profile.knots.length * 1_021);
  const anatomy = 1 + (variant - 1) * .085;
  const pitch = 1 + (variant - 1) * .102;
  const throat = chamber(name === 'snarl' ? 155 : 190);
  const mouth = chamber(230);
  const nose = chamber(310);
  const teeth = chamber(650);
  const chest = chamber(121);
  const knots = profile.knots;
  let knot = 0, phase = .19, cycle = 0, glottis = 0, breath = 0, drift = 0;
  let pulseGain = 1, pulsePitch = 1, previousOutput = 0, dcBlocked = 0, peak = 0;
  let first = 0, open = 0, voice = 0, air = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / CREATURE_SAMPLE_RATE;
    const progress = i / (samples.length - 1);
    if (i % 24 === 0) {
      while (knot + 2 < knots.length && progress > knots[knot + 1][0]) knot++;
      const a = knots[knot], b = knots[knot + 1];
      const transition = smooth((progress - a[0]) / (b[0] - a[0]));
      first = linear(a[1], b[1], transition);
      open = linear(a[2], b[2], transition);
      voice = linear(a[3], b[3], transition);
      air = linear(a[4], b[4], transition);
      tune(throat, (345 + 547 * open) * anatomy);
      tune(mouth, (1030 + 755 * (1 - open) + 55 * Math.sin(t * 21)) * anatomy);
      tune(nose, (2440 + 335 * open) * anatomy);
      tune(teeth, (3690 + 815 * open) * anatomy);
      tune(chest, 168 + 137 * open);
    }
    const fuzz = random();
    drift += (fuzz - drift) * .011;
    const vibrato = .054 * Math.sin(t * (32 + 3 * variant)) + .026 * Math.sin(t * 96 + variant);
    phase += first * pitch * pulsePitch * (1 + vibrato + drift * .29) / CREATURE_SAMPLE_RATE;
    if (phase >= 1) {
      phase -= 1;
      cycle++;
      pulseGain = .85 + random() * .13;
      pulsePitch = 1 + random() * .09 * profile.grit;
    }
    const opening = .57 - open * .17;
    const local = Math.min(1, phase / opening);
    const flow = 4 * local * (1 - local);
    const falseFold = cycle % 2 === 0 ? 1 : 1 - profile.grit * .68;
    const folded = (flow - glottis) * (profile.duration > 2 ? 12 : 9) * pulseGain * falseFold;
    glottis = flow;
    breath += (fuzz - breath) * .221;
    const rasp = (fuzz - breath) * (.29 + flow * .47) * profile.grit;
    const coarse = Math.tanh(folded * 2.6 + breath * .51 * profile.grit);
    const pressure = voice * (.90 + .10 * Math.sin(t * (75 + 4 * variant)));
    const throatInput = pressure * (coarse + rasp * .43) + breath * air * .56;
    const mouthInput = pressure * (coarse * .70 + rasp * .41) + breath * air * .64;
    const airInput = (fuzz - breath) * (.38 + pressure * .10) * air + pressure * coarse * .28;
    const raw = resonate(throat, throatInput) * .63
      + resonate(mouth, mouthInput) * .40
      + resonate(nose, airInput) * .21 * profile.upper
      + resonate(teeth, airInput) * .14 * profile.upper
      + resonate(chest, coarse * pressure * falseFold) * (name === 'snarl' ? .36 : .14)
      + (fuzz - breath) * air * .043;
    dcBlocked = raw - previousOutput + .989 * dcBlocked;
    previousOutput = raw;
    const edge = Math.min(1, t / .018, (1 - progress) * 24);
    const result = dcBlocked * smooth(edge);
    samples[i] = result;
    peak = Math.max(peak, Math.abs(result));
  }
  const normalization = .70 / Math.max(.05, peak);
  for (let i = 0; i < samples.length; i++) samples[i] *= normalization;
  return samples;
}
