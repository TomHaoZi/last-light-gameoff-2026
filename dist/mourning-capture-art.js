import { drawClerkForearms, drawContactDrops, drawJanitor, drawJanitorCapture, drawMourningClerk } from './actor-art.js';
import { MOURNING_CAPTURE } from './mourning-clerk.js';

const blend = (start, end, value) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

export function mourningShot(world) {
  const p = world.player;
  const reduced = world.reducedEffects;
  if (p.lifeState === 'dying' && world.death?.ghost?.kind === 'mourner') {
    const { time, ghost, x, y } = world.death;
    const away = Math.sign(x + 7 - ghost.x) || -p.dir;
    const close = blend(0, MOURNING_CAPTURE.close, time);
    const recoil = blend(MOURNING_CAPTURE.recoil, MOURNING_CAPTURE.impact, time);
    const grip = close * (1 - recoil);
    return {
      kind: 'capture', ghost, away, x: x + 7, feet: y + 28, bloodTime: reduced ? 0 : time - .17,
      lift: grip * (reduced ? 2 : 13 + Math.sin(time * 12) * 2 * close),
      tilt: grip * .27 + recoil * (reduced ? .45 : 1.49),
      slide: recoil * (reduced ? 2 : 8),
      grip,
      reach: (1 - recoil) * .77 + .23 * grip,
      dim: .25 * close + .19 * grip,
      dropCap: reduced ? 0 : blend(.76, 1.05, time),
      blackout: blend(MOURNING_CAPTURE.blackout, MOURNING_CAPTURE.duration, time),
      dust: reduced ? 0 : blend(.93, .99, time) * (1 - blend(1, 1.18, time)),
      keylight: .22 + grip * .14
    };
  }
  if (p.lifeState === 'respawning' && p.mourningRevival) {
    const time = p.lifeTime;
    const stand = blend(.22, MOURNING_CAPTURE.revival - .05, time);
    return {
      kind: 'revive', x: p.x + 7, feet: p.y + 28, away: p.dir, lift: 0,
      tilt: (1 - stand) * (reduced ? .39 : 1.04),
      dropCap: (1 - stand) * (reduced ? 0 : .68),
      blackout: 1 - blend(.025, .39, time),
      idle: blend(.71, MOURNING_CAPTURE.revival, time),
      keylight: .38 + stand * .12,
      appeal: (1 - stand) * .6
    };
  }
  return null;
}

export function drawMourningShot(a, shot) {
  const c = a.c;
  const x = shot.x - a.cam;
  c.save();
  if (shot.kind === 'capture') {
    const gx = shot.ghost.x - a.cam + shot.away * shot.grip * 2;
    const gy = shot.ghost.y - shot.grip * 3;
    c.globalAlpha = shot.dim;
    a.rect(0, a.viewTop, 480, 247, '#182934');
    c.globalAlpha = 1;
    a.glow(x, shot.feet - 14, 69, 51, '#807664', shot.keylight);

    // The reaching forearms and the falling coat stay on separate layers.
    drawMourningClerk(a, { looking: true, charging: true, gaze: .62, facing: shot.away,
      capture: true }, gx, gy);
    const target = drawJanitorCapture(a, {
      x: x + shot.away * shot.slide, feet: shot.feet,
      direction: shot.away, tilt: shot.tilt, lift: shot.lift,
      appeal: shot.grip, dropCap: shot.dropCap
    });
    drawClerkForearms(a, gx, gy, target, shot.away, shot.reach);
    drawContactDrops(a,x,shot.feet-22-shot.lift,shot.bloodTime,shot.away);
    if (shot.dust > .01) {
      c.globalAlpha = shot.dust * .60;
      for (let k = 0; k < 6; k++) {
        const spread = (k % 2 ? 1 : -1) * (6 + k * 2 + (1 - shot.dust) * 12);
        a.rect(x + spread + shot.away * shot.slide, shot.feet - 2 - (k % 3) * 2, 3 + k % 2, 2, '#a9a588');
      }
    }
  } else {
    a.glow(x - 3, shot.feet - 25, 49, 51, '#f1bf6d', shot.keylight);
    drawJanitorCapture(a, { x, feet: shot.feet, direction: shot.away, tilt: shot.tilt,
      lift: 0, appeal: shot.appeal, dropCap: shot.dropCap, opacity: 1 - shot.idle });
    if (shot.idle > 0) {
      c.globalAlpha = shot.idle;
      c.translate(x, shot.feet);
      c.scale(shot.away, 1);
      c.translate(-7, -28);
      drawJanitor(a, 0, [0, 0], 0, 0, true, false, shot.away);
    }
  }
  c.restore();
}

export function drawMourningFade(a, shot) {
  if (shot.blackout <= 0) return;
  const c = a.c;
  c.save();
  c.globalAlpha = shot.blackout;
  a.rect(0, 0, 480, 246, '#172632');
  c.restore();
}
