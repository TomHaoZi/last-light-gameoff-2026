import assert from 'node:assert/strict';

// Focused browser acceptance. The lobby save only selects the starting room.
// Every gesture, phase change, catch and revival below uses the real controls.
export async function playOfficeGaze({snapshot, key, tap, stop, sleep, screenshot, evaluate}) {
  const wait = async (label, condition, timeout = 3500) => {
    const deadline = Date.now() + timeout;
    do {
      const state = await snapshot();
      if (condition(state)) return state;
      await sleep(16);
    } while (Date.now() < deadline);
    const state = await snapshot();
    throw Error(`Office gaze check timed out: ${label} at x=${state.player.x.toFixed(2)}, y=${state.player.y.toFixed(2)} (${state.player.lifeState}, ${state.phase}, ${state.deaths} deaths)`);
  };

  let state = await wait('entry guide', s => s.floor === 1 && s.sector === 0 &&
    s.log.some(e => e.type === 'mourning-guide'));
  assert.equal(state.deaths, 0);
  assert.match(await evaluate("document.getElementById('status').textContent"), /Mourning Clerk/);
  await key('ArrowRight', true);
  await wait('replaying the in-world note', s => s.player.x > 85);
  await stop();
  await tap('KeyE');
  await wait('manual recording and decoded voice', s => s.log.some(e => e.type === 'mourning-guide' && e.manual) &&
    s.audio.recentEffects.includes('voice-guide'));
  await screenshot('office-recording');

  await tap('KeyX');
  await wait('night Clerk', s => s.phase === 'night' &&
    s.ghosts.some(g => g.kind === 'mourner' && g.spawned && g.state !== 'dormant'));
  await key('KeyC', true);
  await key('ArrowRight', true);
  await wait('approach with eyes down', s => s.player.x > 167);
  await key('ArrowRight', false);
  await sleep(2540);
  state = await snapshot();
  assert.equal(state.officeGaze.eyesDown, true);
  assert.equal(state.officeGaze.amount, 0);
  assert.equal(state.deaths, 0);
  await screenshot('office-eyes-down');

  const position = state => state.ghosts.find(g => g.kind === 'mourner').x;
  const home = position(state);
  await key('KeyC', false);
  const warning = await wait('front-on warning, followed by physical advance',
    s => s.officeGaze.looking && position(s) < home - 5 && s.player.lifeState === 'alive');
  assert.equal(warning.deaths, 0);
  await key('KeyC', true);
  const averted = await wait('look away stops the charge', s => s.officeGaze.eyesDown && !s.officeGaze.looking);
  state = await wait('recover after audible warning', s => s.officeGaze.amount === 0 && s.audio.recentEffects.includes('voice-glance'));
  assert.equal(position(state), position(averted));
  assert.equal(state.deaths, 0);
  await screenshot('office-look-away');

  await key('KeyC', false);
  const caught = await wait('sustained eye contact leads to an actual collision', s => s.player.lifeState === 'dying');
  assert.equal(caught.deaths, 1);
  assert.equal(caught.death.ghost.kind, 'mourner');
  assert.ok(Math.abs(caught.player.x + 7 - caught.death.ghost.x) <= 13);
  assert.ok(caught.log.some(e => e.type === 'death' && e.cause === 'eye-contact'));
  const hold = await wait('the Clerk draws Eli up', s => s.death?.time > .36 && s.death.time < .68);
  await screenshot('office-capture-hold');
  const release = await wait('Eli drops back to the floor', s => s.death?.time > .95 && s.death.time < 1.18);
  await screenshot('office-capture-release');
  const recovery = await wait('revival animation plays under the lamp', s => s.player.mourningRevival && s.player.lifeTime >= .36);
  await screenshot('office-lamp-revival');
  const revival = await wait('revival at the lamp', s => s.player.lifeState === 'alive');
  assert.equal(revival.phase, 'day');
  assert.equal(revival.officeGaze.amount, 0);
  assert.equal(revival.checkpoint, '1/lift-lobby/arrival');

  await tap('KeyX');
  await wait('Clerk visible again after shift', s => s.phase === 'night');
  await key('KeyC', true);
  await key('ArrowRight', true);
  await wait('lowered eyes at the jump takeoff', s => position(s) - (s.player.x + 7) < 46);
  await key('Space', true);
  await key('KeyC', false);
  await wait('get above the Clerk', s => !s.player.grounded && s.player.y < 178);
  await wait('land past the Clerk', s => s.player.grounded && s.player.x > 265);
  await stop();
  state = await snapshot();
  assert.equal(state.deaths, 1);
  await screenshot('office-jump-past');
  return { phase: state.phase, introduced: true, warned: warning.officeGaze.amount,
    charge: { from: home, averted: position(averted) },
    caught: { x: caught.player.x, creature: caught.death.ghost.x },
    beats: { hold: hold.death.time, release: release.death.time, recovery: recovery.player.lifeTime },
    checkpoint: revival.checkpoint, bypass: state.player.x };
}
