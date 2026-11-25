import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TILE, LEVELS } from '../dist/3d/levels.js';
import { BACKROOMS_TRACK } from '../dist/3d/backrooms-track.js';
import { runTransfer } from './play-3d-transfer.mjs';
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
    if (pathname === '/__qa_profile__') {
      res.setHeader('Content-Type', 'text/html');
      res.end('<!doctype html><title>Private test profile</title>');
      return;
    }
    const file = resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
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
  '--headless=new', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--enable-webgl', '--ignore-gpu-blocklist',
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

const keys = { KeyA: 'a', KeyD: 'd', KeyE: 'e', KeyS: 's', KeyW: 'w', KeyX: 'x', ShiftLeft: 'Shift', Space: ' ', Escape: 'Escape', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };
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
    state => (target - state[axis]) * direction < .07, 'walking to ' + axis + ' ' + target, Math.max(4500, 1000 + Math.abs(delta) * 350)));
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

async function aim(axis, angle) {
  const getError = state => axis === 'pitch' ? angle - state.pitch :
    Math.atan2(Math.sin(angle - state.yaw), Math.cos(angle - state.yaw));
  const initial = getError(await snapshot());
  if (Math.abs(initial) <= .035) return;
  const key = axis === 'pitch' ? (initial > 0 ? 'ArrowUp' : 'ArrowDown') :
    (initial > 0 ? 'ArrowRight' : 'ArrowLeft');
  await hold([key], () => whenPlaying(state => Math.sign(initial) * getError(state) < .044,
    'turn to ' + axis + ' ' + angle, 2600));
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

async function startChapter(index, resumePursuit = false) {
  await send('Page.navigate', { url: origin + '/__qa_profile__' });
  await until(() => read("document.readyState === 'complete' && document.title === 'Private test profile'"), 'private profile');
  if (index !== undefined) {
    await read(`localStorage.setItem('last-light-3d-v1', JSON.stringify({ schema: 1, chapter: ${index}, backrooms:${resumePursuit}, work:${resumePursuit ? '{1:["A","B","C"]}' : '{}'} }))`);
  }
  // Use the performance pass to exercise the Chinese in-game route prompts too.
  const lang = process.env.TRANSFER_PROFILE ? 'zh' : 'en';
  await read(`localStorage.setItem('last-light-3d-v1-settings', JSON.stringify({ lang: '${lang}', quality: 'high', adaptive: false }))`);
  await send('Page.navigate', { url: origin + gameEntry });
  await until(async () => (await snapshot())?.webgl, 'WebGL initialized');
  if (process.env.JOURNEY) {
    const observation = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({ Visual }) => {
      const update = Visual.prototype.updateProps;
      Visual.prototype.updateProps = function(state, time) {
        update.call(this, state, time);
        window.clueMeshVisibility = Object.fromEntries(state.map.clues.map(tile =>
          [tile.key, this.objects.get(tile.key).indicator.visible]));
      };
    })` });
    assert.equal(observation.exceptionDetails, undefined, 'Attach read-only clue mesh observer');
  }
  await clickVisible('#start');
  await whenPlaying(state => state.chapter === (index ?? 0) && state.mode === 'playing', 'chapter started');
}

async function clickVisible(selector) {
  const point = await until(() => read(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({block:'center', behavior:'instant'});
    const r = element.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    return r.width && r.height && element.contains(document.elementFromPoint(x, y)) ? {x, y} : null;
  })()`), 'visible, clickable control ' + selector);
  for (const type of ['mousePressed','mouseReleased']) {
    await send('Input.dispatchMouseEvent', { ...point, type, button: 'left', clickCount: 1 });
  }
}

const readHud = () => read(`({
  prompt: document.querySelector('#interaction').textContent,
  objective: document.querySelector('#objective').textContent,
  work: document.querySelector('#station-progress').textContent,
  cluePapers: window.clueMeshVisibility
})`);

