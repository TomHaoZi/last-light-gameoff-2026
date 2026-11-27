import assert from 'node:assert/strict';
import test from 'node:test';
import { Dialogue } from '../dist/3d/dialogue.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Chinese captions preload and play only the English guide recording', async t => {
  const requested = [];
  t.mock.method(globalThis, 'fetch', async url => {
    requested.push(new URL(url).pathname.split('/').at(-1));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
  });
  const { dialogue, sources, words } = fixture(t);
  dialogue.setLanguage('zh');
  dialogue.play('mourningGuide');
  await settle();
  assert.deepEqual(requested, ['mourning-guide-en.m4a']);
  assert.equal(sources.length, 1);
  assert.match(words.textContent, /[\u4e00-\u9fff]/);
  dialogue.setLanguage('en');
  assert.doesNotMatch(words.textContent, /[\u4e00-\u9fff]/);
  assert.equal(sources.length, 1, 'changing captions does not restart speech');
});

function fixture(t, decode = () => ({ duration: 1.8 })) {
  const speaker = {}, words = {};
  const caption = { hidden: true, querySelector: tag => tag === 'strong' ? speaker : words };
  const sources = [];
  const dialogue = new Dialogue({
    context: { decodeAudioData: decode },
    playDialogue() {
      const source = new EventTarget();
      source.stop = () => { source.stopped = true; };
      sources.push(source);
      return source;
    },
    stopDialogue(source) { source.stop(); }
  }, caption);
  for (const id of ['lost', 'evacuate', 'calling', 'trapped']) {
    dialogue.files.set(id, Promise.resolve(new ArrayBuffer(1)));
  }
  t.after(() => dialogue.stop());
  return { dialogue, caption, words, sources };
}

test('pausing an unfinished recording restarts that line before queued dialogue', async t => {
  const { dialogue, caption, words, sources } = fixture(t);
  dialogue.play('lost');
  dialogue.play('evacuate');
  await settle();
  assert.equal(words.textContent, 'I don’t know where I am.');
  dialogue.pause();
  assert.equal(caption.hidden, true);
  assert.equal(sources[0].stopped, true);
  sources[0].dispatchEvent(new Event('ended'));
  dialogue.play('lost');
  dialogue.setLanguage('zh');
  dialogue.resume();
  await settle();
  assert.equal(words.textContent, '我不知道我在哪儿。');
  assert.equal(sources.length, 2);

  sources[1].dispatchEvent(new Event('ended'));
  dialogue.pause();
  dialogue.resume();
  await settle();
  assert.equal(words.textContent, '快离开这里！');
  assert.equal(sources.length, 3);
});

test('changing chapters prevents pending recordings from starting, and a new shift can replay lines', async t => {
  let finishDecode;
  const decoding = new Promise(resolve => { finishDecode = resolve; });
  const { dialogue, caption, words, sources } = fixture(t, () => decoding);
  dialogue.play('calling');
  dialogue.stop();
  finishDecode({ duration: 2.6 });
  await settle();
  assert.equal(sources.length, 0);
  assert.equal(caption.hidden, true);

  dialogue.play('calling');
  await settle();
  sources[0].dispatchEvent(new Event('ended'));
  dialogue.stop();
  dialogue.play('calling');
  await settle();
  assert.equal(sources.length, 1);
  dialogue.reset();
  dialogue.play('calling');
  await settle();
  assert.equal(words.textContent, 'Sister? Are you there?');
  assert.equal(sources.length, 2);
});

test('the register changes by phase, the boiler knocks at its valve, and endings have distinct recordings', () => {
  const dialogue = new Dialogue({}, { querySelector: () => ({}) });
  const ids = [];
  const effects = [];
  dialogue.play = id => ids.push(id);
  dialogue.sound.cue = (...args) => effects.push(args);
  const valve = { kind: 'A', x: 4, z: 3 };
  const state = { levelIndex: 0, night: false, completed: new Set(), map: { stations: [valve] } };
  const story = station => dialogue.onGameEvent({ type: 'story', station }, state);
  const notice = id => dialogue.onGameEvent({ type: 'notice', id }, state);
  const sound = name => dialogue.onGameEvent({ type: 'sound', name }, state);
  notice('lamp');
  state.completed.add('B');
  notice('lamp');
  story('A');
  notice('locked');
  assert.deepEqual(effects, [['hatch', valve]]);
  state.levelIndex = 1;
  story('A');
  state.night = true;
  story('A');
  story('C');
  state.levelIndex = 2;
  notice('power');
  state.ending = 'normal';
  sound('ending');
  state.ending = 'complete';
  sound('ending');
  assert.deepEqual(ids, ['gap', 'doors', 'register', 'exchange', 'lunch', 'circuit', 'farewell', 'recovered']);
});

test('the two halves of a transmission have localized captions even without audio', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const speaker = {}, words = {};
  const caption = { hidden: true, querySelector: tag => tag === 'strong' ? speaker : words };
  const dialogue = new Dialogue({ context: null }, caption);
  dialogue.files.set('exchange', Promise.resolve(null));
  dialogue.play('exchange');
  assert.match(words.textContent, /number you have dialled/);
  t.mock.timers.tick(3310);
  assert.match(words.textContent, /hang up/);
  dialogue.setLanguage('zh');
  assert.equal(words.textContent, '请挂断，稍后再拨。');
  dialogue.stop();
  t.mock.timers.tick(4000);
  assert.equal(caption.hidden, true);
});
