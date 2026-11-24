// Render each chase through the shipped game mixer, including the recorded 3D
// monster, room and footsteps. Pass an output directory for the two review WAVs.
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OfflineAudioContext } from 'node-web-audio-api';
import { Sound } from '../dist/audio.js';
import { HorrorAudio } from '../dist/3d/audio.js';
import { CHASE_DOOR, CHASE_START, CHASE_OBSTACLES } from '../dist/backrooms.js';
import { BACKROOMS_TRACK as TRACK } from '../dist/3d/backrooms-track.js';

const target = process.argv[2];
if (!target) throw new Error('Pass a directory for the review WAV files');
await mkdir(target, { recursive: true });
const rate = 48000, duration = 48, leadIn = .55;

function writeStereo(buffer) {
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)];
  const pcm = Buffer.alloc(44 + buffer.length * 4);
  pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
  pcm.writeUInt32LE(rate, 24); pcm.writeUInt32LE(rate * 4, 28); pcm.writeUInt16LE(4, 32);
  pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(pcm.length - 44, 40);
  let peak = 0, squares = 0, difference = 0, clips = 0;
  const periods = Array(6).fill(0);
  for (let i = 0; i < buffer.length; ++i) {
    difference += Math.abs(channels[0][i] - channels[1][i]);
    for (let ch = 0; ch < 2; ++ch) {
      const v = channels[ch][i];
      if (!Number.isFinite(v)) throw new Error('Invalid PCM at frame ' + i);
      peak = Math.max(peak, Math.abs(v)); squares += v * v;
      periods[Math.floor(i / (8 * rate))] += v * v;
      if (Math.abs(v) >= 1) clips++;
      pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + (i * 2 + ch) * 2);
    }
  }
  const db = ratio => +(10 * Math.log10(ratio)).toFixed(2);
  return { pcm, metrics: { duration, rate, peakDb: db(peak * peak), rmsDb: db(squares / (2 * buffer.length)),
    clips, stereoDifference: +(difference / buffer.length).toFixed(5),
    eightSecondRmsDb: periods.map(sum => db(sum / (16 * rate))) } };
}

for (const edition of ['classic', 'spatial']) {
  const spatial = edition === 'spatial';
  const context = new OfflineAudioContext(2, duration * rate, rate);
  const engine = spatial ? new HorrorAudio() : new Sound();
  if (spatial) {
    engine.initialize(context);
    const files = new URL('../dist/3d/audio/', import.meta.url);
    for (const file of (await readdir(files)).filter(f => f.endsWith('.m4a'))) {
      const bytes = await readFile(new URL(file, files));
      const clip = await context.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      engine.recordings.set(file.slice(0,-4), clip);
      const room = ['room-boiler.m4a','room-office.m4a','room-roof.m4a'].indexOf(file);
      if (room >= 0) engine.attachRoomRecording(room, clip);
    }
  } else {
    // Sound.start() normally unlocks a live context from a user gesture.
    globalThis.AudioContext = function() { return new Proxy(context, {
      get(target, key) {
        if (key === 'resume') return async () => {};
        const v = Reflect.get(target, key, target);
        return typeof v === 'function' ? v.bind(target) : v;
      }
    }); };
    await engine.start(); clearInterval(engine.timer);
    engine.setFloor(1); engine.menu = false;
  }
  const length = spatial ? TRACK.length : CHASE_DOOR - CHASE_START;
  const runTime = spatial ? 45.01 : length / 112;
  const obstacles = spatial ? TRACK.obstacles : CHASE_OBSTACLES;
  const position = o => spatial ? o.at : o.x - CHASE_START;
  const counts = { calls: 0, warnings: 0, maxConcurrentSources: 0 };
  const score = engine.chaseScore;
  const roar = score.roar.bind(score);
  score.roar = (...args) => { counts.calls++; roar(...args); };
  let lastObstacle, lastStep = -1, night = false;
  const fired = new Set();
  function effect(name) {
    if (spatial) engine.cue(name, name === 'step' ? { surface: night ? 'grate' : 'carpet' } : undefined);
    else engine.effect(name, 1, night ? 'grate' : 'carpet');
  }
  const updates = Array.from({ length: duration * 25 - 1 }, (_, frame) => context.suspend((frame+1)/25).then(() => {
    const elapsed = context.currentTime - leadIn, progress = elapsed / runTime;
    const distance = progress * length;
    const ahead = obstacles.find(o => position(o) >= distance);
    const lead = 10.5 - 3 * Math.sin(Math.max(0, progress) * 3.1);
    const z = TRACK.startZ - distance, x = TRACK.centerX + Math.sin(elapsed * .55);
    const obstacle = ahead && (position(ahead) - distance)/length*runTime < 1 ? ahead.id : null;
    const chase = elapsed >= 0 && progress < 1 ? { elapsed, progress, obstacle, danger: (12-lead)/11, threat: { x: x-.7, z: z+lead } } : null;
    if (spatial) engine.update({ x, z, yaw: Math.sin(elapsed * .39) * .27, level: 1, night, chase });
    else { engine.setChase(chase); engine.schedule(); }
    if (score.live) counts.maxConcurrentSources = Math.max(counts.maxConcurrentSources, score.live.sources.size);
    if (chase && obstacle && obstacle !== lastObstacle) { counts.warnings++; lastObstacle = obstacle; }
    const step = Math.floor(elapsed / .32);
    if (chase && step !== lastStep) { effect('step'); lastStep = step; }
    if (chase && ahead && !fired.has(ahead.id) && (position(ahead) - distance)/length*runTime < .26) {
      if (ahead.phase) {
        night = ahead.phase === 'night';
        if (!spatial) engine.setPhase(night);
        effect('shift');
      } else if (ahead.kind !== 'rack') effect('jump');
      fired.add(ahead.id);
    }
    if (progress >= 1 && !fired.has('exit')) { effect('door'); fired.add('exit'); }
    return context.resume();
  }));
  const [rendered] = await Promise.all([context.startRendering(), ...updates]);
  const { pcm, metrics } = writeStereo(rendered);
  assert.equal(metrics.clips, 0);
  assert.ok(metrics.peakDb > -20 && metrics.peakDb < -.1);
  assert.ok(metrics.stereoDifference > .00015);
  assert.equal(counts.warnings, obstacles.length);
  assert.ok(counts.calls >= 8 && counts.calls <= 13);
  assert.ok(counts.maxConcurrentSources < 72, 'Audio voices must remain bounded throughout the chase');
  assert.equal(score.live, null);
  await writeFile(path.join(target, edition + '.wav'), pcm);
  console.log(JSON.stringify({ edition, ...metrics, ...counts, runSeconds: +runTime.toFixed(2) }));
}
