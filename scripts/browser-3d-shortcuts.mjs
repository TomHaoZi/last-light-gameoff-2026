import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TILE, LEVELS } from '../dist/3d/levels.js';
import { play3DJourney } from './play-3d-journey.mjs';

// Browser inputs are delivered through CDP. Only the chapter is preselected;
// the approach, checkpoint, deliberate fall, jumps and phase flips all use
// the game's real controls and simulation from a clean browser profile.
const root = resolve(process.env.TEST_DIST ?? 'dist');
const profiles = await mkdtemp(join(tmpdir(), 'last-light-route-test-'));
const gameEntry = await readFile(join(root, '3d/index.html')).then(() => '/3d/index.html', () => '/index.html');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.m4a': 'audio/mp4' };
const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Private test profile</title>');
      return;
    }
    const file = resolve(root, '.' + pathname);
    assert.ok(file.startsWith(root + '/'));
    res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const origin = 'http://127.0.0.1:' + server.address().port;
const chrome = spawn(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--enable-webgl', '--ignore-gpu-blocklist',
  '--remote-debugging-port=0', '--user-data-dir=' + profiles, 'about:blank',
], { stdio: 'ignore' });
const browserExit = new Promise(done => {
  chrome.once('exit', done);
  chrome.once('error', done);
});

let socket, id = 0;
const pending = new Map();
const exceptions = [];

function send(method, params = {}) {
  return new Promise((accept, reject) => {
    const messageId = ++id;
    const timer = setTimeout(() => {
      pending.delete(messageId);
      reject(Error('Timed out: ' + method));
    }, 10000);
    pending.set(messageId, { accept, reject, timer });
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
}

async function read(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true });
  assert.equal(exceptionDetails, undefined, JSON.stringify(exceptionDetails));
  return result.value;
}

const snapshot = () => read('window.lastLight3D?.snapshot()');
async function until(check, title, limit = 7500) {
  const end = Date.now() + limit;
  while (Date.now() < end) {
    const result = await check();
    if (result) return result;
    await delay(10);
  }
  throw Error('Timed out: ' + title);
}

async function whenPlaying(check, title, limit = 5000) {
  return until(async () => {
    const state = await snapshot();
    assert.equal(state.life, 'alive', JSON.stringify(state));
    return check(state) && state;
  }, title, limit);
}

const keys = { KeyA: 'a', KeyD: 'd', KeyE: 'e', KeyS: 's', KeyW: 'w', KeyX: 'x', ShiftLeft: 'Shift', Space: ' ' };
const input = (code, down) => send('Input.dispatchKeyEvent', { code, key: keys[code], type: down ? 'keyDown' : 'keyUp' });
async function hold(codes, run) {
  for (const key of codes) await input(key, true);
  try { return await run(); }
  finally { for (const key of [...codes].reverse()) await input(key, false); }
}
const tap = code => hold([code], () => delay(55));
const motion = { x: ['KeyA', 'KeyD'], z: ['KeyW', 'KeyS'] };
const tileCentre = index => (index + .5) * TILE;
const at = (stage, col, row) => Math.floor(stage.x / TILE) === col && Math.floor(stage.z / TILE) === row;

async function moveTo(axis, target) {
  const delta = target - (await snapshot())[axis];
  if (Math.abs(delta) < .09) return;
  const direction = Math.sign(delta);
  const code = motion[axis][Number(direction > 0)];
  return hold([code], () => whenPlaying(
    state => (target - state[axis]) * direction < .07, 'walking to ' + axis + ' ' + target, 4500));
}

async function phaseTo(phase) {
  if ((await snapshot()).phase === phase) return;
  await tap('KeyX');
  await whenPlaying(state => state.phase === phase, 'switch to ' + phase, 1000);
}

async function approach(col, row) {
  await moveTo('x', tileCentre(col));
  await moveTo('z', tileCentre(row));
}

async function jump(from, to) {
  const [fromCol, fromRow] = from, [toCol, toRow, phase] = to;
  const axis = fromCol === toCol ? 'z' : 'x';
  const alignment = axis === 'x' ? 'z' : 'x';
  const direction = Math.sign(axis === 'x' ? toCol - fromCol : toRow - fromRow);
  // Leave room for browser frame/input jitter before the real tile edge.
  const launch = tileCentre(axis === 'x' ? fromCol : fromRow) + direction * .50;
  await moveTo(alignment, tileCentre(axis === 'x' ? fromRow : fromCol));
  await moveTo(axis, launch);
  const before = await snapshot();
  assert.equal(before.y, 0, JSON.stringify({ from, to, before }));
  return hold(['ShiftLeft', motion[axis][Number(direction > 0)], 'Space'], async () => {
    const lift = await whenPlaying(state => state.y > .20, 'lift off', 650);
    let switchedAt = null;
    if (phase && phase !== before.phase) {
      await phaseTo(phase);
      switchedAt = await snapshot();
      assert.ok(switchedAt.y > .12, 'the phase must change in the air');
    }
    const landed = await whenPlaying(state => state.y === 0 && at(state, toCol, toRow), 'land on shortcut pad', 1400);
    assert.ok(!phase || landed.phase === phase);
    return { from: [fromCol, fromRow], to: [toCol, toRow], launchHeight: lift.y,
      switchHeight: switchedAt?.y ?? null, phase: landed.phase };
  });
}

