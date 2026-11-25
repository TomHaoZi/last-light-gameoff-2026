const fullTurn = Math.PI * 2;
const smooth = (value, low, high) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

function settle(t, damping, frequency) {
  if (t <= 0) return 0;
  if (t >= 1.55) return 1;
  const angle = t * frequency;
  return 1 - Math.exp(-t * damping) * (Math.cos(angle) + damping / frequency * Math.sin(angle));
}

export function stationAge(motion, complete, time) {
  if (motion.complete !== complete) {
    // A restored completion is shown already at rest, with no repeated burst.
    motion.start = motion.complete === false && complete ? time : -Infinity;
    motion.complete = complete;
  }
  return complete ? time - motion.start : -1;
}

export function stationPose(theme, age, reduced = false) {
  if (theme === 0) {
    const value = settle(age, 7.4, 8.9);
    const needle = settle(age - .14, 4.5, 7.4);
    const steam = 1 - smooth(age, .08, 1.18);
    return { action: 2.08 * value, meter: needle, discharge: steam };
  }
  if (theme === 1) {
    const press = smooth(age, 0, .16) * (1 - smooth(age, .26, .55));
    const open = smooth(age, .21, .48);
    const returning = smooth(age, .48, 1.25);
    const rebound = reduced || age < .66 || age >= 1.24 ? 0 :
      .025 * Math.sin((age - .66) * 19) * (1 - smooth(age, .66, 1.24));
    return { action: .29 * press + .083 * smooth(age, .31, .58),
      meter: press + .22 * smooth(age, .35, .58), leaf: .42 * open * (1 - returning) + rebound };
  }
  const valve = settle(age, 7, 10);
  return { action: -.48 + 1.05 * valve, meter: settle(age - .19, 5.9, 8.1),
    discharge: smooth(age, .14, .52) * (1 - smooth(age, .88, 1.48)) };
}

export function hazardBeat(tile, time) {
  return (time + tile.col * .27 + tile.row * .19) % 3;
}

export function hazardInPhase(tile, night) {
  return tile?.kind === (night ? '!' : '~');
}

export function hazardDischarging(beat) {
  return beat > 1.24 && beat < 2.53;
}

export function hazardPressure(beat) {
  return smooth(beat, 1.05, 1.46) * (1 - smooth(beat, 2.36, 2.68));
}

export function rotorStep(motor, elapsed, night, reduced = false) {
  const target = motor.speed * (night ? .08 : 1) * (reduced ? .32 : 1);
  const start = motor.omega ?? target;
  const response = target > start ? 3.6 : 1.55;
  const tail = Math.exp(-elapsed * response);
  motor.omega = target + (start - target) * tail;
  // Integrate the changing speed across this frame, including the cooldown.
  return (target * elapsed + (start - target) * (1 - tail) / response) % fullTurn;
}

export function liftMotion(opening) {
  const latch = smooth(opening, .025, .20);
  const ease = smooth(opening, .19, .92);
  const settlePhase = smooth(opening, .81, 1);
  const stop = .036 * Math.sin(settlePhase * fullTurn) * (1 - settlePhase);
  return { latch, turn: ease * 1.46 + stop };
}
