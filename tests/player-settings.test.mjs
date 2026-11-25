import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerSettings, difficultyRules } from '../dist/player-settings.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('edition preferences survive reload without sharing bindings or changing progress', () => {
  const storage = memoryStorage();
  storage.setItem('last-light-3d-v1', 'saved-progress');
  const classic = createPlayerSettings('2d', storage);
  assert.equal(classic.actionFor('ShiftLeft'), 'shift');
  assert.equal(classic.rebind('shift', 0, 'KeyQ').ok, true);
  assert.equal(classic.setDifficulty('easy'), true);
  const reloaded = createPlayerSettings('2d', storage);
  assert.equal(reloaded.actionFor('KeyQ'), 'shift');
  assert.equal(reloaded.actionFor('ShiftRight'), 'shift');
  assert.equal(reloaded.actionFor('ShiftLeft'), null);
  assert.equal(reloaded.difficulty, 'easy');
  const firstPerson = createPlayerSettings('3d', storage);
  assert.equal(firstPerson.actionFor('ShiftLeft'), 'sprint');
  assert.equal(firstPerson.actionFor('KeyX'), 'shift');
  assert.equal(firstPerson.difficulty, 'normal');
  assert.equal(storage.getItem('last-light-3d-v1'), 'saved-progress');
});

test('conflict handling swaps atomically and preserves a reachable key for each action', () => {
  const prefs = createPlayerSettings('3d', memoryStorage());
  assert.deepEqual(prefs.rebind('shift', 0, 'KeyE'), {ok: false, reason: 'conflict', action: 'interact', slot: 0});
  assert.equal(prefs.actionFor('KeyX'), 'shift');
  assert.equal(prefs.rebind('shift', 1, 'KeyE', true).reason, 'required');
  assert.equal(prefs.rebind('shift', 0, 'KeyE', true).ok, true);
  assert.equal(prefs.actionFor('KeyX'), 'interact');
  assert.equal(prefs.rebind('shift', 0, null).reason, 'required');
  assert.equal(prefs.rebind('pause', 0, 'KeyE', true).reason, 'invalid');
  assert.equal(prefs.rebind('pause', 1, 'KeyP').ok, true);
  assert.equal(prefs.rebind('pause', 0, null).ok, true);
  prefs.resetBindings();
  assert.equal(prefs.actionFor('Escape'), 'pause');
  assert.equal(prefs.actionFor('KeyE'), 'interact');
});

test('damaged data and blocked storage preserve default controls and a working session', () => {
  const storage = memoryStorage();
  storage.setItem('last-light-2d-player-settings', JSON.stringify({
    difficulty: 'unknown', bindings: { left: ['KeyM'] }
  }));
  const restored = createPlayerSettings('2d', storage);
  assert.equal(restored.difficulty, 'normal');
  assert.equal(restored.actionFor('ArrowLeft'), 'left');
  assert.equal(restored.actionFor('KeyM'), 'mute');
  const blocked = createPlayerSettings('3d', {
    getItem() { throw Error('blocked'); },
    setItem() { throw Error('blocked'); }
  });
  assert.equal(blocked.rebind('walk', 0, 'ControlLeft').ok, true);
  assert.equal(blocked.actionFor('ControlLeft'), 'walk');
  assert.equal(blocked.setDifficulty('hard'), true);
  assert.equal(blocked.difficulty, 'hard');
  assert.ok(difficultyRules('hard').gazeDelay < difficultyRules('easy').gazeDelay);
});
