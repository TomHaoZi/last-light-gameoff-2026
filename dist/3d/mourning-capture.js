export const CLERK_CAPTURE_TIME = 1.44;
export const CLERK_REVIVAL_TIME = .84;

// The picture, hand poses and one-shot cues advance on the same game clock.
export const CLERK_CAPTURE_CUES = [
  { at: .27, name: 'mourning-bind' },
  { at: .88, name: 'mourning-floor' }
];

const beats = [
  [0, 'contact'], [.18, 'hold'], [.40, 'shroud'], [.66, 'fall'], [1.17, 'blackout']
];

const curve = (value, start, end) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function clerkCaptureFrame(state, reduced = false) {
  if (!state.mourningCapture) return null;
  const time = state.lifeTimer;
  const side = state.mourningCapture.side;
  if (state.life === 'respawning') {
    const rise = curve(time, .14, .79);
    return {
      beat: 'revival', time, side, rise,
      veil: 1 - curve(time, .06, .37),
      caption: curve(time, .11, .26) * (1 - curve(time, .49, .81)),
      brace: curve(time, .16, .30) * (1 - curve(time, .45, .74)),
      stretch: .83 * (1 - rise) * (reduced ? .34 : 1)
    };
  }
  if (state.life !== 'dying') return null;

  let beat = 'contact';
  for (const [at, name] of beats) {
    if (time >= at) beat = name;
  }
  const reset = curve(time, 1.02, 1.28);
  const grip = curve(time, .055, .25) * (1 - curve(time, .62, .89));
  const cover = curve(time, .26, .53) * (1 - curve(time, .75, 1.16));
  const drop = curve(time, .62, .92);
  const impulse = curve(time, 0, .11) * (1 - curve(time, .14, .33));
  const resistance = curve(time, .19, .30) * (1 - curve(time, .38, .62));
  const intensity = reduced ? .38 : 1;
  return {
    beat, time, side, grip, cover, drop, impulse, resistance,
    reach: .84 + .16 * curve(time, 0, .15) - .71 * curve(time, .64, 1.09),
    brace: (.93 * curve(time, .01, .14) - .18 * curve(time, .23, .32) +
      .23 * curve(time, .34, .44)) * (1 - curve(time, .59, .9)),
    veil: Math.min(1, .38 * cover + curve(time, .98, 1.36)),
    caption: curve(time, .77, 1.04),
    aim: curve(time, .005, .29) * (1 - .18 * drop),
    recoil: (.33 * impulse + .23 * grip + .28 * drop) * intensity,
    slide: side * (.09 * resistance + .12 * drop) * intensity,
    stretch: (1.13 * drop - .045 * resistance) * intensity,
    roll: side * (.055 * impulse - .089 * grip + .25 * drop) * intensity,
    lens: (3.3 * impulse - 5.2 * cover + 3.7 * drop) * intensity,
    lamp: Math.min(1, 1 - .53 * cover - .22 * drop + .11 * resistance),
    grit: (.41 * impulse + .22 * cover + .14 * (drop - reset)) * intensity
  };
}
