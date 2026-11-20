import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineAudioContext } from 'node-web-audio-api';
import { HorrorAudio } from '../dist/3d/audio.js';

test('audio directions follow the rotating listener and distant sounds decay', () => {
  const sound = new HorrorAudio();
  sound.update({ x: 1, z: 7, yaw: Math.PI / 2 });
  assert.ok(sound.spatial({ x: 1, z: 11 }).pan > 0.8);
  assert.ok(sound.spatial({ x: 1, z: 3 }).pan < -0.8);
  assert.ok(sound.spatial({ x: 1, z: 9 }).amplitude > sound.spatial({ x: 1, z: 12 }).amplitude);
  sound.update({ x: 0, z: 0, yaw: 0 });
  assert.equal(sound.spatial({ x: 0, z: -1 }).pan, 0);
  assert.ok(sound.spatial({ x: 3, z: -1 }).pan > 0.6);
});

test('three room transitions, threats and overlapping effects produce bounded stereo PCM', async () => {
  const rate = 48_000;
  const seconds = 11;
  const context = new OfflineAudioContext(2, seconds * rate, rate);
  const sound = new HorrorAudio();
  sound.initialize(context);
  const cues = new Map([
    [2, 'step'], [6, 'interact'], [11, 'pickup'], [22, 'door'], [35, 'shift'],
    [42, 'warning'], [43, 'howl'], [45, 'blocked'], [49, 'jump'], [52, 'land'], [59, 'hit'],
    [63, 'snarl'],
    [66, 'death'], [79, 'revive'], [89, 'ending'],
  ]);

  function scene(frame) {
    const level = frame < 35 ? 0 : frame < 70 ? 1 : 2;
    const night = frame >= 35;
    const tension = frame >= 43 && frame < 69 ? 0.86 : 0;
    const ghosts = frame >= 35 && frame < 71 ? [{ x: frame / 7 - 8, z: -3 }] : [];
    sound.update({ x: 0, z: 0, yaw: 0, level, night, tension, ghosts });
    const cue = cues.get(frame);
    if (cue === 'step') sound.cue(cue, { surface: 'metal' });
    else if (cue === 'door' || cue === 'warning') sound.cue(cue, { x: 4, z: -1 });
    else if (cue === 'howl') sound.cue(cue, { x: 12, z: 2 });
    else if (cue === 'snarl' || cue === 'death') sound.cue(cue, { x: -.44, z: -.43 });
    else if (cue) sound.cue(cue);
  }

  const updates = Array.from({ length: 100 }, (_, frame) => (
    context.suspend(0.085 + frame * 0.105).then(() => {
      scene(frame);
      return context.resume();
    })
  ));
  const buffer = await context.startRendering();
  await Promise.all(updates);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  let peak = 0;
  let stereoDifference = 0;
  for (let index = 0; index < left.length; index++) {
    if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) {
      assert.fail(`Non-finite stereo sample at frame ${index}`);
    }
    stereoDifference += Math.abs(left[index] - right[index]);
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  assert.ok(peak > 0.05 && peak < 0.98, `Unexpected stereo peak ${peak}`);
  assert.ok(stereoDifference / left.length > 0.003, 'Positional mix rendered effectively mono');
});

test('a live howl follows the listener and stays silent after the ghost changes phase', async () => {
  const rate = 24_000;
  const context = new OfflineAudioContext(2, 3 * rate, rate);
  const audio = new HorrorAudio();
  audio.initialize(context);
  audio.roomBus.gain.value = 0;
  audio.scoreBus.gain.value = 0;
  // Room reflections can ring out after the dry positional emitter stops.
  audio.wet.disconnect();

  const ghost = { x: 11, z: 0, key: 'ghost-0', active: true };
  const transitions = [
    [0.16, () => {
      audio.update({ ghosts: [ghost] });
      audio.cue('howl', ghost);
    }],
    [0.41, () => {
      audio.cue('howl', ghost);
      assert.equal(audio.vocalEmitters.size, 1, 'a second call inside cooldown spawned another howl');
    }],
    [1.18, () => audio.update({ yaw: Math.PI, ghosts: [ghost] })],
    [1.83, () => {
      ghost.active = false;
      audio.update({ yaw: Math.PI, ghosts: [ghost] });
    }],
    [2.08, () => {
      ghost.active = true;
      audio.update({ yaw: Math.PI, ghosts: [ghost] });
    }],
  ];

  const updates = transitions.map(([time, apply]) => context.suspend(time).then(() => {
    apply();
    return context.resume();
  }));
  const rendered = await context.startRendering();
  await Promise.all(updates);

  function energy(channel, start, end) {
    const samples = rendered.getChannelData(channel);
    const first = Math.round(start * rate);
    const last = Math.round(end * rate);
    let total = 0;
    for (let i = first; i < last; i++) total += samples[i] ** 2;
    return total / (last - first);
  }
  assert.ok(energy(1, .66, .95) > .00005, 'distant vocal is inaudible');
  assert.ok(energy(1, .66, .95) > 3 * energy(0, .66, .95), 'source did not start to the right');
  assert.ok(energy(0, 1.39, 1.66) > 3 * energy(1, 1.39, 1.66), 'source did not move left on listener rotation');
  assert.ok(energy(0, 1.98, 2.07) < energy(0, 1.39, 1.66) / 250, 'inactive ghost continues calling');
  assert.ok(energy(0, 2.23, 2.40) < energy(0, 1.39, 1.66) / 250, 'an interrupted call resumed after a second shift');
});
