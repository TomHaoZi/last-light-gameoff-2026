import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerSettings, difficultyRules, MOUSE_RIGHT, keyLabel } from '../dist/player-settings.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
}

test('edition preferences survive reload without sharing bindings or changing progress', () => {
  const storage = memoryStorage();
  storage.setItem('last-light-3d-v1', 'saved-progress');
  const classic = createPlayerSettings('2d', storage);
  assert.equal(classic.keys('shift')[0], MOUSE_RIGHT);
  assert.equal(classic.actionFor('ShiftLeft'), 'shift');
  assert.equal(classic.actionFor('KeyX'), null);
  assert.equal(classic.rebind('shift', 0, 'KeyQ').ok, true);
  assert.equal(classic.setDifficulty('easy'), true);
  const reloaded = createPlayerSettings('2d', storage);
  assert.equal(reloaded.actionFor('KeyQ'), 'shift');
  assert.equal(reloaded.actionFor('ShiftRight'), 'shift');
  assert.equal(reloaded.actionFor(MOUSE_RIGHT), null);
  assert.equal(reloaded.difficulty, 'easy');
  const firstPerson = createPlayerSettings('3d', storage);
  assert.equal(firstPerson.actionFor('ShiftLeft'), 'sprint');
  assert.equal(firstPerson.actionFor(MOUSE_RIGHT), 'shift');
  assert.equal(firstPerson.actionFor('KeyX'), null);
  assert.equal(firstPerson.difficulty, 'normal');
  assert.equal(storage.getItem('last-light-3d-v1'), 'saved-progress');
});

test('conflict handling swaps atomically and preserves a reachable key for each action', () => {
  const prefs = createPlayerSettings('3d', memoryStorage());
  assert.deepEqual(prefs.rebind('shift', 0, 'KeyE'), {ok: false, reason: 'conflict', action: 'interact', slot: 0});
  assert.equal(prefs.actionFor(MOUSE_RIGHT), 'shift');
  assert.equal(prefs.rebind('shift', 1, 'KeyE', true).reason, 'required');
  assert.equal(prefs.rebind('shift', 0, 'KeyE', true).ok, true);
  assert.equal(prefs.actionFor(MOUSE_RIGHT), 'interact');
  assert.equal(prefs.rebind('shift', 0, null).reason, 'required');
  assert.equal(prefs.rebind('pause', 0, 'KeyE', true).reason, 'invalid');
  assert.equal(prefs.rebind('pause', 1, 'KeyP').ok, true);
  assert.equal(prefs.rebind('pause', 0, null).ok, true);
  prefs.resetBindings();
  assert.equal(prefs.actionFor('Escape'), 'pause');
  assert.equal(prefs.actionFor('KeyE'), 'interact');
  assert.equal(prefs.actionFor(MOUSE_RIGHT), 'shift');
});

test('legacy default X migrates in each edition, and new X custom bindings stay saved', () => {
  const storage = memoryStorage();
  const old = {
    '2d': ['ShiftLeft', 'ShiftRight', 'KeyX'],
    '3d': ['KeyX', null, null]
  };
  for (const [edition, shift] of Object.entries(old)) {
    const key = 'last-light-' + edition + '-player-settings';
    const legacy = JSON.stringify({difficulty: 'hard', bindings: {shift, walk: ['KeyQ']}});
    storage.setItem(key, legacy);
    const prefs = createPlayerSettings(edition, storage);
    assert.equal(prefs.actionFor(MOUSE_RIGHT), 'shift');
    assert.equal(prefs.actionFor('KeyX'), null);
    assert.equal(prefs.actionFor('KeyQ'), 'walk');
    assert.equal(prefs.difficulty, 'hard');
    assert.equal(storage.getItem(key), legacy);
    assert.equal(prefs.rebind('shift', 0, 'KeyX').ok, true);
    assert.equal(createPlayerSettings(edition, storage).actionFor('KeyX'), 'shift');
  }
  storage.setItem('last-light-3d-player-settings', JSON.stringify({
    bindings: {shift: ['KeyT', 'KeyX']}
  }));
  assert.equal(createPlayerSettings('3d', storage).actionFor('KeyX'), 'shift');
  assert.equal(keyLabel(MOUSE_RIGHT, 'zh'), '鼠标右键');
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
