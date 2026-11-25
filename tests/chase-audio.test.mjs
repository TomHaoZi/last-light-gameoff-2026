import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { OfflineAudioContext } from 'node-web-audio-api';
import { ChaseScore } from '../dist/3d/chase-score.js';
import { HorrorAudio } from '../dist/3d/audio.js';
import { Sound } from '../dist/audio.js';

const base = { elapsed: 3, danger: .7, progress: .3, obstacle: null, threat: { x: 0, z: 6 } };

test('the chase runs on the game clock and detaches when muted, paused, rewound or finished', async () => {
  for (const spatial of [false, true]) {
    const context = new OfflineAudioContext(2, 24_000, 24_000);
    const audio = spatial ? new HorrorAudio() : new Sound();
    if (spatial) audio.initialize(context);
    else {
      const previous = globalThis.AudioContext;
      globalThis.AudioContext = function() { return new Proxy(context, {
        get(target, key) {
          if (key === 'resume') return async () => {};
          const v = Reflect.get(target, key, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      }); };
      try { await audio.start(); } finally {
        clearInterval(audio.timer);
        if (previous) globalThis.AudioContext = previous; else delete globalThis.AudioContext;
      }
    }
    const update = (state, paused = false) => {
      if (spatial) audio.update({ chase: state, paused });
      else { audio.setFocus(!paused); audio.setChase(state); }
    };
    const mute = value => spatial ? audio.setMuted(value) : audio.mute(value);
    update(base);
    const first = audio.chaseScore.live;
    assert.ok(first.sources.size);
    const step = first.next;
    update(base);
    assert.equal(first.next, step, 'a repeated render frame cannot double-trigger the score');
    update({ ...base, elapsed: 7 });
    assert.ok(first.next > step + 30);
    assert.ok(first.sources.size < 32, 'a slow frame cannot replay several seconds at once');
    update({ ...base, elapsed: 0, progress: 0 });
    const retried = audio.chaseScore.live;
    assert.notEqual(retried, first);
    mute(true);
    update(base);
    assert.equal(audio.chaseScore.live, null);
    mute(false);
    update(base);
    const resumed = audio.chaseScore.live;
    assert.ok(resumed);
    update(base, true);
    assert.equal(audio.chaseScore.live, null);
    update(base);
    const final = audio.chaseScore.live;
    update(null);
    await context.startRendering();
    assert.equal(audio.chaseScore.live, null);
    for (const group of [first, retried, resumed, final]) assert.equal(group.sources.size, 0);
  }
});

test('rear roar tracks listener yaw and decays to silence when the chase ends', async () => {
  const rate = 24_000, context = new OfflineAudioContext(2, rate * 2, rate);
  const music = context.createGain(), fx = context.createGain();
  fx.connect(context.destination); // Isolate the pursuer so music cannot hide an inverted direction.
  const bytes = await readFile(new URL('../dist/3d/audio/creature-howl.m4a', import.meta.url));
  const howl = await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const noise = context.createBuffer(1, rate, rate), data = noise.getChannelData(0);
  let seed = 8137;
  for (let i = 0; i < data.length; ++i) { seed = seed * 16807 % 2147483647; data[i] = seed / 1073741824 - 1; }
  // Schedule the same frame updates on the offline graph before rendering.
  // This avoids a native suspend/resume race on short, faster-than-realtime renders.
  let clock = 0;
  const clocked = new Proxy(context, { get(target, key) {
    if (key === 'currentTime') return clock;
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }});
  const score = new ChaseScore(clocked, { music, effects: fx, noise, spatial: true, recording: () => howl });
  score.update(base, { x: 0, z: 0, yaw: Math.PI / 2 });
  score.roar(.08, 'howl', 1);
  clock = .48;
  score.update({ ...base, elapsed: 3.48 }, { x: 0, z: 0, yaw: -Math.PI / 2 });
  clock = .89;
  score.update(null);
  const result = await context.startRendering();
  const energy = (ch, from, to) => result.getChannelData(ch).subarray(Math.floor(from * rate), Math.floor(to * rate)).reduce((sum,v) => sum + v * v, 0);
  assert.ok(energy(1,.32,.47) > energy(0,.32,.47) * 1.2, 'pursuer should be on the right before turning');
  assert.ok(energy(0,.68,.83) > energy(1,.68,.83) * 1.2, 'turning should move the same cry to the left');
  assert.ok(energy(0,1.15,2) + energy(1,1.15,2) < 1e-16, 'only numerical residue may remain after teardown');
});

test('chase tempo climbs on bar boundaries without duplicating pulses or warning IDs', () => {
  const rate = 24_000;
  const context = new OfflineAudioContext(2, rate, rate);
  const music = context.createGain(), effects = context.createGain();
  const noise = context.createBuffer(1, rate, rate);
  let clock = 0;
  const clocked = new Proxy(context, { get(target, key) {
    if (key === 'currentTime') return clock;
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  const score = new ChaseScore(clocked, { music, effects, noise });
  const pulses = [], warnings = [], calls = [];
  score.beat = (index, at) => pulses.push({ index, at });
  score.warn = (_at, type) => warnings.push(type);
  score.roar = (_at, type) => calls.push(type);
  score.stepBehind = () => {};
  score.finalPhrase = () => {};
  for (let i = 0; i <= 45 * 120; i++) {
    clock = i / 120;
    const obstacle = i < 120 ? { obstacle: 'hole', obstacleType: 'gap' } : i < 240 ?
      { obstacle: 'span', obstacleType: 'bridge' } : { obstacle: null };
    score.update({ ...base, elapsed: clock, progress: clock / 45, ...obstacle });
  }
  assert.deepEqual(pulses.map(({ index }) => index), Array.from({ length: pulses.length }, (_, i) => i));
  const tempoIn = start => 16 * 60 / (pulses[start + 64].at - pulses[start].at);
  assert.ok(Math.abs(tempoIn(0) - 168) < .0001);
  assert.ok(Math.abs(tempoIn(128) - 178) < .0001);
  assert.ok(Math.abs(tempoIn(256) - 190) < .0001);
  assert.ok(Math.abs(tempoIn(384) - 204) < .0001);
  assert.deepEqual(warnings, ['gap', 'bridge']);
  assert.ok(calls.filter(call => call === 'scream').length >= 3);
  score.update(null);
});
