const smooth = (a, b, time) => {
  const x = Math.max(0, Math.min(1, (time - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export const SHIFT_SHOTS = Object.freeze({ arrival: 2.9, success: 2.2 });

export function shiftShot(kind, time, reduced = false) {
  if (kind === 'arrival') {
    const wrist = smooth(.12, .70, time) * (1 - smooth(1.64, 2.48, time));
    return {
      kind, wrist: reduced ? 0 : wrist,
      black: (1 - smooth(.04, .73, time)) * (reduced ? .49 : .86),
      caption: smooth(.42, .81, time) * (1 - smooth(2.19, 2.81, time)),
      pitch: reduced ? 0 : -.078 * wrist
    };
  }
  const forward = smooth(0, 1.11, time);
  return {
    kind, forward: reduced ? 0 : forward * .42,
    pitch: reduced ? 0 : .046 * forward,
    black: reduced ? 0 : .41 * (1 - smooth(.05, 1.03, time)),
    caption: smooth(.37, 1.34, time)
  };
}

export function ordinaryLifeShot(life, kind, time, reduced = false) {
  if (life === 'dying') {
    const caught = kind === 'ghost' || kind === 'gaze';
    const fall = kind === 'fall';
    const drop = smooth(caught ? .37 : .10, caught ? .92 : .66, time);
    const brace = smooth(0, .16, time) * (1 - smooth(.38, .83, time));
    return {
      drop, brace, descent: reduced ? 0 : drop * (fall ? .40 : 1.10),
      pitch: reduced ? 0 : -(fall ? .28 : .19) * drop,
      roll: reduced ? 0 : drop * (caught ? -.24 : .23),
      black: smooth(.44, 1.02, time), caption: smooth(.22, .46, time)
    };
  }
  if (life !== 'respawning') return null;
  const returnToFeet = smooth(.13, .65, time);
  return {
    drop: 0, brace: 1 - returnToFeet,
    descent: reduced ? 0 : .57 * (1 - returnToFeet),
    pitch: reduced ? 0 : -.105 * (1 - returnToFeet),
    roll: reduced ? 0 : .06 * (1 - returnToFeet),
    black: 1 - smooth(.04, .38, time),
    caption: smooth(.06, .23, time) * (1 - smooth(.38, .67, time)),
    revival: true
  };
}