async function startChapter(index) {
  await send('Page.navigate', { url: origin + '/' });
  await until(() => read("document.readyState === 'complete' && document.title === 'Private test profile'"), 'private profile');
  if (index !== undefined) {
    await read(`localStorage.setItem('last-light-3d-v1', JSON.stringify({ schema: 1, chapter: ${index} }))`);
  }
  await read("localStorage.setItem('last-light-3d-v1-settings', JSON.stringify({ lang: 'en', quality: 'high', adaptive: false }))");
  await send('Page.navigate', { url: origin + gameEntry });
  await until(async () => (await snapshot())?.webgl, 'WebGL initialized');
  const point = await read("(() => { const r = document.querySelector('#start').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()");
  for (const type of ['mousePressed','mouseReleased']) {
    await send('Input.dispatchMouseEvent', { ...point, type, button: 'left', clickCount: 1 });
  }
  await whenPlaying(state => state.chapter === (index ?? 0) && state.mode === 'playing', 'chapter started');
}

async function playShortcuts() {
  for (const [index, spec] of LEVELS.entries()) {
    const { pads, title } = spec.shortcut;
    const [col, row] = pads[0];
    await startChapter(index);
    await approach(col, row);
    await moveTo('z', tileCentre(row - 1));
    await tap('KeyE');
    const checkpoint = col + '/' + (row - 1);
    assert.equal(await read("JSON.parse(localStorage.getItem('last-light-3d-v1')).checkpoint"), checkpoint);
    await moveTo('z', tileCentre(row));
    assert.match(await read("document.getElementById('interaction').textContent"), new RegExp(title[0]));
    if (pads[1][2] === 'day') await phaseTo('night');
    // A missed jump must fall and recover at the real lamp.
    await hold(['KeyD'], () => until(async () => (await snapshot()).life === 'dying', 'fall into the first gap', 3000));
    const revived = await until(async () => {
      const state = await snapshot();
      return state.life === 'alive' && at(state, col, row - 1) && state;
    }, 'revive at the local lamp', 5000);
    assert.equal(revived.deaths, 1);
    assert.equal(revived.hp, 3);
    await moveTo('z', tileCentre(row));
    if (pads[1][2] === 'day') await phaseTo('night');
    const replay = [];
    for (let i = 1; i < pads.length; i++) replay.push(await jump(pads[i - 1], pads[i]));
    assert.equal(replay.filter(leg => leg.switchHeight !== null).length, pads.length - 2);
    assert.equal((await snapshot()).deaths, 1);
    console.log(JSON.stringify({ chapter: spec.id, jumpCount: replay.length, checkpoint, plannedFallRecovered: true, replay }));
  }
}

try {
  const devtools = await until(async () => {
    const active = await readFile(join(profiles, 'DevToolsActivePort'), 'utf8').catch(() => '');
    if (!active) return null;
    const [port] = active.split('\n');
    return await fetch('http://127.0.0.1:' + port + '/json/list')
      .then(result => result.json()).then(tabs => tabs.find(tab => tab.type === 'page')).catch(() => null);
  }, 'Chrome debugger tab', 12000);
  socket = new WebSocket(devtools.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);
    if (waiting) {
      clearTimeout(waiting.timer);
      pending.delete(message.id);
      if (message.error) waiting.reject(Error(JSON.stringify(message.error)));
      else waiting.accept(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  if (process.env.JOURNEY) {
    await startChapter();
    const proof = await play3DJourney({ snapshot, until, whenPlaying, moveTo, hold, tap }, process.env.JOURNEY);
    const saved = await read("JSON.parse(localStorage.getItem('last-light-3d-v1'))");
    assert.equal(saved.finished, true);
    console.log(JSON.stringify({ ...proof, saved: true }));
  } else await playShortcuts();
  assert.deepEqual(exceptions, []);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++id, method: 'Browser.close' }));
    await Promise.race([browserExit, delay(1500)]);
  }
  if (chrome.exitCode == null && !chrome.killed) chrome.kill();
  await browserExit;
  socket?.close();
  server.close();
  await rm(profiles, { recursive: true, force: true });
}