async function pauseAndReadGuide() {
  await tap('Escape');
  await whenPlaying(state => state.mode === 'paused', 'player paused at landing');
  const guide = await read("document.querySelector('#guide-note').textContent");
  await clickVisible('#start');
  await whenPlaying(state => state.mode === 'playing', 'continued after reading the guide');
  return guide;
}

async function playMourning() {
  await startChapter(1);
  const model = await until(() => read(`(() => {
    const asset = performance.getEntriesByType('resource').find(entry =>
      entry.name.endsWith('/mourning-clerk-human.glb') && entry.decodedBodySize > 0);
    return asset && { bytes: asset.decodedBodySize, loadMs: Math.round(asset.duration) };
  })()`), 'the new Clerk mesh loaded');
  await moveTo('x', tileCentre(9) - .38);
  await moveTo('z', tileCentre(14) + 1.52);
  assert.match(await readHud().then(hud => hud.prompt), /play the gramophone/i);
  await tap('KeyE');
  assert.ok((await snapshot()).gaze.noteRead);
  await until(() => read("document.querySelector('#dialogue').textContent.includes('keep your eyes down')"), 'voiced warning is captioned');

  const stills = process.env.MOURNING_STILLS;
  async function capture(name) {
    if (!stills) return;
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
    await writeFile(join(stills, name + '.jpg'), Buffer.from(shot.data, 'base64'));
  }
  if (stills) await mkdir(stills, { recursive: true });
  await aim('pitch', -.23);
  await capture('mourning-note');
  await aim('pitch', 0);

  await approach(10, 13);
  await tap('KeyE');
  await moveTo('x', tileCentre(11));
  await moveTo('z', tileCentre(2));
  await moveTo('x', tileCentre(12) - .55);
  const side = await snapshot();
  const dayFigure = side.gaze.figures.find(figure => figure.active && figure.x > side.x);
  assert.ok(dayFigure);
  assert.equal(side.gaze.amount, 0);
  const facing = Math.atan2(dayFigure.x - side.x, side.z - dayFigure.z);
  // Move the same mouse pointer inside the canvas. The normal browser events
  // traverse the game's pointer-lock or fallback mouse-look branch.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 130, y: 360 });
  const beforeMouse = await snapshot();
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 560, y: 360 });
  const mouse = await whenPlaying(state => Math.abs(state.yaw - beforeMouse.yaw) > .18, 'mouse rotates the gaze');
  await aim('pitch', 0);
  await aim('yaw', facing);
  const position = state => state.gaze.figures.find(figure => figure.key === dayFigure.key);
  const glimpse = await whenPlaying(state => state.gaze.direct && state.life === 'alive' &&
    position(state)?.x < dayFigure.x - .24, 'direct stare starts a physical charge');
  assert.equal(await read("document.querySelector('#gaze-warning').hidden"), false);
  assert.match(await read("document.querySelector('#gaze-command').textContent"), /^LOOK AWAY/);

  // Start the screenshot and look-away input together so the camera captures
  // the warning at its onset, before the runner breaks eye contact.
  const warningCapture = capture('mourning-warning');
  const escape = aim('pitch', -.42);
  await Promise.all([warningCapture, escape]);
  const safe = await whenPlaying(state => !state.gaze.direct && state.gaze.amount === 0,
    'looking down clears the eye contact meter');
  await delay(900);
  const stayedSafe = await snapshot();
  assert.equal(stayedSafe.deaths, side.deaths);
  assert.deepEqual(position(stayedSafe), position(safe), 'looking away stops the charge in place');
  await capture('mourning-look-down');

  await aim('pitch', 0);
  await whenPlaying(state => state.gaze.direct && state.gaze.amount > .20, 'another stare begins');
  await phaseTo('night');
  const shifted = await whenPlaying(state => state.gaze.amount === 0 && !state.gaze.direct,
    'only the active phase counts');
  await delay(300);
  await phaseTo('day');
  const hit = await until(async () => {
    const state = await snapshot();
    return state.life === 'dying' && state;
  }, 'sustained eye contact triggers capture', 2200);
  assert.equal(hit.deathCause, 'gaze');
  assert.equal(hit.deaths, side.deaths + 1);
  const attacker = position(hit);
  assert.ok(Math.hypot(attacker.x - hit.x, attacker.z - hit.z) < .63, 'death happens at physical contact');
  assert.equal(await read("document.querySelector('#death-copy').textContent"), 'IT CAUGHT YOUR EYE');
  const execution = [];
  for (const [beat, time, image] of [
    ['hold', .19, 'mourning-capture'],
    ['shroud', .42, 'mourning-shroud'],
    ['fall', .83, 'mourning-fall'],
    ['blackout', 1.36, null],
    ['revival', .24, 'mourning-revival']
  ]) {
    const stage = await until(async () => {
      const state = await snapshot();
      return state.capture?.beat === beat && state.capture.time >= time && state;
    }, 'Clerk execution beat ' + beat, 2200);
    assert.equal(stage.deaths, hit.deaths);
    if (beat === 'blackout') {
      assert.equal(await read("document.querySelector('#death').style.getPropertyValue('--execution-veil')"), '1.000');
    }
    if (image) await capture(image);
    execution.push({beat, time: stage.capture.time});
  }
  const revival = await until(async () => {
    const state = await snapshot();
    return state.life === 'alive' && state;
  }, 'checkpoint revived after stare', 2800);
  assert.ok(at(revival, 10, 13));
  assert.equal(revival.gaze.amount, 0);
  console.log(JSON.stringify({ model, mouseLook: mouse.yaw - beforeMouse.yaw, warning: glimpse.gaze.amount, recoveryPitch: safe.pitch,
    charge: { from: dayFigure.x, averted: position(safe).x }, phaseRecovery: shifted.phase, death: hit.deathCause,
    execution, checkpoint: [10, 13], note: revival.gaze.noteRead }));
}

