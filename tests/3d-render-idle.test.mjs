import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForRenderIdle } from '../dist/3d/render-idle.js';

test('texture and shader work share one idle slot per rendered frame', async t => {
  const frames = [];
  const idle = [];
  const originalFrame = globalThis.requestAnimationFrame;
  const originalIdle = globalThis.requestIdleCallback;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  globalThis.requestIdleCallback = callback => idle.push(callback);
  t.after(() => {
    if (originalFrame) globalThis.requestAnimationFrame = originalFrame;
    else delete globalThis.requestAnimationFrame;
    if (originalIdle) globalThis.requestIdleCallback = originalIdle;
    else delete globalThis.requestIdleCallback;
  });

  const work = [];
  const first = waitForRenderIdle().then(() => work.push('texture'));
  const second = waitForRenderIdle().then(() => work.push('shader'));
  const advance = async budget => {
    assert.equal(frames.length, 1);
    frames.shift()();
    assert.equal(idle.length, 1);
    idle.shift()({ timeRemaining: () => budget });
    await Promise.resolve();
  };

  await advance(1);
  assert.deepEqual(work, []);
  await advance(9);
  assert.deepEqual(work, ['texture']);
  await advance(9);
  await Promise.all([first, second]);
  assert.deepEqual(work, ['texture', 'shader']);
  assert.equal(frames.length, 0);
});
