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
    throw Error('Office gaze check timed out: ' + label);
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

  await key('KeyC', false);
  const warning = await wait('front-on warning', s => s.officeGaze.looking && s.officeGaze.amount > .23);
  assert.equal(warning.deaths, 0);
  await screenshot('office-look-away');
  await key('KeyC', true);
  await wait('look away clears exposure', s => s.officeGaze.eyesDown && !s.officeGaze.looking);
  state = await wait('recover after audible warning', s => s.officeGaze.amount === 0 && s.audio.recentEffects.includes('voice-glance'));
  assert.equal(state.deaths, 0);

  await key('KeyC', false);
  const caught = await wait('sustained eye contact kills without touching', s => s.player.lifeState === 'dying');
  assert.equal(caught.deaths, 1);
  assert.equal(caught.death.ghost.kind, 'mourner');
  assert.ok(Math.abs(caught.player.x + 7 - caught.death.ghost.x) > 42);
  assert.ok(caught.log.some(e => e.type === 'death' && e.cause === 'eye-contact'));
  await screenshot('office-eye-contact-death');
  const revival = await wait('revival at the lamp', s => s.player.lifeState === 'alive');
  assert.equal(revival.phase, 'day');
  assert.equal(revival.officeGaze.amount, 0);
  assert.equal(revival.checkpoint, '1/lift-lobby/arrival');

  await tap('KeyX');
  await wait('Clerk visible again after shift', s => s.phase === 'night');
  await key('KeyC', true);
  await key('ArrowRight', true);
  await wait('ready to accelerate for a jump', s => {
    const ghost = s.ghosts.find(g => g.kind === 'mourner');
    return ghost.x - (s.player.x + 7) < 75;
  });
  await key('KeyC', false);
  await wait('launch from the clear run-up', s => {
    const ghost = s.ghosts.find(g => g.kind === 'mourner');
    return ghost.x - (s.player.x + 7) < 50;
  });
  await key('Space', true);
  await wait('get above the Clerk', s => !s.player.grounded && s.player.y < 166);
  await wait('land past the Clerk', s => s.player.grounded && s.player.x > 265);
  await stop();
  state = await snapshot();
  assert.equal(state.deaths, 1);
  await screenshot('office-jump-past');
  return { phase: state.phase, introduced: true, warned: warning.officeGaze.amount,
    caught: { x: caught.player.x, creature: caught.death.ghost.x }, checkpoint: revival.checkpoint, bypass: state.player.x };
}