async function playGhostRecoveries() {
  // From a real lamp, enter a live patrol's corridor. The ghost may catch the
  // player on the approach or while they wait at the end of the corridor.
  const patrols = [
    { lamp: [5, 15], path: ['night', ['z', 10], 'day', ['z', 8], ['x', 12], ['z', 7], ['x', 15]] },
    { lamp: [10, 13], path: [['x', 11], ['z', 2], ['x', 13]] },
    { lamp: [11, 15], path: ['night', ['z', 10], 'day', ['z', 8], ['x', 5], ['z', 5]] }
  ];
  for (const [chapter, { lamp, path }] of patrols.entries()) {
    await startChapter(chapter);
    await approach(...lamp);
    await tap('KeyE');
    const before = await snapshot();
    assert.equal(await read("JSON.parse(localStorage.getItem('last-light-3d-v1')).checkpoint"), lamp.join('/'));
    try {
      for (const leg of path) {
        if (typeof leg === 'string') await phaseTo(leg);
        else await moveTo(leg[0], tileCentre(leg[1]));
      }
      await until(async () => (await snapshot()).life === 'dying', 'patrol made contact', 8000);
    } catch (error) {
      if ((await snapshot()).life !== 'dying') throw error;
    }
    const hit = await snapshot();
    assert.equal(hit.hp, 0);
    assert.equal(hit.deaths, before.deaths + 1);
    const message = await read("document.querySelector('#death-copy').textContent");
    assert.equal(message, chapter === 1 ? (hit.deathCause === 'gaze' ? 'IT CAUGHT YOUR EYE' : 'YOU GOT TOO CLOSE') : 'IT FOUND YOU');
    await until(async () => (await snapshot()).life === 'respawning', 'ghost capture recovery animation');
    const revived = await whenRevived();
    assert.ok(at(revived, ...lamp));
    assert.equal(revived.deaths, hit.deaths);
    assert.equal(revived.hp, 3);
    console.log(JSON.stringify({ chapter: LEVELS[chapter].id, ghost: message, capture: [hit.x,hit.z], lamp, restoredHP: revived.hp, deaths: revived.deaths }));
  }
}

