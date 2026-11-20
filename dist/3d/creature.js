import { MathUtils } from 'three';
import { makeCreatureBody, animateCreatureBody } from './creature-body.js';
import { createSculptedHead, animateSculptedHead } from './creature-head.js';

const { smoothstep } = MathUtils;

export function createCreature(index = 0, theme = 0) {
  const seed = (index + 1) * 1.81 + theme * .49;
  const body = makeCreatureBody(theme, seed);
  const face = createSculptedHead(theme, seed);
  face.group.position.y = -.018;
  body.neck.add(face.group);
  const { group } = body;
  group.scale.set(1 + (index % 3 - 1) * .028, 1 + (index % 3 - 1) * .022, 1);
  return { group, body, face, head: face.group, seed, movementTime: 0 };
}

export function updateCreature(actor, { time, threat, attack, night, distance, reduced, moving, dt, travel }) {
  const urgency = smoothstep(threat, .26, .89);
  const reach = Math.max(attack, urgency * (1 - smoothstep(distance, .70, 3.85)));
  if (moving) actor.movementTime += Math.min(dt * 2.1, travel * .56);
  animateCreatureBody(actor.body, {
    time, threat, reach, moving, reduced, movementTime: actor.movementTime
  });

  const breath = Math.sin(time * 3.3 + actor.seed);
  const glance = Math.sin(time * 2.6 + actor.seed) * (1 - urgency);
  actor.body.torso.rotation.z += .052 * Math.sin(actor.seed);
  actor.body.torso.rotation.x += .045 * (1 - reach);
  const flinch = reduced ? 0 : Math.sin(time * 14.1 + actor.seed) * .016 * urgency;
  actor.body.neck.rotation.set(
    -.095 - urgency * .11 - reach * .22 + breath * .028,
    glance * .16 + flinch,
    .035 + glance * .048 - reach * .042
  );
  const yell = smoothstep(threat, .32, .77) * (.24 + .48 * Math.abs(Math.sin(time * 4.1 + actor.seed)));
  animateSculptedHead(actor.face, {
    jaw: MathUtils.clamp(.046 + yell * .30 + reach * .13 + attack * .38 + breath * .021, 0, .83),
    night,
    threat,
    time
  });
}
