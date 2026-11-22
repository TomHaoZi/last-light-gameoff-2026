import assert from 'node:assert/strict';
import test from 'node:test';
import { Dialogue } from '../dist/3d/dialogue.js';

const settle = () => new Promise(resolve => setImmediate(resolve));

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