async function whenRevived() {
  return until(async () => {
    const state = await snapshot();
    return state.life === 'alive' && state;
  }, 'regained control after death', 5000);
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
  await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.QA_WIDTH || 1280), height: Number(process.env.QA_HEIGHT || 720), deviceScaleFactor: 1, mobile: false });
  if (process.env.JOURNEY) {
    await startChapter();
    const proof = await play3DJourney({ snapshot, until, whenPlaying, moveTo, hold, tap, aim, readHud, pauseAndReadGuide, runTransfer:()=>runTransfer({snapshot,input}) }, process.env.JOURNEY);
    const saved = await read("JSON.parse(localStorage.getItem('last-light-3d-v1'))");
    assert.equal(saved.finished, true);
    await send('Page.reload', { ignoreCache: true });
    await until(() => read("performance.getEntriesByType('navigation')[0]?.type === 'reload' && document.readyState === 'complete'"), 'new document loaded after refresh');
    const reopened = await until(async () => {
      const state = await snapshot();
      return state?.webgl && state.mode === 'won' && state;
    }, 'reopened the saved ending');
    assert.equal(reopened.ending, proof.ending);
    await clickVisible('#start');
    await until(() => read("document.querySelector('#panel').open"), 'opening the saved journal');
    const journalCount = await read("document.querySelectorAll('#journal-list article').length");
    assert.equal(journalCount, proof.records.length);
    await clickVisible('#close-panel');
    await until(() => read("!document.querySelector('#panel').open"), 'closed ending journal');
    await clickVisible('#classic-link');
    await until(() => read("document.readyState === 'complete' && Boolean(window.lastLight?.snapshot() && document.querySelector('#play-3d'))"), 'classic title and canvas finished loading');
    await clickVisible('#play-3d');
    await until(async () => (await snapshot())?.ending === proof.ending, 'returned from classic to the same 3D ending');
    assert.deepEqual(await read("JSON.parse(localStorage.getItem('last-light-3d-v1'))"), saved);
    console.log(JSON.stringify({ ...proof, saved: true, reopenedEnding: reopened.ending, journalCount, returnedFromClassic: true }));
  } else if (process.env.TRANSFER_RECOVERY) {
    await startChapter(1,true);
    const waiting = await snapshot();
    assert.equal(waiting.chase.started,false);
    if (process.env.TRANSFER_PROFILE) {
      const prompt=await read("document.querySelector('#interaction').textContent");
      assert.match(prompt,/按住 W 奔跑.*空格跳跃.*X 切换长桥/);
      assert.equal(await read("document.querySelector('#room-title').textContent"),'后室 · 中转层');
    }
    const stills = process.env.TRANSFER_STILLS;
    const screenshots = [];
    async function capture(name) {
      const shot = await send('Page.captureScreenshot',{format:'jpeg',quality:88});
      await writeFile(join(stills,name+'.jpg'),Buffer.from(shot.data,'base64'));
    }
    if (stills) {
      await mkdir(stills,{recursive:true});
      const observer = await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
        const draw=Visual.prototype.render;
        Visual.prototype.render=function(...args){
          window.transferView=this;
          window.transferDoor=args[0].door;
          return draw.apply(this,args);
        };
      })`});
      assert.equal(observer.exceptionDetails,undefined);
      await until(()=>read("Boolean(window.transferView?.backroomsSet && window.transferView.ghosts.get('transfer-pursuer')?.group.userData.authoredCreature && window.transferView.janitorHands.group.children.length)"),'authored pursuer and first-person hands drawn',15000);
      const art=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:"window.transferView.backroomsSet.ready"});
      assert.equal(art.result.value,true,'Blender stage props mounted');
      await capture('transfer-entrance-day');
    }
    await hold(['KeyW'],()=>whenPlaying(s=>s.chase.distance>.5,'depart the transfer lift'));
    const hit = await until(async()=>{const s=await snapshot();return s.life==='dying'&&s;},'pursuer catches a stationary runner',5000);
    if (stills) {
      await delay(200);
      await capture('transfer-pursuer-capture');
    }
    assert.equal(hit.hp,0);
    assert.ok(Math.hypot(hit.x-hit.chase.pursuer.x,hit.z-hit.chase.pursuer.z)<.7);
    await until(async()=>{const s=await snapshot();return s.life==='respawning'&&s;},'choke animation finishes',4000);
    const retry = await until(async()=>{const s=await snapshot();return s.life==='alive'&&s;},'revival at original threshold',4000);
    assert.equal(retry.chase.started,false);
    assert.equal(retry.deaths,1);
    assert.deepEqual(retry.work,waiting.work);
    const falls=[];
    if (process.env.TRANSFER_MISSES) {
      for (const kind of ['gap','bridge']) {
        const miss=BACKROOMS_TRACK.obstacles.find(part=>part.kind===kind);
        falls.push(await runTransfer({snapshot,input,miss}));
        const respawn=await until(async()=>{const s=await snapshot();return s.life==='alive'&&!s.chase.started&&s;},'revive after missed '+kind,4000);
        assert.deepEqual(respawn.work,waiting.work);
      }
    }
    const profile = Boolean(process.env.TRANSFER_PROFILE);
    if (profile) {
      const probe=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
        window.transferFrames=[];
        const render=Visual.prototype.render;
        Visual.prototype.render=function(state,dt,elapsed){
          if(!window.transferGPU) {
            const gl=this.renderer.getContext(), ext=gl.getExtension('WEBGL_debug_renderer_info');
            window.transferGPU=ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
          }
          if (state.life==='alive' && state.chase?.started && !state.departing) {
            window.transferFrames.push(elapsed*1000);
            window.transferSize=[this.frameTarget.width,this.frameTarget.height];
          }
          return render.call(this,state,dt,elapsed);
        };
      })`});
      assert.equal(probe.exceptionDetails,undefined);
    }
    const { obstacles } = BACKROOMS_TRACK;
    const firstPhase = obstacles.find(part => part.kind === 'bridge');
    const midGap = obstacles.find(part => part.kind === 'gap' && part.at > BACKROOMS_TRACK.length * .5);
    const highlights = new Set([firstPhase, midGap, obstacles.at(-1)]);
    const run = await runTransfer({snapshot,input,testSideWall:Boolean(process.env.TRANSFER_SIDE_WALL),onCrossing:part=>{
      if (stills && highlights.has(part)) screenshots.push(capture(part.id));
    }});
    await Promise.all(screenshots);
    if (stills) {
      await until(()=>read('window.transferDoor>.46 && window.transferDoor<1'),'fire door swings open');
      await capture('transfer-fire-door-opening');
    }
    await whenPlaying(s=>s.chapter===2 && !s.chase,'escape transfers to the roof');
    const frames=profile ? await read(`(() => {
      const frames=window.transferFrames.sort((a,b)=>a-b);
      return {gpu:window.transferGPU,size:window.transferSize, frames:frames.length, median:frames[Math.floor(frames.length*.5)], p95:frames[Math.floor(frames.length*.95)],
        p99:frames[Math.floor(frames.length*.99)], max:frames.at(-1), over50ms:frames.filter(v=>v>50.1).length};
    })()`) : null;
    console.log(JSON.stringify({retry:retry.deaths,captureDistance:hit.chase.distance,falls,run,frames}));
  } else if (process.env.MOURNING) await playMourning();
  else if (process.env.GHOST_RECOVERY) await playGhostRecoveries();
  else await playShortcuts();
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
