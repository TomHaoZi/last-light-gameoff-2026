import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TILE, LEVELS, decodeLevel } from '../dist/3d/levels.js';
import { BACKROOMS_TRACK } from '../dist/3d/backrooms-track.js';
import { runTransfer } from './play-3d-transfer.mjs';
import { play3DJourney } from './play-3d-journey.mjs';
import { PlaythroughRecording } from './record-3d-playthrough.mjs';
import { installMixTap, saveMix } from './record-browser-mix.mjs';

// Browser inputs are delivered through CDP. Only the chapter is preselected;
// the approach, checkpoint, deliberate fall, jumps and phase flips all use
// the game's real controls and simulation from a clean browser profile.
const root = resolve(process.env.TEST_DIST ?? 'dist');
const watch = process.env.WATCH_PLAYTHROUGH === '1';
if ((watch || process.env.RECORD_PLAYTHROUGH) && !process.env.JOURNEY) throw Error('Playthrough presentation requires JOURNEY');
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
    if(process.env.CITY_GROUND_MISSING && pathname.endsWith('/assets/env/city-ground-rc35.glb')) {
      res.writeHead(404).end();
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
  ...(watch ? ['--window-size=1320,860', '--window-position=16,44'] : ['--headless=new', '--mute-audio']),
  '--no-first-run', '--no-default-browser-check', '--enable-webgl', '--ignore-gpu-blocklist',
  '--remote-debugging-port=0', '--user-data-dir=' + profiles, 'about:blank',
], { stdio: 'ignore' });
const browserExit = new Promise(done => {
  chrome.once('exit', done);
  chrome.once('error', done);
});

let socket, id = 0;
const pending = new Map();
const exceptions = [];
const recording = process.env.RECORD_PLAYTHROUGH ? new PlaythroughRecording(resolve(process.env.RECORD_PLAYTHROUGH), send) : null;
const showcase = watch || recording;

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

const keys = { KeyA: 'a', KeyD: 'd', KeyE: 'e', KeyF: 'f', KeyS: 's', KeyW: 'w', KeyX: 'x', ShiftLeft: 'Shift', Space: ' ', Escape: 'Escape', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };
const input = async (code, down) => {
  if (code !== 'MouseRight') return send('Input.dispatchKeyEvent', { code, key: keys[code], type: down ? 'keyDown' : 'keyUp' });
  const point = await read(`(() => {
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
  })()`);
  return send('Input.dispatchMouseEvent', {
    ...point, type: down ? 'mousePressed' : 'mouseReleased',
    button: 'right', buttons: down ? 2 : 0, clickCount: 1
  });
};
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
  await tap('MouseRight');
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
    const fixture = { schema: 1, chapter: index, backrooms: resumePursuit, work: resumePursuit ? {1:['A','B','C']} : {} };
    const module = new URL('save.js', origin + gameEntry).href;
    const result = await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`import(${JSON.stringify(module)}).then(async ({openRun,commitRun}) =>
      commitRun(localStorage,${JSON.stringify(fixture)},await openRun(localStorage)))`});
    assert.equal(result.exceptionDetails,undefined,'private chapter fixture initialized');
    assert.equal(result.result.value,null,'private chapter fixture committed');
  }
  // Use the performance pass to exercise the Chinese in-game route prompts too.
  const lang = process.env.TRANSFER_PROFILE || process.env.ROOF_COMBAT_STILLS ? 'zh' : 'en';
  await read(`localStorage.setItem('last-light-3d-v1-settings', JSON.stringify({ lang: '${lang}', quality: 'high', adaptive: false, reduced:${Boolean(process.env.REDUCED_WOUND_PROOF)} }))`);
  await send('Page.navigate', { url: origin + gameEntry });
  await until(async () => (await snapshot())?.webgl, 'WebGL initialized');
  if (process.env.JOURNEY) {
    const observation = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({ Visual }) => {
      const update = Visual.prototype.updateProps;
      Visual.prototype.updateProps = function(state, time) {
        update.call(this, state, time);
        if (${Boolean(process.env.LANDING_STILLS)}) {
          const apron=this.junctions?.get('LiftApron');
          const mesh=this.stage.getObjectByName('Architecture: LiftApron');
          window.landing=mesh?.children.length&&apron&&!apron.fallback.visible&&apron.points[0];
        }
        window.clueMeshVisibility = Object.fromEntries(state.map.clues.map(tile =>
          [tile.key, this.objects.get(tile.key).indicator.visible]));
        if (${Boolean(process.env.INSPECTION_PROOF)}) window.clueModels=Object.fromEntries(state.map.clues.map(tile=>{
          const {indicator}=this.objects.get(tile.key);
          const source=indicator.children.find(node=>node.name.endsWith('Record'+tile.key));
          let parts=0;
          source?.traverse(node=>{ if(node.isMesh) parts++; });
          return [tile.key,{parts,name:source?.name,visible:indicator.visible,at:indicator.position.toArray(),
            fallbackHidden:indicator.children.some(node=>node.isMesh&&!node.visible)}];
        }));
      };
    })` });
    assert.equal(observation.exceptionDetails, undefined, 'Attach read-only clue mesh observer');
  }
  if (process.env.CHAPTER_STILLS) {
    const observation = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({ Visual }) => {
      const update = Visual.prototype.updateProps;
      Visual.prototype.updateProps = function(state, time) {
        update.call(this, state, time);
        if (window.reviewLampParts) return;
        window.reviewLampParts = this.stage.children.filter(node => node.visible && node.isInstancedMesh &&
          node.name.startsWith('Checkpoint lantern · ')).length;
      };
    })` });
    assert.equal(observation.exceptionDetails, undefined, 'Attach read-only lamp mesh observer');
  }
  if (recording) await recording.start();
  if (watch) await send('Page.bringToFront');
  if (showcase) await delay(watch ? 8400 : 2300);
  await clickVisible(process.env.MOBILE_HUD_PROOF || process.env.MOBILE_LOOK_ONLY ? '#play-mobile' : '#start');
  await whenPlaying(state => state.chapter === (index ?? 0) && state.mode === 'playing', 'chapter started');
}

async function clickVisible(selector, button = 'left') {
  const point = await until(() => read(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({block:'center', behavior:'instant'});
    const r = element.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    return r.width && r.height && element.contains(document.elementFromPoint(x, y)) ? {x, y} : null;
  })()`), 'visible, clickable control ' + selector);
  for (const type of ['mousePressed','mouseReleased']) {
    await send('Input.dispatchMouseEvent', { ...point, type, button, buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0, clickCount: 1 });
  }
}

const readHud = () => read(`({
  prompt: document.querySelector('#interaction').textContent,
  objective: document.querySelector('#objective').textContent,
  work: document.querySelector('#station-progress').textContent,
  cluePapers: window.clueMeshVisibility,
  clueModels: window.clueModels
})`);

async function playOutletInspection(directory) {
  await mkdir(directory,{recursive:true});
  const report=[];
  for (let chapter=2;chapter>=0;chapter--) {
    await startChapter(chapter);
    const observer=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      if (window.outletObserver) return;
      window.outletObserver=true;
      const update=Visual.prototype.updateProps;
      Visual.prototype.updateProps=function(state,time){
        update.call(this,state,time);
        window.outlets=Object.fromEntries(['day','night'].map(phase=>{
          const name=phase==='day'?'HeatOutlet':'ColdReturn';
          const group=this.groups[phase].getObjectByName('Inspection: '+name);
          return [phase,{count:group?.children[0]?.count,parts:group?.children.length,visible:group?.parent.visible,
            hiddenFallbacks:this.inspection.filter(p=>p.name===name&&!p.fallback.visible).length}];
        }));
      };
    })`});
    assert.equal(observer.exceptionDetails,undefined);
    await phaseTo('day');
    const day=await until(()=>read('window.outlets?.day.parts && window.outlets?.night.parts && window.outlets'),'replacement outlets');
    const counts=[[2,1],[1,1],[1,2]][chapter];
    for (const [i,phase] of ['day','night'].entries()) {
      assert.equal(day[phase].count,counts[i]);
      assert.equal(day[phase].hiddenFallbacks,counts[i]);
      assert.ok(day[phase].parts>=4);
      assert.equal(day[phase].visible,!i);
    }
    await phaseTo('night');
    await until(()=>read('window.outlets?.night.visible && !window.outlets?.day.visible'),'actual night group visibility');
    report.push({chapter,day,night:await read('window.outlets')});
  }
  // Traverse the ordinary boiler path with trusted input, then wait on
  // each active grate for actual simulation damage. Each wait is bounded.
  const walk=(axis,tile)=>moveTo(axis,tileCentre(tile));
  await walk('z',10);
  await phaseTo('day');
  await walk('x',4); await walk('z',9); await walk('x',3); await walk('z',8);
  await walk('x',8);
  const shot=async (name,x,z)=>{
    const before=await snapshot();
    await aim('yaw',Math.atan2(x-before.x,before.z-z));
    await aim('pitch',-.76);
    const result=await send('Page.captureScreenshot',{format:'jpeg',quality:92});
    await writeFile(join(directory,name+'.jpg'),Buffer.from(result.data,'base64'));
    await aim('yaw',0); await aim('pitch',0);
  };
  await shot('heat-outlet-active',tileCentre(8),tileCentre(7));
  await walk('z',7);
  const heatHit=await whenPlaying(s=>s.hp<3,'active heat grate lowers integrity',3800);
  await phaseTo('night');
  const nightBefore=await snapshot();
  await delay(3150);
  assert.equal((await snapshot()).hp,nightBefore.hp,'the same grate is harmless in the other phase');
  await phaseTo('day');
  const down=await until(async()=>{const s=await snapshot();return s.life==='dying'&&s;},'repeated heat discharges trigger checkpoint recovery',7600);
  assert.equal(down.deathCause,'machinery');
  const revived=await until(async()=>{const s=await snapshot();return s.life==='alive'&&s.deaths===down.deaths&&s.hp===3&&s;},'recovered beside boiler checkpoint lamp',4800);
  // The archive lets us isolate a cold outlet without the patrolling
  // boiler ghosts reaching the camera during the close-up.
  await startChapter(1);
  await aim('pitch',-.76);
  await phaseTo('day');
  await walk('z',10); await walk('x',4); await walk('z',7);
  await phaseTo('night');
  const coldShot=await send('Page.captureScreenshot',{format:'jpeg',quality:92});
  await writeFile(join(directory,'cold-return-active.jpg'),Buffer.from(coldShot.data,'base64'));
  const coldBefore=await snapshot();
  await walk('z',6);
  const coldHit=await whenPlaying(s=>s.hp<coldBefore.hp,'active cold return lowers integrity',3800);
  console.log(JSON.stringify({report,heatHit:heatHit.hp,offPhaseHp:nightBefore.hp,coldHit:coldHit.hp,revived:{x:revived.x,z:revived.z,hp:revived.hp,deaths:revived.deaths}}));
}

async function landingShot(chapter,before) {
  const [x,,z,yaw]=await until(()=>read('window.landing'),'authored apron seated at the real exit');
  let current=before;
  let axis=null;
  if (Math.hypot(x-before.x,z-before.z)<.99) {
    const dx=Math.sin(yaw), dz=Math.cos(yaw);
    axis=Math.abs(dx)>.5?'x':'z';
    await moveTo(axis,axis==='x'?x+1.15*dx:z+1.15*dz);
    current=await snapshot();
  }
  const range=Math.hypot(x-current.x,z-current.z);
  if (range>.16) await aim('yaw',Math.atan2(x-current.x,current.z-z));
  await aim('pitch',-Math.atan2(1.63,Math.max(.89,range)));
  const result=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
  await writeFile(join(process.env.LANDING_STILLS,['boiler','archive','roof'][chapter]+'-landing.jpg'),Buffer.from(result.data,'base64'));
  await aim('yaw',before.yaw); await aim('pitch',before.pitch);
  if (axis) await moveTo(axis,before[axis]);
}

async function inspectionRecordShot(chapter,key,before) {
  const loaded=await until(()=>read(`window.clueModels?.[${JSON.stringify(key)}]?.parts && window.clueModels[${JSON.stringify(key)}]`),'modeled evidence mounted');
  assert.match(loaded.name,new RegExp(['Boiler','Office','Roof'][chapter]+'Record'+key));
  assert.ok(loaded.visible);
  const [x,y,z]=loaded.at;
  const range=Math.hypot(x-before.x,z-before.z);
  await aim('pitch',-Math.atan2(1.66-y,Math.max(.43,range)));
  if (range>.2) await aim('yaw',Math.atan2(x-before.x,before.z-z));
  const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:92});
  await writeFile(join(process.env.INSPECTION_PROOF,loaded.name+'.jpg'),Buffer.from(shot.data,'base64'));
  await aim('yaw',before.yaw);
  await aim('pitch',before.pitch);
}

async function playBindings() {
  const classicEntry = gameEntry === '/index.html' ? '/classic/index.html' : '/index.html';
  for (const [kind, path] of [['3D', gameEntry], ['2D', classicEntry]]) {
    const firstPerson = kind === '3D';
    const readState = firstPerson ? snapshot : () => read('window.lastLight?.snapshot()');
    const phaseHint = firstPerson ? '#phase-key' : '#shift-button kbd';
    const settings = firstPerson ? '#settings-button' : '#settings-menu';
    const close = firstPerson ? '#close-panel' : '#settings-close';
    const slot = action => '[data-bind-action="' + action + '"][data-bind-slot="0"]';
    const contents = selector => read('document.querySelector(' + JSON.stringify(selector) + ')?.textContent');
    const activateSlot = action => clickVisible(slot(action));
    await send('Page.navigate', { url: origin + path });
    await until(async () => {
      const state = await readState();
      return state?.mode === 'menu' && (!firstPerson || state.webgl);
    }, kind + ' game initialized');
    assert.equal(await contents(phaseHint), 'Right mouse');

    await clickVisible(settings);
    await clickVisible('[data-player-tab="controls"]');
    await activateSlot('shift');
    await tap('KeyX');
    assert.equal(await contents(slot('shift')), 'X');
    await activateSlot('interact');
    await clickVisible(slot('interact'), 'right');
    assert.equal(await contents(slot('interact')), 'Right mouse');
    await activateSlot('shift');
    await clickVisible(slot('shift'), 'right');
    assert.match(await contents('.player-binding-message'), /Right mouse is bound to Interact/);
    await clickVisible('.player-binding-capture button:nth-last-child(2)');
    assert.equal(await contents(slot('shift')), 'Right mouse');
    assert.equal(await contents(slot('interact')), 'X');
    await clickVisible('.player-binding-reset');
    assert.equal(await contents(slot('interact')), 'E');
    await clickVisible(close);

    await clickVisible('#start');
    await until(async () => {
      const state = await readState();
      return state?.mode === 'playing' && !state.scene;
    }, kind + ' campaign entered', 16000);
    assert.equal((await readState()).phase, 'day');
    await tap('KeyX');
    assert.equal((await readState()).phase, 'day');
    await tap('MouseRight');
    await until(async () => (await readState()).phase === 'night', kind + ' right-click phase switch');
    assert.equal((await readState()).mode, 'playing');

    await tap('Escape');
    await until(async () => (await readState()).mode === 'paused', kind + ' paused');
    await clickVisible(settings);
    await activateSlot('shift');
    await tap('KeyX');
    await activateSlot('pause');
    await clickVisible(slot('pause'), 'right');
    assert.equal(await contents(slot('pause')), 'Right mouse');
    await clickVisible(close);
    await clickVisible('#start');
    await until(async () => (await readState()).mode === 'playing', kind + ' resumed');
    await delay(440); // Phase cooldown is temporarily frozen while this run is paused.
    await tap('KeyX');
    await until(async () => (await readState()).phase === 'day', kind + ' rebound X changes phase');
    await tap('MouseRight');
    await until(async () => (await readState()).mode === 'paused', kind + ' right mouse reassigned to pause');
    console.log(kind + ' right-click phase and key binding controls passed');
  }
}

async function pauseAndReadGuide() {
  await tap('Escape');
  await whenPlaying(state => state.mode === 'paused', 'player paused at landing');
  const guide = await read("document.querySelector('#guide-note').textContent");
  await clickVisible('#start');
  await whenPlaying(state => state.mode === 'playing', 'continued after reading the guide');
  return guide;
}

async function showOfficeNote() {
  const start = await snapshot();
  await moveTo('x', tileCentre(9) - .38);
  await moveTo('z', tileCentre(14) + 1.52);
  await aim('pitch', -.20);
  await tap('KeyE');
  await until(() => read("document.querySelector('#dialogue').textContent.includes('keep your eyes down')"), 'office recording starts');
  await delay(4850);
  await moveTo('z', start.z);
  await moveTo('x', start.x);
  await aim('pitch', -.42);
}

async function showOfficeNurse() {
  const start = await snapshot();
  await moveTo('x', tileCentre(12) - .55);
  const side = await snapshot();
  const nurse = side.gaze.figures.find(item => item.active && item.x > side.x);
  assert.ok(nurse, 'archive nurse positioned for the recorded encounter');
  await aim('yaw', Math.atan2(nurse.x - side.x, side.z - nurse.z));
  await aim('pitch', 0);
  await whenPlaying(state => state.gaze.amount > .47, 'nurse makes eye contact and begins charging');
  await aim('pitch', -.43);
  await whenPlaying(state => !state.gaze.direct && state.gaze.amount === 0, 'look down to stop the attack');
  await delay(430);
  await aim('yaw', 0);
  await moveTo('x', start.x);
}

async function playMourning() {
  await startChapter(1);
  if (process.env.MOURNING_FOLEY) {
    const trace = await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./audio.js').then(({HorrorAudio})=>{
      window.mourningFoley=[];
      const cue=HorrorAudio.prototype.cueMourning;
      HorrorAudio.prototype.cueMourning=function(name,at,position){
        if(this.context&&!this.muted)window.mourningFoley.push({name,at,x:position?.x,z:position?.z});
        return cue.call(this,name,at,position);
      };
    })`});
    assert.equal(trace.exceptionDetails,undefined);
  }
  const model = await until(() => read(`(() => {
    const asset = performance.getEntriesByType('resource').find(entry =>
      entry.name.endsWith('/archive-nurse.glb') && entry.decodedBodySize > 0);
    return asset && { bytes: asset.decodedBodySize, loadMs: Math.round(asset.duration) };
  })()`), 'the new nurse model loaded');
  const observed = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({ Visual }) => {
    const original = Visual.prototype.updateProps;
    Visual.prototype.updateProps = function(state, time) {
      original.call(this, state, time);
      if (${Boolean(process.env.WOUND_PROOF)}) window.nurseWoundView=this;
      if (window.nurseRig) return;
      const actor = [...this.ghosts.values()].find(item => item.kind === 'mourning' && item.group.visible && item.pose);
      if (!actor) return;
      const rig = {skins:0, wraps:false, twill:false, wings:false};
      actor.pose.figure.traverse(node => {
        if (/WingAnchor|WingLRoot|WingRRoot/.test(node.name)) rig.wings=true;
        if (!node.isSkinnedMesh) return;
        rig.skins++;
        rig.wraps ||= node.material.name === 'Aged layered face wraps' && !!node.material.normalMap;
        rig.twill ||= node.material.name === 'Laundered ivory twill' && !!node.material.normalMap;
      });
      window.nurseRig = rig;
    };
  })` });
  assert.equal(observed.exceptionDetails, undefined, 'Attach read-only nurse rig observer');
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
  const rig = await until(() => read('window.nurseRig'), 'a skinned nurse entered the game camera');
  assert.ok(rig.skins >= 8 && rig.wraps && rig.twill && !rig.wings, JSON.stringify(rig));
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
  if (process.env.MOURNING_FOLEY) {
    const cues=await read('window.mourningFoley');
    const rush=cues.find(e=>e.name==='mourning-rush');
    const released=cues.find(e=>e.name==='mourning-release');
    assert.ok(rush && released && rush.at < released.at && Number.isFinite(rush.x),JSON.stringify(cues));
    console.log(JSON.stringify({clerkFoley:cues}));
  }

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
    ['hold', process.env.WOUND_PROOF ? .34 : .19, 'mourning-capture'],
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
    if (beat === 'hold' && process.env.WOUND_PROOF) {
      const proof=await read(`(() => {
        const v=window.nurseWoundView,kinds=new Set();
        v.ghosts.forEach(actor=>actor.pose?.figure.traverse(o=>{if(o.material?.userData.woundFinish)kinds.add(o.material.userData.woundFinish);}));
        const programs=v.renderer.info.programs.filter(p=>p.cacheKey.includes('wound-finish-v1:'));
        return {kinds:[...kinds],compiled:programs.length,failed:programs.filter(p=>p.diagnostics?.runnable===false).length,
          drops:v.air.slots.filter(p=>p.life>0&&p.motion==='blood').length,
          handInk:v.janitorHands.handInk.map(i=>i.value)};
      })()`);
      assert.deepEqual(proof.kinds.sort(),['fabric','teeth','worker','wraps']);
      const reduced=Boolean(process.env.REDUCED_WOUND_PROOF);
      assert.ok(proof.compiled>=5&&proof.failed===0&&(reduced ? proof.drops===0 : proof.drops>0)&&proof.handInk.some(v=>v>.4),JSON.stringify(proof));
      console.log(JSON.stringify({nurseWoundFinish:proof}));
    }
    if (beat === 'revival' && process.env.WOUND_PROOF) {
      assert.ok(await read(`window.nurseWoundView.janitorHands.handInk.every(i=>i.value===0)&&
        Number.isFinite(window.nurseWoundView.janitorHands.counterHand.position.x)`),'revival restores clean and finite hand pose');
    }
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
  console.log(JSON.stringify({ model, rig, mouseLook: mouse.yaw - beforeMouse.yaw, warning: glimpse.gaze.amount, recoveryPitch: safe.pitch,
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

async function observeVoicePlayback() {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const fetchOriginal = window.fetch;
    const decoded = new WeakMap(), files = new Map();
    const key = bytes => bytes.byteLength + ':' + new Uint8Array(bytes,0,Math.min(160,bytes.byteLength)).join('.');
    window.qaSpoken = [];
    window.fetch = async (...args) => {
      const response = await fetchOriginal(...args);
      const file = new URL(response.url || String(args[0]), location.href).pathname.split('/').at(-1);
      if (response.ok && file.startsWith('mourning-') && /-(en|zh)\\.m4a$/.test(file)) {
        files.set(key(await response.clone().arrayBuffer()), file);
      }
      return response;
    };
    const originalDecode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function(bytes, ...rest) {
      const file = files.get(key(bytes));
      const promise = originalDecode.call(this, bytes, ...rest);
      return file ? promise.then(buffer => { decoded.set(buffer, file); return buffer; }) : promise;
    };
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      const file = decoded.get(this.buffer);
      if (file) window.qaSpoken.push(file);
      return originalStart.apply(this, args);
    };
  }` });
}

async function playClassicEnglishVoice() {
  await observeVoicePlayback();
  const entry = gameEntry === '/index.html' ? '/classic/index.html' : '/index.html';
  await send('Page.navigate', { url: origin + entry });
  await until(() => read('window.lastLight?.snapshot()?.mode === "menu"'), 'Classic ready');
  if (await read("document.querySelector('#language').textContent.trim() !== 'EN'")) await clickVisible('#language');
  await clickVisible('#start');
  await until(() => read("window.lastLight?.snapshot()?.mode === 'playing' && !window.lastLight.snapshot().scene"), 'Classic player has control', 12000);
  await hold(['KeyD'], () => until(() => read("qaSpoken.includes('mourning-boiler-en.m4a')"), 'Classic Boiler guide plays in English', 9500));
  assert.equal(await read("document.querySelector('#language').textContent.trim()"), 'EN');
  assert.ok(!(await read("performance.getEntriesByType('resource').some(entry => /-zh\\.m4a$/.test(entry.name))")));
  console.log(JSON.stringify({edition:'Classic', interface:'zh', voices:await read('qaSpoken')}));
}

async function playRoofCombat(folder) {
  await mkdir(folder, { recursive: true });
  await observeVoicePlayback();
  const snapShot = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    await writeFile(join(folder, name + '.jpg'), Buffer.from(shot.data, 'base64'));
  };
  await startChapter(0);
  await tap('KeyF');
  assert.equal((await snapshot()).roofCombat, null);
  assert.ok(await read("document.querySelector('#touch-attack').hidden"));
  await startChapter(2);
  await until(() => read("qaSpoken.includes('mourning-roof-en.m4a') && /[\\u4e00-\\u9fff]/.test(document.querySelector('#dialogue').textContent) && !document.querySelector('#dialogue').hidden"), 'English roof recording starts with Chinese captions');
  assert.ok(!(await read("performance.getEntriesByType('resource').some(entry => /-zh\\.m4a$/.test(entry.name))")));
  const probe = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({Visual})=> {
    const draw=Visual.prototype.render;
    Visual.prototype.render=function(...args){ window.combatView=this; return draw.apply(this,args); };
  })` });
  assert.equal(probe.exceptionDetails, undefined);
  await until(() => read('window.combatView?.janitorHands.wrench.children.length === 1'), 'Poly Haven tool mounted');
  await snapShot('roof-english-voice-chinese-captions');
  await tap('KeyF');
  await whenPlaying(state => state.roofCombat.feedback === 'miss', 'out of range swing misses');
  await moveTo('z', tileCentre(15));
  await tap('KeyE');
  assert.equal(await read("JSON.parse(localStorage.getItem('last-light-3d-v1')).checkpoint"), '11/15');
  await phaseTo('night');
  await moveTo('x', tileCentre(12));
  await moveTo('z', tileCentre(10));
  await phaseTo('day');
  await moveTo('x', tileCentre(13));
  await moveTo('z', tileCentre(7) + .22);
  await aim('yaw', .38);
  await phaseTo('night');
  await whenPlaying(state => state.roofCombat.figures.some(g => g.phase === 'night' && Math.hypot(g.x-state.x, g.z-state.z) < 2.32), 'night figure enters striking range');
  await tap('KeyF');
  const stagger = await whenPlaying(state => state.roofCombat.feedback === 'hit', 'first strike staggers');
  if (process.env.WOUND_PROOF) {
    const proof=await read(`(() => {const v=window.combatView;
      const programs=v.renderer.info.programs.filter(p=>p.cacheKey.includes('wound-finish-v1:'));
      return {compiled:programs.length,failed:programs.filter(p=>p.diagnostics?.runnable===false).length,
        drops:v.air.slots.filter(p=>p.life>0&&p.motion==='blood').length,handInk:v.janitorHands.handInk.map(i=>i.value)};})()`);
    assert.ok(proof.compiled>=3&&proof.failed===0&&proof.drops>0&&proof.handInk.some(v=>v>.4),JSON.stringify(proof));
    console.log(JSON.stringify({workerWoundFinish:proof}));
    await delay(83);
  }
  await snapShot('roof-stagger');
  await whenPlaying(state => !state.roofCombat.swinging, 'wrench recovers');
  // Use the canvas mouse shortcut for the second swing.
  await clickVisible('#scene');
  const banished = await whenPlaying(state => state.roofCombat.banished === 1, 'second strike banishes');
  await snapShot('roof-banished');
  await phaseTo('day');
  await delay(280);
  await phaseTo('night');
  assert.equal((await snapshot()).roofCombat.figures.find(g => g.phase === 'night').active, false);
  const voices = await read('qaSpoken');
  await aim('yaw', 0);
  await hold(['KeyW'], () => until(async () => (await snapshot()).life === 'dying', 'fall from the far roof edge', 5000));
  const recovered = await until(async () => {
    const state = await snapshot();
    return state.life === 'alive' && at(state, 11, 15) && state;
  }, 'roof lamp restores the player', 6000);
  assert.equal(recovered.deaths, 1);
  assert.equal(recovered.hp, 3);
  assert.equal(recovered.roofCombat.hits, 0);
  assert.equal(recovered.roofCombat.banished, 0);
  assert.ok(recovered.roofCombat.figures.every(g => !g.banished));
  // Fresh mobile profile on the same extracted package. A real CDP touch,
  // not JS event injection, has to start a swing from the dedicated button.
  await send('Emulation.setDeviceMetricsOverride', { width: 780, height: 390, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await startChapter(2);
  const touch = await until(() => read(`(() => {
    const r = document.querySelector('#touch-attack').getBoundingClientRect();
    const status = document.querySelector('#roof-tool').getBoundingClientRect();
    const x=r.x+r.width/2, y=r.y+r.height/2;
    return r.width>=44 && r.height>=44 && status.bottom < r.top &&
      document.elementFromPoint(x,y)?.id === 'touch-attack' && { x,y };
  })()`), 'dedicated landscape touch strike button clear of the status');
  await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[touch] });
  await whenPlaying(state => state.roofCombat.swinging, 'touch starts the swing');
  await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await whenPlaying(state => state.roofCombat.feedback === 'miss', 'touch swing resolves normally');
  await snapShot('roof-touch');
  console.log(JSON.stringify({ voices, firstStrike: stagger.roofCombat, secondStrike: banished.roofCombat, phaseRemainsBanished: true, roofCheckpointRecovery: true, mobileEmulation: true }));
}

async function auditArchiveFit(folder) {
  await mkdir(folder,{recursive:true});
  await startChapter(1);
  const observer=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
    const render=Visual.prototype.render;
    Visual.prototype.render=function(...args){window.fitView=this;return render.apply(this,args);};
  })`});
  assert.equal(observer.exceptionDetails,undefined);
  await until(()=>read(`Boolean(window.fitView?.stage.getObjectByName('Architecture: ArchiveSocketPlate'))`),'socket geometry mounted');
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`Promise.all([import('three'),window.fitView.environmentReady]).then(([{Raycaster,Vector3}])=>{
    const v=window.fitView,stage=v.stage,model=stage.getObjectByName('Architecture: ArchiveSocketPlate');
    const layout=v.detail.get('ArchiveSocketPlate').points;
    const meshes=[];
    stage.traverseVisible(o=>{if(o.isMesh&&o.material?.transparent!==true)meshes.push(o);});
    const direction=new Vector3(),origin=new Vector3(),cast=new Raycaster(origin,direction,0,.34);
    const parent=o=>{const names=[];for(;o&&o!==stage;o=o.parent)if(o.name)names.push(o.name);return names.join(' / ')||'(unnamed)';};
    return layout.map(([x,y,z,a])=>{
      const dx=Math.sin(a),dz=Math.cos(a),positions=[];
      for(const [u,h] of [[0,0],[-.106,.028],[.106,.028],[-.105,-.033],[.105,-.033]]) {
        cast.ray.origin.set(x+dx*.34+dz*u,y+h,z+dz*.34-dx*u);
        cast.ray.direction.set(-dx,0,-dz);
        const hits=cast.intersectObjects(meshes,false);
        const own=hits.find(h=>h.object.parent===model);
        const first=hits[0];
        positions.push(own&&first.distance>=own.distance-.004?'clear':first?parent(first.object):'missing plate sample');
      }
      return {x,y,z,a,positions};
    });
  })`});
  assert.equal(result.exceptionDetails,undefined);
  const samples=result.result.value;
  await writeFile(join(folder,'socket-fits.json'),JSON.stringify(samples,null,2)+'\n');
  const blocked=samples.filter(r=>r.positions.some(p=>p!=='clear'));
  if (process.env.FIT_VISUAL_STILLS) {
    assert.equal(blocked.length,0,'no archive socket has an occluder over its sampled face');
    const target=samples.find(p=>p.x>23.9&&p.x<24&&p.z>2.4&&p.z<2.5);
    assert.ok(target,'cleared socket beside the handover board');
    assert.equal(await read(`window.fitView.architecture.get('ArchiveWindow').points.some(([x,,z])=>Math.abs(x-22.8)<.02&&Math.abs(z-2.418)<.02)`),false,
      'no duplicate decorative sash behind the handover board');
    await moveTo('z',tileCentre(14)); await moveTo('x',tileCentre(11)); await moveTo('z',tileCentre(2));
    await phaseTo('night'); await moveTo('x',tileCentre(10)); await moveTo('z',tileCentre(1)+.55);
    const s=await snapshot();
    await aim('yaw',Math.atan2(target.x-s.x,s.z-target.z)); await aim('pitch',-.04);
    for (const phase of ['night','day']) {
      await phaseTo(phase); await delay(320);
      const image=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
      await writeFile(join(folder,'handover-board-socket-'+phase+'.jpg'),Buffer.from(image.data,'base64'));
    }
  }
  console.log(JSON.stringify({plates:samples.length,blocked}));
}

// Diagnostic only: a ray blocked by another visible prop is a review
// candidate, not automatically a defect (an intentionally screened fixture
// can be visually sound). Keep the samples and blocker identity for review.
async function auditFitCandidates(folder) {
  await mkdir(folder,{recursive:true});
  const all={};
  for(const [chapter,plan] of [
    [0,{BoilerControlPlate:[.106,.033,0],BoilerLouvre:[.43,.29,0]}],
    [1,{ArchiveWindow:[.45,.28,0],ArchiveDoor:[.24,.20,1.84]}]
  ]) {
    await startChapter(chapter);
    const observe=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(state,...args){
        window.fitCandidateView=this;
        return draw.call(this,window.fitPhotoPose?{...state,...window.fitPhotoPose,reducedMotion:true}:state,...args);
      };
    })`});
    assert.equal(observe.exceptionDetails,undefined);
    await until(()=>read('Boolean(window.fitCandidateView?.stage)'),'candidate scene');
    const audit=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`Promise.all([import('three'),window.fitCandidateView.environmentReady]).then(([{Raycaster,Vector3,Matrix4}])=>{
      const v=window.fitCandidateView,stage=v.stage,result={};
      const meshes=[];
      stage.traverseVisible(o=>{if(o.isMesh&&o.material?.transparent!==true)meshes.push(o);});
      const ray=new Raycaster(new Vector3(),new Vector3(),0,.42);
      const label=o=>{const names=[];for(;o&&o!==stage;o=o.parent)if(o.name)names.push(o.name);return names.join(' / ')||'(unnamed)';};
      const tray=v.stage.getObjectByName('Architecture: ArchiveSignTray');
      if(tray) {
        const points=v.signMounts.get('ArchiveSignTray').points;
        if(tray.children.some(o=>o.count!==points.length)||v.signMounts.get('ArchiveSignTray').fallback.visible) throw new Error('Incomplete sign tray mount');
        const front=v.stage.getObjectByName('Hand printed wall signs');
        result.ArchiveSignTray=points.map(([x,y,z,a,size])=>{
          const dx=Math.sin(a),dz=Math.cos(a),samples=[];
          ray.ray.direction.set(-dx,0,-dz);
          for(const [l,b] of [[0,0],[-.72,.26],[.72,.26],[-.72,-.26],[.72,-.26]]) {
            ray.ray.origin.set(x+dx*.42+dz*l*size,y+b*size,z+dz*.42-dx*l*size);
            const hits=ray.intersectObjects(meshes,false);
            const print=hits.find(o=>o.object===front),body=hits.find(o=>o.object.parent===tray);
            const okay=print&&body&&hits[0]===print&&body.distance-print.distance>=.001;
            samples.push({u:l,y:b,own:print?.distance??null,blocker:okay?null:hits.length?label(hits[0].object):'missing sign'});
          }
          return {x,y,z,a,samples};
        });
      }
      for(const [name,[u,h,baseline]] of Object.entries(${JSON.stringify(plan)})) {
        const model=stage.getObjectByName('Architecture: '+name);
        const points=(v.detail.get(name)??v.architecture.get(name)).points;
        result[name]=points.map(([x,y,z,a])=>{
          const dx=Math.sin(a),dz=Math.cos(a), samples=[];
          ray.ray.direction.set(-dx,0,-dz);
          for(const [l,b] of [[0,0],[-u,h],[u,h],[-u,-h],[u,-h]]) {
            ray.ray.origin.set(x+dx*.42+dz*l,y+baseline+b,z+dz*.42-dx*l);
            const hits=ray.intersectObjects(meshes,false);
            const own=hits.find(k=>k.object.parent===model),first=hits[0];
            const isBlocked=own&&first.distance<own.distance-.004;
            let instance=null;
            if(isBlocked&&first.object.isInstancedMesh) {
              const matrix=new Matrix4();first.object.getMatrixAt(first.instanceId,matrix);
              instance={position:matrix.elements.slice(12,15),scale:new Vector3().setFromMatrixScale(matrix).toArray()};
            }
            samples.push({u:l,y:b,own:own?.distance??null,blocker:isBlocked?label(first.object):null,instance});
          }
          return {x,y,z,a,samples};
        });
      }
      return result;
    })`});
    assert.equal(audit.exceptionDetails,undefined);
    Object.assign(all,audit.result.value);
    if (process.env.FIT_PHOTO_CASES) {
      const cases=chapter===0 ? [['boiler-drop',5.51,1.52,9.618,0]] : [
        ['archive-cabinet-sash',30,1.87,14.418,0],['archive-personnel-sign',33.582,1.95,27.6,-Math.PI/2],
        ['archive-staff-sign',11.982,1.95,30,-Math.PI/2],['archive-time-sign',19.218,1.95,34.8,Math.PI/2],
        ['archive-ticketcase',19.218,1.7,37.2,Math.PI/2],['archive-cabinet-door',40.818,1.57,6,Math.PI/2]
      ];
      for (const phase of ['day','night']) {
        await phaseTo(phase);
        for (const [name,x,y,z,a] of cases) {
          const nx=Math.sin(a),nz=Math.cos(a), px=x+nx*1.60+nz*.43,pz=z+nz*1.60-nx*.43;
          const pose={x:px,z:pz,y:0,yaw:Math.atan2(x-px,pz-z),pitch:Math.atan2(y-1.65,1.65)};
          await read(`window.fitPhotoPose=${JSON.stringify(pose)}`);
          await delay(275);
          const image=await send('Page.captureScreenshot',{format:'jpeg',quality:91});
          await writeFile(join(folder,`${name}-${phase}.jpg`),Buffer.from(image.data,'base64'));
        }
        await read('window.fitPhotoPose=null');
      }
      if(chapter===1 && process.env.ASSERT_FIT_RC33) {
        await phaseTo('day');
        await moveTo('x',tileCentre(8)+.14); await moveTo('z',tileCentre(14)+.27);
        const s=await snapshot();
        await aim('yaw',Math.atan2(19.218-s.x,s.z-34.8));
        await aim('pitch',.52);
        assert.equal(await read('window.fitPhotoPose'),null,'walked photo is not a render override');
        for(const phase of ['day','night']) {
          await phaseTo(phase); await delay(315);
          const image=await send('Page.captureScreenshot',{format:'jpeg',quality:91});
          await writeFile(join(folder,`archive-time-sign-walked-${phase}.jpg`),Buffer.from(image.data,'base64'));
        }
      }
    }
  }
  await writeFile(join(folder,'fit-review-candidates.json'),JSON.stringify(all,null,2)+'\n');
  const summary=Object.fromEntries(Object.entries(all).map(([k,rows])=>[k,{
    points:rows.length,observedBlockers:rows.filter(row=>row.samples.some(s=>s.blocker)).length,
    notIntersected:rows.filter(row=>row.samples.every(s=>s.own===null)).length
  }]));
  if(process.env.ASSERT_FIT_RC33) {
    assert.deepEqual(Object.fromEntries(Object.entries(summary).map(([k,v])=>[k,v.points])),{
      BoilerControlPlate:49,BoilerLouvre:35,ArchiveWindow:36,ArchiveDoor:16,ArchiveSignTray:5
    });
    assert.ok(Object.values(summary).every(v=>!v.observedBlockers&&!v.notIntersected),JSON.stringify(summary));
  }
  console.log(JSON.stringify(summary));
}

async function auditRoofCorners(folder) {
  await mkdir(folder,{recursive:true});
  await startChapter(2);
  const observer=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
    const render=Visual.prototype.render;
    Visual.prototype.render=function(state,...args){
      window.cornerView=this;
      const p=window.cornerPose;
      return render.call(this,p?{...state,...p,reducedMotion:true}:state,...args);
    };
  })`});
  assert.equal(observer.exceptionDetails,undefined);
  await until(()=>read(`Boolean(window.cornerView?.stage.getObjectByName('Architecture: RoofEdge'))`),'roof edge geometry mounted');
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`Promise.all([import('three'),window.cornerView.environmentReady]).then(([{Raycaster,Vector3,Matrix4}] )=>{
    const v=window.cornerView;
    const group=name=>v.stage.getObjectByName('Architecture: '+name);
    const edge=group('RoofEdge'),soffit=group('RoofSoffitEdge'),joint=group('RoofFasciaCorner');
    const points=v.roofCorners?.get('RoofFasciaCorner')?.points??[];
    const fallback=v.roofCorners?.get('RoofFasciaCorner')?.fallback;
    const tileSize=${TILE},half=tileSize/2;
    const ray=new Raycaster(new Vector3(),new Vector3(),0,1.3);
    const extents=[];
    if(joint) for(const [i,[x,,z,yaw]] of points.entries()) {
      const at=new Vector3(),world=new Matrix4();
      let top=-Infinity,bottom=Infinity,outer=-Infinity,inward=Infinity;
      for(const part of joint.children) {
        part.getMatrixAt(i,world);
        const positions=part.geometry.getAttribute('position');
        for(let j=0;j<positions.count;j++) {
          at.fromBufferAttribute(positions,j).applyMatrix4(world);
          const u=(at.x-x)*Math.cos(yaw)-(at.z-z)*Math.sin(yaw);
          const w=(at.x-x)*Math.sin(yaw)+(at.z-z)*Math.cos(yaw);
          top=Math.max(top,at.y); bottom=Math.min(bottom,at.y);
          outer=Math.max(outer,u,w); inward=Math.min(inward,u,w);
        }
      }
      extents.push({top,bottom,outer,inward});
    }
    const samples=[];
    const voidEdge=k=>!k||k==='d'||k==='n';
    for(const tile of v.decoded.floors) {
      if(voidEdge(tile.kind)) continue;
      for(const dx of [-1,1]) for(const dz of [-1,1]) {
        const a=v.decoded.get(tile.col+dx,tile.row)?.kind,b=v.decoded.get(tile.col,tile.row+dz)?.kind;
        if(!voidEdge(a)||!voidEdge(b)) continue;
        const x=tile.x+dx*half,z=tile.z+dz*half;
        const hits=[];
        for(const y of [-.242,-.31,-.65,-1.23,-1.89,-2.078]) {
          ray.ray.origin.set(x+.55*dx,y,z+.55*dz);
          ray.ray.direction.set(-dx,0,-dz).normalize();
          const hitsAtHeight=ray.intersectObjects([...edge.children,...soffit.children,...(joint?.children??[])],false);
          const first=hitsAtHeight[0];
          const own=hitsAtHeight.some(h=>h.object.parent===joint&&Math.hypot(points[h.instanceId][0]-x,points[h.instanceId][2]-z)<.01);
          hits.push({y,source:first?.object.parent.name??null,dist:first?.distance??null,own});
        }
        samples.push({col:tile.col,row:tile.row,x,z,dx,dz,neighbors:[a??'void',b??'void'],hits});
      }
    }
    return {samples,extents,permanent:joint?.parent===v.stage,fallbackHidden:fallback?.visible===false,counts:joint?.children.map(o=>o.count)??[]};
  })`});
  assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));
  const r=result.result.value;
  assert.equal(r.samples.length,25);
  const phaseTile=k=>k==='d'||k==='n';
  const outside=k=>!k||phaseTile(k);
  const roof=decodeLevel(LEVELS[2]);
  let expectedPhaseEdges=0;
  for(const tile of roof.floors)if(!outside(tile.kind)){
    for(const dx of [-1,1])for(const dz of [-1,1]){
      const sides=[roof.get(tile.col+dx,tile.row)?.kind,roof.get(tile.col,tile.row+dz)?.kind];
      if(sides.every(outside))expectedPhaseEdges+=sides.filter(phaseTile).length;
    }
  }
  if(process.env.ASSERT_ROOF_CORNERS) {
    assert.equal(r.extents.length,25);
    assert.ok(r.permanent&&r.fallbackHidden&&r.counts.length&&r.counts.every(n=>n===25));
    for(const e of r.extents) {
      assert.ok(e.top<-.13&&e.bottom>=-2.20&&e.outer<.095&&e.inward>=-.42,JSON.stringify(e));
    }
    for(const corner of r.samples) {
      assert.ok(corner.hits.every(h=>h.own&&h.source),JSON.stringify(corner));
      // The lookout runs between diagonally touching permanent corners.
      // The neighboring permanent fascia can hit first along those diagonals.
      const diagonal=roof.get(corner.col+corner.dx,corner.row+corner.dz)?.kind;
      if(outside(diagonal))assert.ok(corner.hits.every(h=>h.source==='Architecture: RoofFasciaCorner'),JSON.stringify(corner));
    }
  }
  await writeFile(join(folder,'roof-corners.json'),JSON.stringify(r,null,2)+'\n');
  if(process.env.ASSERT_ROOF_SPLICES) {
    const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`import('three').then(({Raycaster,Vector3})=>{
      const v=window.cornerView,plan=v.roofSplices.get('RoofFasciaSplice');
      const model=v.stage.getObjectByName('Architecture: RoofFasciaSplice');
      const edge=v.stage.getObjectByName('Architecture: RoofEdge');
      const lower=v.stage.getObjectByName('Architecture: RoofSoffitEdge');
      const ray=new Raycaster(new Vector3(),new Vector3(),0,.62);
      const rows=plan.points.map(([x,,z,yaw])=>{
        const dx=Math.sin(yaw),dz=Math.cos(yaw);
        const h=[-.232,-1.23,-2.078].map(y=>{
          ray.ray.origin.set(x+dx*.56,y,z+dz*.56);
          ray.ray.direction.set(-dx,0,-dz);
          const first=ray.intersectObjects([...edge.children,...lower.children,...model.children],false)[0];
          return {height:y,splice:first?.object.parent===model};
        });
        return {x,z,yaw,h};
      });
      return {rows,counts:model.children.map(p=>p.count),owned:model.parent===v.stage,loaded:!plan.fallback.visible};
    })`});
    assert.equal(result.exceptionDetails,undefined,JSON.stringify(result.exceptionDetails));
    const splices=result.result.value;
    const spliceCount=splices.rows.length;
    assert.ok(spliceCount>=112&&splices.owned&&splices.loaded&&splices.counts.every(n=>n===spliceCount));
    assert.equal(new Set(splices.rows.map(({x,z,yaw})=>[x,z,yaw].map(v=>v.toFixed(3)).join('/'))).size,spliceCount);
    assert.ok(splices.rows.every(row=>row.h.every(h=>h.splice)),JSON.stringify(splices.rows.filter(row=>row.h.some(h=>!h.splice))));
    await writeFile(join(folder,'roof-straight-splices.json'),JSON.stringify(splices,null,2)+'\n');
  }
  const locations=r.samples.filter(c=>c.neighbors.some(k=>k==='d'||k==='n')||c.col===15&&c.row===17);
  const phaseEdges=[];
  for(const phase of ['day','night']) {
    await phaseTo(phase);
    const edgeProbe=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`import('three').then(({Raycaster,Vector3})=>{
      const v=window.cornerView, phase=${JSON.stringify(phase)},tile=${TILE};
      const status=[];
      const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0),0,.7);
      const inspect=[];
      for(const label of ['day','night']) {
        const g=v.groups[label];
        g.traverseVisible(o=>{if(o.isMesh)inspect.push(o);});
      }
      for(const corner of ${JSON.stringify(locations)}) for(let i=0;i<2;i++) {
        const k=corner.neighbors[i];
        if(k!=='d'&&k!=='n')continue;
        const col=corner.col+(i===0?corner.dx:0),row=corner.row+(i===1?corner.dz:0);
        ray.ray.origin.set((col+.5)*tile,.38,(row+.5)*tile);
        const hits=ray.intersectObjects(inspect,false);
        const found=hits.some(h=>h.object.parent?.name==='Architecture: PhaseDeck'+(k==='d'?'Day':'Night'));
        status.push({corner:[corner.col,corner.row],col,row,phase,required:k==='d'?'day':'night',found});
      }
      return status;
    })`});
    assert.equal(edgeProbe.exceptionDetails,undefined,JSON.stringify(edgeProbe.exceptionDetails));
    phaseEdges.push(...edgeProbe.result.value);
    for(const {col,row,x,z,dx,dz,neighbors} of locations) {
      const diagonalSolid=!outside(roof.get(col+dx,row+dz)?.kind);
      const phaseAlongX=phaseTile(neighbors[0]);
      const px=x+dx*(diagonalSolid?(phaseAlongX?2.05:-.58):2.30);
      const pz=z+dz*(diagonalSolid?(phaseAlongX?-.58:2.05):1.68);
      await read(`window.cornerPose=${JSON.stringify({x:px,z:pz,y:diagonalSolid?-2.78:-2.62,yaw:Math.atan2(x-px,pz-z),pitch:-.05})}`);
      await delay(340);
      const image=await send('Page.captureScreenshot',{format:'jpeg',quality:93});
      await writeFile(join(folder,`roof-corner-${col}-${row}-${phase}.jpg`),Buffer.from(image.data,'base64'));
    }
    await read('window.cornerPose=null');
  }
  assert.equal(phaseEdges.length,2*expectedPhaseEdges);
  assert.ok(phaseEdges.every(p=>p.found===(p.phase===p.required)),JSON.stringify(phaseEdges));
  await writeFile(join(folder,'phase-neighbors.json'),JSON.stringify(phaseEdges,null,2)+'\n');
  if(process.env.ROOF_CORNER_LANDING) {
    await phaseTo('day');
    await moveTo('x',tileCentre(15)+.27); await moveTo('z',tileCentre(17)+.24);
    await aim('yaw',2.42); await aim('pitch',-.72);
    for(const phase of ['day','night']) {
      await phaseTo(phase); await delay(340);
      const st=await snapshot();
      assert.ok(at(st,15,17)&&st.y===0&&st.deaths===0);
      assert.equal(await read('window.cornerPose'),null);
      const image=await send('Page.captureScreenshot',{format:'jpeg',quality:93});
      await writeFile(join(folder,`roof-landing-walked-sightline-${phase}.jpg`),Buffer.from(image.data,'base64'));
    }
  }
  let fall=null;
  if(process.env.ROOF_CORNER_FALL) {
    assert.ok(!process.env.ROOF_CORNER_LANDING,'fall route starts from the separate fresh roof checkpoint');
    let col=11,row=16;
    for(const step of 'night N E N5 day E N N! night E7! N E3! N6! W!'.split(' ')) {
      if(step==='day'||step==='night') { await phaseTo(step); continue; }
      const [,dir,count='1',fast]=/^(N|S|E|W)(\d+)?(!)?$/.exec(step);
      const [dx,dz,key]={N:[0,-1,'KeyW'],E:[1,0,'KeyD'],W:[-1,0,'KeyA']}[dir];
      if(dx)await moveTo('z',tileCentre(row));else await moveTo('x',tileCentre(col));
      col+=dx*Number(count);row+=dz*Number(count);
      await hold(fast?['ShiftLeft',key]:[key],()=>whenPlaying(s=>dx*(tileCentre(col)-s.x)+dz*(tileCentre(row)-s.z)<.075,'walk test of phase-adjacent corner '+col+'/'+row,1000+740*Number(count)));
    }
    await phaseTo('day');
    await moveTo('x',tileCentre(22)); await moveTo('z',tileCentre(2));
    const start=await snapshot();
    assert.ok(at(start,22,2)&&start.y===0&&start.phase==='day');
    const dropped=await hold(['KeyD','KeyS'],()=>until(async()=>{
      const s=await snapshot();
      if(s.life==='dying') assert.equal(s.deathCause,'fall');
      return s.y<-.24&&s;
    },'walk over the convex corner and fall through the inactive side',2100));
    assert.ok(Math.hypot(dropped.x-55.2,dropped.z-7.2)<1.9);
    const down=await until(async()=>{const s=await snapshot();return s.life==='dying'&&s;},'corner fall causes checkpoint down',2600);
    assert.equal(down.deathCause,'fall');
    const revived=await until(async()=>{const s=await snapshot();return s.life==='alive'&&s.hp===3&&s;},'corner fall revives at roof checkpoint',4800);
    assert.ok(at(revived,11,16)&&revived.deaths===1);
    fall={start:[start.x,start.z],belowDeck:[dropped.x,dropped.y,dropped.z],cause:down.deathCause,revived:[revived.x,revived.z],deaths:revived.deaths};
    await writeFile(join(folder,'roof-corner-fall.json'),JSON.stringify(fall,null,2)+'\n');
  }
  console.log(JSON.stringify({corners:r.samples.length,missingRays:r.samples.flatMap(c=>c.hits.filter(h=>!h.source)).length,
    modeledRays:r.samples.flatMap(c=>c.hits.filter(h=>h.source==='Architecture: RoofFasciaCorner')).length,counts:r.counts,fall}));
}

async function playCitySightlines(folder) {
  await mkdir(folder,{recursive:true});
  const views=[];
  for(const direction of process.env.CITY_GROUND_MISSING?['south']:['south','west','east']) {
    await startChapter(2);
    const observe=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const render=Visual.prototype.render;
      Visual.prototype.render=function(...args){window.cityView=this;return render.apply(this,args);};
    })`});
    assert.equal(observe.exceptionDetails,undefined);
    await until(()=>read('Boolean(window.cityView?.stage.getObjectByName("Modeled roof skyline"))'),'tower skyline mounted');
    const status=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`Promise.all([import('three'),window.cityView.environmentReady]).then(([{Box3,Matrix4}])=>{
      const v=window.cityView,groups={},matrix=new Matrix4(),box=new Box3();
      for(const [name,p] of v.cityGround??[]) {
        const m=v.stage.getObjectByName('Architecture: '+name);
        let highest=-Infinity,triangles=0;
        for(const part of m?.children??[]) {
          part.geometry.computeBoundingBox();
          triangles+=(part.geometry.index?.count??part.geometry.getAttribute('position').count)*part.count/3;
          for(let i=0;i<part.count;i++) {
            part.getMatrixAt(i,matrix);
            highest=Math.max(highest,box.copy(part.geometry.boundingBox).applyMatrix4(matrix).max.y);
          }
        }
        groups[name]={points:p.points.length,mounted:Boolean(m?.visible&&m.parent===v.stage&&m.children.every(part=>part.count===p.points.length)),batches:m?.children.length??0,highest:Number.isFinite(highest)?highest:null,triangles};
      }
      return {groups,fallbackVisible:v.cityGroundFallback?.visible??true,middle:v.skyline.sites.map(p=>[p.x,p.z,p.width,p.depth,p.height]),
        far:['FarCityOffice','FarCityBrick','FarCityService'].flatMap(n=>v.utilities.get(n).points),feet:v.cityGround?.get('CityTowerFoot')?.points??[]};
    })`});
    assert.equal(status.exceptionDetails,undefined);
    const report=status.result.value;
    if(process.env.ASSERT_CITY_GROUND) {
      assert.ok(Object.keys(report.groups).length===12&&!report.fallbackVisible);
      assert.ok(Object.values(report.groups).every(g=>g.mounted&&g.highest<-17.25));
      assert.ok(Object.values(report.groups).reduce((sum,g)=>sum+g.triangles,0)<155000);
      assert.equal(report.groups.CityTowerFoot.points,116);
      for(const [x,z] of [...report.middle.map(p=>p.slice(0,2)),...report.far.map(([x,,z])=>[x,z])])
        assert.equal(report.feet.filter(([fx,,fz])=>Math.hypot(fx-x,fz-z)<.0001).length,1);
    }
    if(process.env.CITY_GROUND_MISSING) assert.ok(report.fallbackVisible&&Object.values(report.groups).every(g=>!g.mounted));
    let col=11,row=16;
    const walk=async steps=>{
      for(const step of steps.split(' ')) {
        if(step==='day'||step==='night'){await phaseTo(step);continue;}
        const [,dir,count='1',fast]=/^(N|S|E|W)(\d+)?(!)?$/.exec(step);
        const [dx,dz,key]={N:[0,-1,'KeyW'],S:[0,1,'KeyS'],E:[1,0,'KeyD'],W:[-1,0,'KeyA']}[dir];
        if(dx)await moveTo('z',tileCentre(row));else await moveTo('x',tileCentre(col));
        col+=dx*Number(count);row+=dz*Number(count);
        await hold(fast?['ShiftLeft',key]:[key],()=>whenPlaying(s=>dx*(tileCentre(col)-s.x)+dz*(tileCentre(row)-s.z)<.075,'walk skyline '+direction+' '+col+'/'+row,1100+780*Number(count)));
      }
    };
    if(direction==='south') await walk('E4 S');
    if(direction==='west') await walk('night N E N5 day E N N! W7! W! night S2 W4!');
    if(direction==='east') await walk('night N E N5 day E N N! night E7! N E3! day N2 E!');
    const phases=direction==='west'?['night','day']:['day','night'];
    await phaseTo(phases[0]);
    await aim('yaw',{south:2.42,west:-1.90,east:1.07}[direction]);
    await aim('pitch',-.69);
    for(const phase of phases) {
      await phaseTo(phase); await delay(330);
      const state=await snapshot();
      assert.ok(at(state,col,row)&&state.y===0&&state.deaths===0);
      const image=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
      await writeFile(join(folder,`city-${direction}-${phase}.jpg`),Buffer.from(image.data,'base64'));
    }
    views.push({direction,col,row,...report});
  }
  await writeFile(join(folder,'city-sightlines.json'),JSON.stringify(views,null,2)+'\n');
  console.log(JSON.stringify({views:views.map(({direction,col,row})=>({direction,col,row})),groups:views[0].groups}));
}

async function auditWholeMapMounts(folder) {
  await mkdir(folder,{recursive:true});
  const all={};
  for(const [name,chapter,annex] of [['boiler',0,false],['archive',1,false],['transfer',1,true],['roof',2,false]]) {
    await startChapter(chapter,annex);
    const observe=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const render=Visual.prototype.render;
      Visual.prototype.render=function(...args){window.inventoryView=this;return render.apply(this,args);};
    })`});
    assert.equal(observe.exceptionDetails,undefined);
    await until(()=>read('Boolean(window.inventoryView?.stage)'),'map stage initialized');
    const readMap=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`window.inventoryView.environmentReady.then(ready=>{
      const v=window.inventoryView;
      const batches={};
      v.stage.traverse(o=>{
        if(o.isInstancedMesh&&o.name.startsWith('Records ')){
          const full=o.instanceMatrix.count;
          const entry=batches[o.name]??{full,materialBatches:0};
          entry.materialBatches++; batches[o.name]=entry;
        }
      });
      const families={};
      for(const key of ['architecture','junctions','utilities','detail','fit','signMounts','roofCorners','roofSplices','cityGround'])
        for(const [asset,plan] of v[key]??[]) {
          const object=v.stage.getObjectByName('Architecture: '+asset);
          const counts=new Map();
          for(const batch of object?.children??[]) {
            const part=batch.userData.architecturePart;
            counts.set(part,(counts.get(part)??0)+batch.count);
          }
          families[asset]={points:plan.points,phase:plan.phase,batches:object?.children.length??0,
            mounted:Boolean(object?.visible&&object.parent===v.groups[plan.phase]&&counts.size&&
              [...counts.values()].every(count=>count===plan.points.length)&&!plan.fallback.visible)};
        }
      return {families,batches,annexReady:${annex}?ready===true:null};
    })`});
    assert.equal(readMap.exceptionDetails,undefined,JSON.stringify(readMap.exceptionDetails));
    const result=all[name]=readMap.result.value;
    if(annex) {
      assert.ok(result.annexReady&&Object.keys(result.batches).length>20);
      for(const required of ['carpetbound','recessbar','bridgecorner','doorsill','pitwall','rack','barrier'])
        assert.ok(Object.keys(result.batches).some(k=>k.includes(' '+required+' ')),required);
    } else assert.ok(Object.values(result.families).every(f=>f.mounted));
  }
  await writeFile(join(folder,'whole-map-mounts.json'),JSON.stringify(all,null,2)+'\n');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(all).map(([name,r])=>[name,{
    families:Object.keys(r.families).length,placements:Object.values(r.families).reduce((n,f)=>n+f.points.length,0),annexBatches:Object.keys(r.batches).length
  }]))));
}

async function auditImportedServices(folder) {
  await mkdir(folder,{recursive:true});
  const all={};
  const observe=async()=>{
    const result=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const render=Visual.prototype.render;
      Visual.prototype.render=function(state,...args){window.serviceView=this;return render.call(this,window.servicePose?{...state,...window.servicePose,reducedMotion:true}:state,...args);};
    })`});
    assert.equal(result.exceptionDetails,undefined);
    await until(()=>read('Boolean(window.serviceView?.stage)'),'service stage');
  };
  const shot=async name=>{
    await delay(370);
    const image=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(image.data,'base64'));
  };
  const pose=async (px,pz,x,z,height,y=0)=>{
    await read(`window.servicePose=${JSON.stringify({x:px,z:pz,y,yaw:Math.atan2(x-px,pz-z),pitch:Math.atan2(height-1.65-y,Math.hypot(px-x,pz-z))})}`);
  };
  for(const [chapter,key,wanted] of [[0,'generator',2],[1,'utilityBox',1],[2,'hose',2]]) {
    await startChapter(chapter); await observe();
    const m=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`window.serviceView.environmentReady.then(()=>{
      const v=window.serviceView,p=v.mapDressing.get('${key}'),g=v.stage.getObjectByName('Map dressing: ${key}');
      const totals=Object.groupBy(g?.children ?? [], mesh => mesh.userData.dressingPart);
      return {count:p.points.length,visible:g?.visible&&Object.values(totals).every(parts=>parts.reduce((n,mesh)=>n+mesh.count,0)===p.points.length)&&!p.fallback.visible,
        maps:g?.children.filter(x=>x.material.map).length,points:p.points,size:p.size};
    })`});
    assert.equal(m.exceptionDetails,undefined,JSON.stringify(m.exceptionDetails));
    const p=all[key]=m.result.value;
    assert.ok(p.count===wanted&&p.visible&&p.maps>0,JSON.stringify(p));
    if(chapter===0) {
      await moveTo('x',tileCentre(6)+.52); await moveTo('z',tileCentre(17)-.52);
      const s=await snapshot(),q=p.points[0];
      await aim('yaw',Math.atan2(q.x-s.x,s.z-q.z)); await aim('pitch',-.71);
      await shot('generator-actual-walk');
    }
    for(const phase of ['day','night']) {
      await phaseTo(phase);
      for(const [i,q] of p.points.entries()) {
        const dx=Math.sin(q.yaw),dz=Math.cos(q.yaw);
        await pose(q.x+dx*1.47+dz*.37,q.z+dz*1.47-dx*.37,q.x,q.z,q.y+p.size[1]*.52);
        await shot(`${key}-${i+1}-${phase}`);
      }
      await read('window.servicePose=null');
    }
  }
  await startChapter(1,true); await observe();
  const scan=()=>send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`Promise.all([import('three'),window.serviceView.environmentReady]).then(([{Matrix4,Box3}])=>{
    const v=window.serviceView,out={},at=new Matrix4(),bounds=new Box3();
    for(const key of ['recessbin','recessextinguisher']) {
      const nodes=v.stage.children.filter(o=>o.name==='Records '+key+' neutral');
      if(!nodes.length)continue;
      const total=nodes[0].instanceMatrix.count,count=nodes[0].count;
      const items=Array.from({length:count},(_,i)=>{
        const union=new Box3();
        for(const node of nodes) {
          node.getMatrixAt(i,at);node.geometry.computeBoundingBox();
          union.union(bounds.copy(node.geometry.boundingBox).applyMatrix4(at));
        }
        return {min:union.min.toArray(),max:union.max.toArray()};
      });
      out[key]={items,total,batches:nodes.length};
    }
    return out;
  })`});
  const fitting=all.annex={};
  for(const distance of [72,102,132,162]) {
    const {centerX,startZ}=BACKROOMS_TRACK;
    await pose(centerX,startZ-distance,centerX,startZ-distance-2,1.6);
    await delay(175);
    const annex=await scan();
    assert.equal(annex.exceptionDetails,undefined,JSON.stringify(annex.exceptionDetails));
    for(const [name,{items,total,batches}] of Object.entries(annex.result.value)) {
      const entry=fitting[name]??={items:[],total,batches};
      for(const item of items) if(!entry.items.some(o=>o.min.join(',')===item.min.join(','))) entry.items.push(item);
    }
  }
  for(const [key,{items,total}] of Object.entries(fitting)) {
    assert.ok(items.length>=4&&items.length===total,JSON.stringify({key,total,found:items.length}));
    const {centerX:cx,width}=BACKROOMS_TRACK;
    assert.ok(items.every(o=>o.max[0]<cx-width/2-.59||o.min[0]>cx+width/2+.59),key);
    const o=items[0],x=(o.min[0]+o.max[0])/2,z=(o.min[2]+o.max[2])/2;
    await pose(cx+Math.sign(x-cx)*(width/2-.55),z+.43,x,z,(o.min[1]+o.max[1])/2);
    await shot(key+'-side-bay');
  }
  assert.equal(Object.keys(fitting).length,2);
  await read('window.servicePose=null');
  await writeFile(join(folder,'placements.json'),JSON.stringify(all,null,2)+'\n');
  console.log(JSON.stringify({floorPlacements:5,annex:Object.fromEntries(Object.entries(fitting).map(([k,v])=>[k,{count:v.items.length,batches:v.batches}]))}));
}

async function verifyWestCatwalk(folder) {
  await mkdir(folder,{recursive:true});
  await startChapter(2);
  await moveTo('z',tileCentre(14));
  await moveTo('x',tileCentre(8));
  await aim('yaw',-Math.PI/2);
  await aim('pitch',-.19);
  const shot=async name=>{
    const data=await send('Page.captureScreenshot',{format:'jpeg',quality:92});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(data.data,'base64'));
  };
  await shot('west-catwalk-day');
  await phaseTo('night');
  await delay(245);
  await shot('west-catwalk-night');
  const fell=await hold(['KeyW'],()=>until(async()=>{
    const s=await snapshot();return s.life==='dying'&&s;
  },'walking across an inactive new catwalk falls',3600));
  assert.equal(fell.deathCause,'fall');
  const revived=await until(async()=>{
    const s=await snapshot();return s.life==='alive'&&at(s,11,16)&&s;
  },'roof checkpoint revives after inactive catwalk',6200);
  assert.equal(revived.deaths,1);
  await phaseTo('day');
  await aim('yaw',0);
  await moveTo('z',tileCentre(14));
  await moveTo('x',tileCentre(5));
  assert.ok(at(await snapshot(),5,14));
  console.log(JSON.stringify({sameRouteFallsAtNight:true,solidByDay:true,revival:revived.deaths}));
}

async function verifyMobileLook() {
  const width=Number(process.env.QA_WIDTH || 800),height=Number(process.env.QA_HEIGHT || 420);
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  if(process.env.MOBILE_ROTATED_LOOK) await send('Emulation.setDeviceMetricsOverride',{width:height,height:width,deviceScaleFactor:1,mobile:true});
  await startChapter(2);
  if(process.env.MOBILE_ROTATED_LOOK){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await until(()=>read(`innerWidth===${width}&&innerHeight===${height}`),'rotated into the target viewport');
    await delay(250);
  }
  const x=Math.round(width*.52), y=Math.round(height*.51);
  const before=await snapshot();
  const view=await read(`(() => {
    const events=window.lookEvents=[];
    for(const name of ['pointerdown','pointermove','pointercancel','touchstart','touchmove']) document.addEventListener(name,e=>events.push([name,e.target.id,e.pointerType,e.clientX,e.touches?.[0]?.clientX]),{capture:true,passive:true});
    return {hit:document.elementFromPoint(${x},${y})?.id,innerWidth,innerHeight,scale:visualViewport.scale,scene:getComputedStyle(document.querySelector('#scene')).touchAction};
  })()`);
  const touch=(type,touchPoints)=>send('Input.dispatchTouchEvent',{type,touchPoints});
  const move = process.env.MOBILE_LOOK_WITH_STICK ? await read(`(() => {const r=document.querySelector('#mobile-stick').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2-30,id:2};})()`) : null;
  const points=(dx=0)=>[{x:x+dx,y,id:1},...(move?[move]:[])];
  if (process.env.MOBILE_EDITOR_LOOK) {
    for(const selector of ['#touch-layout-open','#touch-layout-save']) {
      const p=await read(`(() => {const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,id:1};})()`);
      await touch('touchStart',[p]);await touch('touchEnd',[]);
    }
    await whenPlaying(s=>s.mode==='playing','edited layout closes before touch look');
  }
  if (move) await touch('touchStart',[move]);
  await touch('touchStart',points());
  try {
    for(let dx=13;dx<=78;dx+=13){await delay(32); await touch('touchMove',points(dx));}
    await delay(46);
    const after=await snapshot(),events=await read('lookEvents');
    const travel=Math.hypot(after.x-before.x,after.z-before.z);
    console.log(JSON.stringify({view,events,yaw:after.yaw-before.yaw,travel}));
    assert.ok(events.some(e=>e[0]==='pointerdown'&&e[1]==='scene'&&e[2]==='touch')&&Math.abs(after.yaw-before.yaw)>.20,'real touch swipe rotates the camera');
    if(move)assert.ok(travel>.13,'the joystick still moves while the other finger looks');
  } finally { await touch('touchEnd',[]); }
}

async function verifyMobileHud(folder) {
  await mkdir(folder,{recursive:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const device=async(width,height)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  const touch=(type,touchPoints)=>send('Input.dispatchTouchEvent',{type,touchPoints});
  const rounded=selector=>read(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();
    const x=r.left+r.width/2,y=r.top+r.height/2;
    return {x,y,width:r.width,height:r.height,radius:getComputedStyle(e).borderRadius,clickable:e===document.elementFromPoint(x,y)||e.contains(document.elementFromPoint(x,y))};
  })()`);
  const tapEl=async selector=>{const p=await rounded(selector);assert.ok(p.clickable,JSON.stringify({selector,p}));
    await touch('touchStart',[{x:p.x,y:p.y,id:1}]);await touch('touchEnd',[]);};
  const shot=async name=>{await delay(200);const p=await send('Page.captureScreenshot',{format:'jpeg',quality:93,captureBeyondViewport:false});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(p.data,'base64'));};
  const layout=()=>read(`JSON.parse(localStorage.getItem('last-light-3d-mobile-hud-v1'))`);
  const swipeCheckpoint=async name=>{
    if(!process.env.MOBILE_TRACE_STEPS)return;
    const before=await snapshot();
    const p=await read(`(() => { const x=Math.round(innerWidth*.52),y=Math.round(innerHeight*.51);
      return {x,y,id:8,hit:document.elementFromPoint(x,y)?.id,m:[innerWidth,innerHeight,visualViewport.width,visualViewport.height]}; })()`);
    await touch('touchStart',[{x:p.x,y:p.y,id:p.id}]);
    for(let dx=14;dx<=56;dx+=14){await delay(54);await touch('touchMove',[{x:p.x+dx,y:p.y,id:p.id}]);}
    await delay(55);
    console.log(JSON.stringify({step:name,point:p,yaw:(await snapshot()).yaw-before.yaw}));
    await touch('touchEnd',[]);
  };
  await device(868,390); await startChapter(2);
  const pre=await rounded('#touch-jump');
  assert.ok(pre.clickable&&pre.width===pre.height&&pre.radius==='50%',JSON.stringify(pre));
  await shot('landscape-default');
  await swipeCheckpoint('fresh');
  const before=await snapshot();
  await tapEl('#touch-layout-open');
  await until(()=>read(`document.getElementById('touch-layout-editor').open`),'open draggable mobile HUD');
  assert.equal((await snapshot()).mode,'paused');
  const select='#touch-layout-editor [data-hud-control="jump"]';
  const place=await rounded(select);
  await touch('touchStart',[{x:place.x,y:place.y,id:1}]);
  await touch('touchMove',[{x:place.x-96,y:place.y-28,id:1}]);await touch('touchEnd',[]);
  const range=await rounded('#touch-layout-size');
  await touch('touchStart',[{x:range.x+range.width*.29,y:range.y,id:1}]);await touch('touchEnd',[]);
  const resized=await rounded(select);
  assert.ok(resized.x<place.x-65&&resized.y<place.y-13&&resized.width>place.width+9,JSON.stringify({place,resized}));
  await shot('editor-drag-size');
  await tapEl('#touch-layout-save');
  await whenPlaying(s=>s.mode==='playing','saved layout resumes');
  await swipeCheckpoint('after-edit');
  const after=await rounded('#touch-jump');
  assert.ok(Math.hypot(after.x-resized.x,after.y-resized.y)<1&&after.width===resized.width&&after.clickable,JSON.stringify({resized,after}));
  assert.equal((await snapshot()).phase,before.phase,'editing buttons does not send game actions');
  assert.ok((await layout()).landscape.jump.size>pre.width);
  const j=await rounded('#mobile-stick');
  await touch('touchStart',[{x:j.x,y:j.y-22,id:2}]);
  await touch('touchStart',[{x:j.x,y:j.y-22,id:2},{x:after.x,y:after.y,id:3}]);
  let air;
  try { air=await whenPlaying(s=>s.y>.14&&s.z<before.z-.05,'real joystick plus jump multi-touch',1300); }
  finally { await touch('touchEnd',[]); }
  assert.equal(air.phase,before.phase);
  await swipeCheckpoint('after-multitouch');
  await send('Page.reload',{ignoreCache:true});
  await until(()=>read(`performance.getEntriesByType('navigation')[0]?.type==='reload'&&!!window.lastLight3D?.snapshot()?.webgl`),'fresh document after mobile reload');
  await clickVisible('#play-mobile');
  await whenPlaying(s=>s.chapter===2&&s.mode==='playing','mobile gameplay resumes after reload');
  await swipeCheckpoint('after-reload');
  const reloaded=await rounded('#touch-jump');
  assert.ok(Math.abs(reloaded.x-after.x)<1&&reloaded.width===after.width);
  await device(390,844);
  await until(async()=>Math.abs((await rounded('#touch-jump')).width-after.width)>4,'portrait uses distinct layout');
  await shot('portrait-default');
  await swipeCheckpoint('portrait');
  await tapEl('#touch-layout-open');
  await tapEl('#touch-layout-cancel');
  await whenPlaying(s=>s.mode==='playing','cancel returns without applying');
  assert.equal((await layout()).portrait,undefined);
  const edited=await layout();
  await device(868,390);
  await until(async()=>Math.abs((await rounded('#touch-jump')).width-after.width)<1,'rotating back restores landscape edit');
  await swipeCheckpoint('rotated-back');
  await tapEl('#touch-layout-open');
  await tapEl('#touch-layout-reset');
  const reset=await rounded(select);
  assert.ok(Math.hypot(reset.x-pre.x,reset.y-pre.y)<1&&reset.width===pre.width);
  await tapEl('#touch-layout-save');
  await whenPlaying(s=>s.mode==='playing','reset saved and returned to play');
  await writeFile(join(folder,'hud-proof.json'),JSON.stringify({pre,after,reloaded,multitouchY:air.y,edited,reset,layout:await layout(),portraitSeparate:true},null,2)+'\n');
  console.log(JSON.stringify({round:true,dragAndScale:true,realMultiTouch:true,persisted:true,portraitSeparate:true,reset:true}));
  if (process.env.MOBILE_SWIPE_PROBE) {
    const yawBefore=(await snapshot()).yaw;
    const x=450,y=201;
    const view = await read(`(() => {
      const events=window.afterEditTouches=[];
      for(const name of ['pointerdown','pointermove','touchstart','touchmove']) document.addEventListener(name,e=>events.push([name,e.target.id,e.pointerType,e.clientX]),{capture:true,passive:true});
      return {hit:document.elementFromPoint(${x},${y})?.id,focus:document.hasFocus(),open:document.querySelector('#touch-layout-editor').open,active:document.activeElement?.id};
    })()`);
    assert.equal(view.hit,'scene',JSON.stringify(view));
    // Do not interleave surface capture with a gesture: Chromium's screenshot
    // command can override the visible surface size under mobile emulation.
    // Dispatch a paced gesture rather than an instant synthetic scroll so
    // Chrome sends pointer moves, just as it did during the control drag.
    await touch('touchStart',[{x,y,id:1}]);
    try {
      for(let dx=13;dx<=78;dx+=13){await delay(32);await touch('touchMove',[{x:x+dx,y,id:1}]);}
      await delay(46);
      const look=await snapshot();
      console.log(JSON.stringify({view,swipeYaw:look.yaw-yawBefore,afterEditing:true,events:await read('afterEditTouches')}));
      assert.ok(Math.abs(look.yaw-yawBefore)>.20,'canvas turns after closing the layout editor and rotating');
    } finally { await touch('touchEnd',[]); }
    await shot('after-editor-closed');
  }
}

async function playFitTrim(folder) {
  await mkdir(folder,{recursive:true});
  const watchView=async()=>{
    const source=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const render=Visual.prototype.render;
      Visual.prototype.render=function(...args){window.fitTrimView=this;return render.apply(this,args);};
    })`});
    assert.equal(source.exceptionDetails,undefined);
  };
  const shot=async name=>{
    const image=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(image.data,'base64'));
  };
  await startChapter(2); await watchView();
  const corner=await until(()=>read(`(() => {
    const v=window.fitTrimView, plan=v?.fit?.get('RoofDeckInsideCorner');
    const model=v?.stage.getObjectByName('Architecture: RoofDeckInsideCorner');
    return model?.children.every(o=>o.count===plan.points.length)&&!plan.fallback.visible&&model.parent===v.stage&&plan.points;
  })()`),'the backed roof corner is mounted in the permanent shell');
  assert.deepEqual(corner,[[55.2,-.081,4.8,0]]);
  let col=11,row=16;
  for(const step of '* N E N5 * E N N! * E7! N E3! N6! W!'.split(' ')) {
    if(step==='*') { await tap('MouseRight'); continue; }
    const [,dir,count='1',fast]=/^(N|S|E|W)(\d+)?(!)?$/.exec(step);
    const [dx,dz,key]={N:[0,-1,'KeyW'],S:[0,1,'KeyS'],E:[1,0,'KeyD'],W:[-1,0,'KeyA']}[dir];
    if(dx)await moveTo('z',tileCentre(row));else await moveTo('x',tileCentre(col));
    col+=dx*Number(count);row+=dz*Number(count);
    await hold(fast?['ShiftLeft',key]:[key],()=>whenPlaying(s=>dx*(tileCentre(col)-s.x)+dz*(tileCentre(row)-s.z)<.075,'walk re-entrant corner '+col+'/'+row,1000+740*Number(count)));
  }
  // Switch on the permanent landing before turning the camera, so the
  // rooftop night pursuer cannot catch the stationary inspection.
  await phaseTo('day');
  await moveTo('x',tileCentre(22)+.55); await moveTo('z',tileCentre(1)+.24);
  const pos=await snapshot();
  await aim('yaw',Math.atan2(corner[0][0]-pos.x,pos.z-corner[0][2])); await aim('pitch',-.91);
  await shot('roof-inner-return-day');
  await phaseTo('night'); await shot('roof-inner-return-night');

  await startChapter(1,true); await watchView();
  const trimState=()=>read(`(() => {
    const v=window.fitTrimView;
    const out={};
    for (const name of ['carpetbound','recessbar']) {
      const nodes=v?.groups.neutral.children.filter(m=>m.name==='Records '+name+' neutral');
      if (!nodes?.length) return null;
      const {instanceMatrix:m,count}=nodes[0];
      out[name]={batches:nodes.length,total:m.count,items:Array.from({length:count},(_,i)=>
        [m.array[i*16+12],m.array[i*16+14],Math.hypot(m.array[i*16+8],m.array[i*16+10])*1.2])};
    }
    return out;
  })()`);
  await until(trimState,'authored edges installed in the annex');
  await moveTo('x',BACKROOMS_TRACK.centerX-2.37); await aim('yaw',-.97); await aim('pitch',-.81);
  await shot('annex-bound-carpet-start');
  await aim('yaw',0); await aim('pitch',-.36); await moveTo('x',BACKROOMS_TRACK.centerX);
  const samples=[Promise.resolve(await trimState())];
  let next=38, recessStill;
  const transfer=await runTransfer({snapshot,input,onFrame:s=>{
    if(s.chase.distance>=next) { next+=38; const sample=trimState();sample.catch(()=>{});samples.push(sample); }
    if(!recessStill&&s.chase.distance>11) { recessStill=shot('annex-recess-threshold');recessStill.catch(()=>{}); }
  }});
  assert.ok(recessStill);await recessStill;
  const audit={};
  const samplesRead=await Promise.all(samples);
  for(const name of ['carpetbound','recessbar']) {
    const items=new Map();
    const total=samplesRead[0][name].total;
    for(const row of samplesRead) for(const item of row[name].items) items.set(item.slice(0,2).join('/'),item);
    assert.equal(items.size,total,'sample every instance through the route render window');
    for(const [,z,half] of items.values()) {
      const distance=BACKROOMS_TRACK.startZ-z;
      for(const pit of BACKROOMS_TRACK.obstacles.filter(o=>o.kind==='gap'||o.kind==='bridge')) {
        assert.ok(distance+half<=pit.at+.0002||distance-half>=pit.at+pit.length-.0002,`${name} must not draw over a missing bridge or gap`);
      }
    }
    audit[name]={total,batches:samplesRead[0][name].batches};
  }
  console.log(JSON.stringify({corner,annex:audit,transfer}));
}

async function playFineDetails(folder) {
  await mkdir(folder,{recursive:true});
  const observe=async()=>{
    const response=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(...args){window.detailView=this;return draw.apply(this,args);};
    })`});
    assert.equal(response.exceptionDetails,undefined);
  };
  const kits=names=>until(()=>read(`(() => {
    const v=window.detailView,result={};
    for(const name of ${JSON.stringify(names)}) {
      const plan=v?.detail?.get(name), model=v?.stage.getObjectByName('Architecture: '+name);
      if (!plan?.points.length||plan.fallback.visible||!model?.children.length||!model.children.every(m=>m.count===plan.points.length)) return null;
      result[name]={count:plan.points.length,points:plan.points,batches:model.children.length};
    }
    return result;
  })()`),'fine details mounted at every intended socket');
  const shot=async name=>{
    const image=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(image.data,'base64'));
  };
  const focus=async ([x,y,z])=>{
    const s=await snapshot();
    await aim('yaw',Math.atan2(x-s.x,s.z-z));
    await aim('pitch',Math.max(-1.12,Math.min(1.12,Math.atan2(y-s.y-1.63,Math.hypot(x-s.x,z-s.z)))));
  };
  await startChapter(0); await observe();
  const boiler=await kits(['BoilerControlPlate','BoilerCeilingJoist','BoilerWorkLight','BoilerExitLight']);
  await moveTo('z',tileCentre(16)+1.26);
  const plate=boiler.BoilerControlPlate.points.find(([x,,z])=>x>13.6&&x<14&&z>43&&z<44);
  assert.ok(plate);
  await focus(plate); await shot('boiler-control-plate-day');
  await phaseTo('night'); await delay(310); await shot('boiler-control-plate-night');
  const work=boiler.BoilerWorkLight.points.find(([x,,z])=>x===tileCentre(5)&&z===tileCentre(16));
  assert.ok(work);
  await focus(work); await shot('boiler-lamp-mount-night');
  await phaseTo('day'); await delay(310); await shot('boiler-lamp-mount-day');
  await startChapter(1); await observe();
  const archive=await kits(['ArchiveSocketPlate','ArchiveCeilingJoist','ArchiveLightFeed']);
  await moveTo('z',tileCentre(16)); await moveTo('x',tileCentre(9)+.72);
  const socket=archive.ArchiveSocketPlate.points.find(([x,,z])=>x>21.5&&x<22&&z>40.5&&z<41);
  assert.ok(socket);
  await focus(socket); await shot('archive-socket-day');
  const feed=archive.ArchiveLightFeed.points.find(([x,,z])=>x===tileCentre(10)&&z===tileCentre(15));
  assert.ok(feed);
  await phaseTo('night'); await delay(310); await shot('archive-socket-night');
  await focus([feed[0],feed[1]+.22,feed[2]]); await shot('archive-hanger-night');
  await startChapter(2); await observe();
  const roof=await kits(['RoofInspectionCover','RoofSoffitField']);
  const underside=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`import('three').then(({Raycaster,Vector3})=>{
    const v=window.detailView;
    const model=v.stage.getObjectByName('Architecture: RoofSoffitField');
    const permanent=v.decoded.floors.filter(t=>!['d','n'].includes(t.kind));
    const phase=v.decoded.floors.filter(t=>['d','n'].includes(t.kind));
    const ray=new Raycaster(new Vector3(),new Vector3(0,1,0),0,3);
    const hit=(x,z)=>{ray.ray.origin.set(x,-2,z);return ray.intersectObject(model,true)[0]?.point.y;};
    const ribs=permanent.filter(({x,z})=>{const face=hit(x,z);return face<-1.13&&face>-1.18&&hit(x,z+.68)<face-.10;}).length;
    return {permanent:permanent.length,ribs,phase:phase.length,emptyPhase:phase.filter(({x,z})=>hit(x,z)===undefined).length};
  })`});
  assert.equal(underside.exceptionDetails,undefined);
  const fields=underside.result.value;
  assert.equal(fields.permanent,roof.RoofSoffitField.count);
  assert.equal(fields.ribs,fields.permanent,'every panel has a separate downstand in the actual mounted mesh');
  assert.equal(fields.emptyPhase,fields.phase,'there are no permanent soffits beneath a phase bridge');
  await moveTo('z',tileCentre(14));
  await aim('yaw',Math.PI); await aim('pitch',.65);
  const fallen=await hold(['KeyS'],()=>until(async()=>{const st=await snapshot();return st.life==='dying'&&st;},'intentionally step off missing roof bridge',1700));
  assert.equal(fallen.deathCause,'fall');
  await delay(580); await shot('roof-edge-during-fall');
  const revive=await until(async()=>{const st=await snapshot();return st.life==='alive'&&st.hp===3&&st;},'roof checkpoint revival',4600);
  assert.equal(revive.deaths,fallen.deaths);
  await startChapter(2); await observe();
  // Head for the roof-garden wall panel via the ordinary chapter route.
  let col=11,row=16;
  for(const step of '* N E N5 * E N N! W5 W2! W * N W2'.split(' ')) {
    if(step==='*') { await tap('MouseRight'); continue; }
    const [,dir,count='1',fast]=/^(N|E|W)(\d+)?(!)?$/.exec(step);
    const [dx,dz,key]={N:[0,-1,'KeyW'],E:[1,0,'KeyD'],W:[-1,0,'KeyA']}[dir];
    if(dx) await moveTo('z',tileCentre(row)); else await moveTo('x',tileCentre(col));
    col+=dx*Number(count); row+=dz*Number(count);
    await hold(fast?['ShiftLeft',key]:[key],()=>whenPlaying(s=>dx*(tileCentre(col)-s.x)+dz*(tileCentre(row)-s.z)<.09,'roof cover approach '+col+'/'+row,800+740*Number(count)));
  }
  const cover=roof.RoofInspectionCover.points.find(([x,,z])=>x>6&&x<7&&z>16&&z<17);
  assert.ok(cover);
  await focus(cover); await shot('roof-service-cover-night');
  await phaseTo('day'); await delay(310); await shot('roof-service-cover-day');
  await startChapter(1,true); await observe();
  const preview=()=>read(`(() => {
    const v=window.detailView;
    if (!v?.backroomsSet) return null;
    function count(owner,name) {
      const nodes=v.groups[owner].children.filter(m=>m.name==='Records '+name+' '+owner&&m.count>0);
      return {slots:nodes[0]?.count??0,batches:nodes.length,visible:!!nodes.length&&v.groups[owner].visible};
    }
    return {seam:count('neutral','paneljoint'),day:count('day','bridgecorner'),night:count('night','bridgecorner')};
  })()`);
  const first=BACKROOMS_TRACK.obstacles.find(o=>o.kind==='bridge');
  let before,after,seam;
  await aim('pitch',-.37);
  const take=async name=>{ const p=await preview(); await shot(name); return p; };
  const transfer=await runTransfer({snapshot,input,onFrame:s=>{
    const dist=s.chase.distance;
    if(!before&&dist>first.at-3.2&&s.phase!==first.phase) { before=take('annex-bridge-corners-hidden'); before.catch(()=>{}); }
    if(!after&&dist>first.at-1.2&&s.phase===first.phase) { after=take('annex-bridge-corners-active'); after.catch(()=>{}); }
    if(!seam&&dist>BACKROOMS_TRACK.length*.22-8.1) { seam=take('annex-wall-seam'); seam.catch(()=>{}); }
  }});
  assert.ok(before&&after&&seam);
  const inactive=await before, active=await after, joint=await seam;
  assert.ok(inactive[first.phase].slots>=4&&inactive[first.phase].batches>=3);
  assert.equal(inactive[first.phase].visible,false);
  assert.equal(active[first.phase].visible,true);
  assert.ok(joint.seam.slots>=2&&joint.seam.batches>=4);
  for(const entry of Object.values({...boiler,...archive,...roof})) delete entry.points;
  console.log(JSON.stringify({boiler,archive,roof,soffitRayAudit:fields,revival:revive.deaths,bridge:{inactive,active},joint,transfer}));
}

async function playUtilities(folder) {
  await mkdir(folder,{recursive:true});
  const observe=async()=>{
    const response=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(...args){window.utilityView=this;return draw.apply(this,args);};
    })`});
    assert.equal(response.exceptionDetails,undefined);
  };
  const kit=names=>until(()=>read(`(() => {
    const view=window.utilityView;
    const values={};
    for(const name of ${JSON.stringify(names)}) {
      const plan=view?.utilities?.get(name), group=view?.stage.getObjectByName('Architecture: '+name);
      if (!plan?.points.length||plan.fallback.visible||!group?.children.length||group.parent!==view.stage) return null;
      if (!group.children.every(m=>m.count===plan.points.length)) return null;
      values[name]={count:plan.points.length,points:plan.points,batches:group.children.length,
        triangles:plan.points.length*group.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0)};
    }
    return values;
  })()`),'utility part batches assembled without fallbacks');
  const shot=async name=>{
    const s=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(s.data,'base64'));
  };
  const look=async ([x,y,z])=>{
    const s=await snapshot();
    await aim('yaw',Math.atan2(x-s.x,s.z-z));
    await aim('pitch',Math.atan2(y-s.y-1.62,Math.hypot(x-s.x,z-s.z)));
  };
  await startChapter(0); await observe();
  const boiler=await kit(['PipeCorner','PipeStop','CeilingFeed']);
  const roomCorner=boiler.PipeCorner.points.find(([x,,z])=>x>18&&x<20&&z>42&&z<44);
  const feed=boiler.CeilingFeed.points.find(([x,,z])=>x>14&&x<16&&z>42&&z<44);
  assert.ok(roomCorner&&feed);
  await moveTo('x',tileCentre(7)-.63); await moveTo('z',tileCentre(17)-.63);
  await look(roomCorner); await shot('boiler-curved-union-day');
  await phaseTo('night'); await delay(340); await shot('boiler-curved-union-night');
  await aim('yaw',0); await aim('pitch',0);
  await moveTo('x',tileCentre(6)-.52); await moveTo('z',tileCentre(16)+.8);
  await look([feed[0],3.20,feed[2]-.552]); await shot('boiler-ceiling-insert-night');
  await phaseTo('day'); await delay(340); await shot('boiler-ceiling-insert-day');
  await startChapter(2); await observe();
  const roof=await kit(['RoofLamp','RoofExitLamp','FarCityOffice','FarCityBrick','FarCityService']);
  const distant=Object.entries(roof).filter(([name])=>name.startsWith('FarCity')).reduce((a,[,p])=>a+p.count,0);
  assert.equal(distant,68);
  const near=roof.RoofLamp.points.filter(([x,,z])=>z>33).sort((a,b)=>Math.abs(a[0]-tileCentre(11))-Math.abs(b[0]-tileCentre(11)))[0];
  assert.ok(near,'a general post is visible from arrival');
  await moveTo('z',tileCentre(15));
  await shot('distant-city-north-day');
  await aim('yaw',.83); await shot('distant-city-east-day');
  await phaseTo('night'); await delay(350); await shot('distant-city-east-night');
  await look([near[0]-.22,2.67,near[2]]); await shot('roof-weatherproof-head-night');
  await phaseTo('day'); await delay(350); await shot('roof-weatherproof-head-day');
  await look([near[0],.29,near[2]]); await shot('roof-post-and-plinth-day');
  await aim('yaw',0); await aim('pitch',0); await phaseTo('night');
  await moveTo('x',tileCentre(12)); await moveTo('z',tileCentre(10));
  await aim('yaw',-1.16); await aim('pitch',-.12); await shot('distant-city-west-landing-night');
  await phaseTo('day'); await delay(350); await shot('distant-city-west-landing-day');
  await startChapter(1,true); await observe();
  const surfaces=()=>read(`(() => {
    const v=window.utilityView;
    const report={};
    for (const n of ['dangerlip','floorbar']) {
      const batches=v?.groups.neutral.children.filter(o=>o.name==='Records '+n+' neutral'&&o.count);
      if (!batches?.length) return null;
      report[n]={batches:batches.length,positions:Array.from({length:batches[0].count},(_,i)=>
        [batches[0].instanceMatrix.array[i*16+12],batches[0].instanceMatrix.array[i*16+14]])};
    }
    return report;
  })()`);
  const firstGap=BACKROOMS_TRACK.obstacles.find(o=>o.kind==='gap'&&o.at>BACKROOMS_TRACK.length*.22);
  const seam=BACKROOMS_TRACK.length*.22;
  let threshold,pit;
  await aim('pitch',-.30);
  const take=async(name)=>{ const props=await surfaces(); await shot(name); return props; };
  const transfer=await runTransfer({snapshot,input,onFrame:s=>{
    if (!threshold&&s.chase.distance>seam-2.6) { threshold=take('annex-carpet-threshold');threshold.catch(()=>{}); }
    if (!pit&&s.chase.distance>firstGap.at-1.35) { pit=take('annex-fixed-pit-nosings');pit.catch(()=>{}); }
  }});
  assert.ok(threshold&&pit);
  const flooring=await threshold, nosings=await pit;
  assert.equal(flooring.floorbar.positions.length,3);
  assert.ok(nosings.dangerlip.batches>=3);
  for (const z of [BACKROOMS_TRACK.startZ-firstGap.at+.027,BACKROOMS_TRACK.startZ-firstGap.at-firstGap.length-.027])
    assert.equal(nosings.dangerlip.positions.filter(([,other])=>Math.abs(z-other)<.0001).length,3);
  for(const p of Object.values({...boiler,...roof})) delete p.points;
  console.log(JSON.stringify({boiler,roof,distant,flooring,nosings,transfer}));
}

async function playJunctions(folder) {
  await mkdir(folder,{recursive:true});
  const observe=async()=>{
    const response=await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(...args){ window.junctionView=this; window.junctionDoor=args[0].door; return draw.apply(this,args); };
    })`});
    assert.equal(response.exceptionDetails,undefined);
  };
  const stats=names=>until(()=>read(`(() => {
    const view=window.junctionView;
    if (!view?.junctions) return null;
    const result={};
    for (const name of ${JSON.stringify(names)}) {
      const plan=view.junctions.get(name), group=view.stage.getObjectByName('Architecture: '+name);
      if (!plan?.points.length || plan.fallback.visible || !group?.children.length || group.parent!==view.stage) return null;
      const counts=new Map();
      for(const mesh of group.children) {
        const part=mesh.userData.architecturePart;
        counts.set(part,(counts.get(part)??0)+mesh.count);
      }
      if ([...counts.values()].some(count=>count!==plan.points.length)) return null;
      result[name]={count:plan.points.length,batches:group.children.length,
        triangles:group.children.reduce((n,m)=>n+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*m.count,0)};
    }
    return result;
  })()`),'junction assemblies mounted to the permanent shell');
  const shot=async name=>{
    const result=await send('Page.captureScreenshot',{format:'jpeg',quality:94});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(result.data,'base64'));
  };
  await startChapter(0); await observe();
  const boiler=await stats(['BoilerJunction','LiftApron']);
  await moveTo('z',tileCentre(16)+1.20); await aim('yaw',Math.PI); await aim('pitch',-.37);
  await shot('boiler-skirting-day');
  await aim('pitch',.34); await shot('boiler-crown-day');
  await phaseTo('night'); await delay(350); await shot('boiler-crown-night');
  await startChapter(1); await observe();
  const archive=await stats(['ArchiveJunction','LiftApron']);
  await moveTo('x',tileCentre(10)+.95); await moveTo('z',tileCentre(15)+1.20);
  await aim('yaw',Math.PI); await aim('pitch',-.35); await shot('archive-skirting-day');
  await phaseTo('night'); await delay(350); await aim('pitch',.37); await shot('archive-crown-night');
  await startChapter(2); await observe();
  const roofNames=['RoofCoping','RoofCopingCorner','RoofCopingBed','RoofSoffitEdge','LiftApron'];
  const roof=await stats(roofNames);
  await moveTo('z',tileCentre(15)); await aim('pitch',-.45); await shot('roof-soffit-day');
  await phaseTo('night'); await delay(350); await shot('roof-soffit-night');
  await aim('pitch',0);
  // Follow the ordinary route to the left parapet rather than moving the camera off the map.
  let col=11,row=15;
  const path=async text=>{
    for (const step of text.split(' ')) {
      if (step==='*') { await tap('MouseRight'); continue; }
      const [,dir,count='1',fast]=/^(N|E|S|W)(\d+)?(!)?$/.exec(step);
      const [dx,dz,key]={N:[0,-1,'KeyW'],S:[0,1,'KeyS'],E:[1,0,'KeyD'],W:[-1,0,'KeyA']}[dir];
      if (dx) await moveTo('z',tileCentre(row)); else await moveTo('x',tileCentre(col));
      col+=dx*Number(count); row+=dz*Number(count);
      await hold(fast?['ShiftLeft',key]:[key],()=>whenPlaying(s=>dx*(tileCentre(col)-s.x)+dz*(tileCentre(row)-s.z)<.09,'walk roof tile '+col+'/'+row,800+740*Number(count)));
    }
  };
  await path('E N5 * E N N! W5 W2! W * N W2');
  await aim('yaw',Math.PI*-.24); await aim('pitch',-.17); await shot('roof-coping-night');
  await phaseTo('day'); await delay(350); await shot('roof-coping-day');
  assert.deepEqual(await stats(roofNames),roof);
  await startChapter(1,true); await observe();
  const annexParts=names=>until(()=>read(`(() => {
    const view=window.junctionView;
    const out={};
    for (const name of ${JSON.stringify(names)}) {
      const parts=view?.groups.neutral.children.filter(p=>p.name==='Records '+name+' neutral'&&p.count>0);
      if (!parts?.length) return null;
      out[name]={count:parts[0].count,batches:parts.length};
      if (name==='doorleaf') out[name].basis=[parts[0].instanceMatrix.array[0],parts[0].instanceMatrix.array[2]];
    }
    return out;
  })()`),'active authored annex parts');
  const annex=await annexParts(['cove','crown']);
  await aim('yaw',.56); await shot('annex-cove-and-crown'); await aim('yaw',0);
  let closed;
  const names=['doorframe','doorleaf','doorsill'];
  const take=async name=>{
    const data={door:await read('window.junctionDoor'),parts:await annexParts(names)};
    await shot(name);
    return data;
  };
  const transfer=await runTransfer({snapshot,input,testSideWall:true,onFrame:state=>{
    if (!closed && state.chase.distance>BACKROOMS_TRACK.length-7) {
      closed=take('annex-door-closed'); closed.catch(()=>{});
    }
  }});
  assert.ok(closed,'recorded the closed terminal leaf');
  await until(()=>read('window.junctionDoor>.62 && window.junctionView?.backroomsSet !== null'),'swing after reaching the fire door',1020);
  const after=await take('annex-door-open'), before=await closed;
  assert.equal(before.door,0);
  assert.ok(after.door>.62 && after.door<1);
  assert.notDeepEqual(before.parts.doorleaf.basis,after.parts.doorleaf.basis);
  assert.deepEqual(before.parts.doorframe,after.parts.doorframe);
  assert.ok(before.parts.doorframe.batches>1);
  console.log(JSON.stringify({boiler,archive,roof,annex,before,after,transfer}));
}

async function playArchitecture(folder) {
  await mkdir(folder,{recursive:true});
  const observe = async () => {
    const hook = await send('Runtime.evaluate',{awaitPromise:true,expression:`import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(...args){ window.archView=this; return draw.apply(this,args); };
    })`});
    assert.equal(hook.exceptionDetails,undefined);
  };
  const parts = async names => until(() => read(`(() => {
    const view=window.archView;
    if (!view?.architecture) return null;
    const report={};
    for (const name of ${JSON.stringify(names)}) {
      const plan=view.architecture.get(name);
      const group=view.stage.getObjectByName('Architecture: '+name);
      if (!plan?.points.length || plan.fallback.visible || !group?.children.length) return null;
      const counts=new Map(), vertices=new Map();
      for(const mesh of group.children) {
        const part=mesh.userData.architecturePart;
        counts.set(part,(counts.get(part)??0)+mesh.count);
        vertices.set(part,mesh.geometry.attributes.position.count);
      }
      if ([...counts.values()].some(count=>count!==plan.points.length)) return null;
      report[name]={count:plan.points.length,finishes:counts.size,
        vertices:[...vertices.values()].reduce((sum,count)=>sum+count,0)};
    }
    return report;
  })()`),'authored architecture replaces the placeholders');
  const shot = async name => {
    const image = await send('Page.captureScreenshot',{format:'jpeg',quality:92});
    await writeFile(join(folder,name+'.jpg'),Buffer.from(image.data,'base64'));
  };
  const deckNames=['PhaseDeckDay','PhaseDeckNight'];
  const visiblePhase = async (night) => until(() => read(`(() => {
    const view=window.archView;
    const day=view?.stage.getObjectByName('Architecture: PhaseDeckDay');
    const dark=view?.stage.getObjectByName('Architecture: PhaseDeckNight');
    return day?.parent.visible === ${!night} && dark?.parent.visible === ${night};
  })()`),'new geometry respects the active day/night phase');
  await startChapter(0);
  await observe();
  const boiler=await parts(['BoilerLouvre','PipeSaddle','SupplyUnion',...deckNames]);
  assert.equal(boiler.PhaseDeckDay.count,10);
  assert.equal(boiler.PhaseDeckNight.count,21);
  await visiblePhase(false);
  await moveTo('z',tileCentre(16)+1.1);
  await aim('yaw',Math.PI);
  await aim('pitch',-.38);
  await delay(250);
  await shot('boiler-vent-day');
  await phaseTo('night'); await visiblePhase(true); await delay(400);
  await shot('boiler-vent-night');
  await aim('yaw',0); await aim('pitch',0);
  await moveTo('x',tileCentre(2)+.55);
  await aim('yaw',Math.PI);
  await aim('pitch',.32);
  await shot('boiler-pipe-union-night');
  await startChapter(1);
  await observe();
  const archive=await parts(['ArchiveWindow','ArchiveDoor',...deckNames]);
  assert.equal(archive.PhaseDeckDay.count,9);
  assert.equal(archive.PhaseDeckNight.count,9);
  await visiblePhase(false);
  await moveTo('x',tileCentre(10)+.95);
  await moveTo('z',tileCentre(15)+1.2);
  await aim('yaw',Math.PI);
  await aim('pitch',-.03);
  await delay(250);
  await shot('archive-sash-and-door-day');
  await phaseTo('night'); await visiblePhase(true); await delay(400);
  await shot('archive-sash-and-door-night');
  await startChapter(2);
  await observe();
  const roof=await parts(['RoofEdge',...deckNames]);
  assert.equal(roof.PhaseDeckDay.count,8);
  assert.equal(roof.PhaseDeckNight.count,24);
  await visiblePhase(false);
  await moveTo('z',tileCentre(15));
  await aim('pitch',-.43);
  await delay(250);
  await shot('roof-fascia-day');
  await phaseTo('night'); await visiblePhase(true); await delay(320);
  await shot('roof-fascia-night');
  await moveTo('z',tileCentre(14));
  await aim('pitch',-.78);
  await shot('roof-bridge-close-night');
  await startChapter(1,true);
  await observe();
  const pit=await until(() => read(`(() => {
    const parts=[];
    window.archView?.stage.traverse(part => {
      if(part.isInstancedMesh && part.geometry?.name === 'Precast annex pit lining') parts.push(part.count);
    });
    return parts.some(Boolean) && parts;
  })()`),'annex precast lining is batched ahead of the player');
  await aim('pitch',-.37);
  const firstGap=BACKROOMS_TRACK.obstacles.find(ob=>ob.kind==='gap');
  let gapShot;
  const transfer=await runTransfer({snapshot,input,onFrame:state=>{
    if (!gapShot && state.chase.distance>firstGap.at-.25) gapShot=shot('annex-shaft-lining');
  }});
  assert.ok(gapShot);
  await gapShot;
  console.log(JSON.stringify({boiler,archive,roof,pit,linedShafts:BACKROOMS_TRACK.obstacles.filter(o=>o.kind==='gap'||o.kind==='bridge').length,phaseVisibilityVerified:true,transfer}));
}

async function playImportedModels(folder) {
  await mkdir(folder, { recursive: true });
  const observe = async () => {
    const hook = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({Visual})=>{
      const draw=Visual.prototype.render;
      Visual.prototype.render=function(...args){ window.modelView=this; return draw.apply(this,args); };
    })` });
    assert.equal(hook.exceptionDetails, undefined);
  };
  const inspect = async (file, fallback) => {
    const report = await until(() => read(`(() => {
      const root=window.modelView?.stage?.getObjectByName('Environment asset: ' + ${JSON.stringify(file)});
      if(!root) return null;
      let meshes=0, vertices=0, normalMaps=0;
      root.traverse(o=>{ if(o.isMesh && o.geometry.attributes.normal) {
        meshes++; vertices+=o.geometry.attributes.position.count; normalMaps+=+!!o.material.normalMap;
      } });
      return {meshes, vertices, normalMaps, fallbackVisible: window.modelView.stage.getObjectByName(${JSON.stringify(fallback)})?.visible};
    })()`), file + ' mounted');
    assert.ok(report.vertices > 1000 && report.normalMaps > 0);
    if (fallback) assert.equal(report.fallbackVisible, false);
    return report;
  };
  const shot = async name => {
    await delay(230);
    const image = await send('Page.captureScreenshot', {format:'jpeg',quality:92});
    await writeFile(join(folder,name+'.jpg'), Buffer.from(image.data,'base64'));
  };
  const mapMeshes = async names => {
    if (!process.env.MAP_DRESSING_STILLS) return null;
    return until(() => read(`(() => {
      if (!window.modelView?.mapDressing) return null;
      const report = {};
      for (const key of ${JSON.stringify(names)}) {
        const plan = modelView.mapDressing.get(key);
        const group = modelView.stage.getObjectByName('Map dressing: ' + key);
        if (!plan?.points.length || plan.fallback.visible || !group?.children.length) return null;
        const totals=Object.values(Object.groupBy(group.children, mesh => mesh.userData.dressingPart));
        if (totals.some(parts => parts.reduce((n, mesh) => n + mesh.count, 0) !== plan.points.length)) return null;
        report[key] = { count:plan.points.length, parts:totals.length, points:plan.points };
      }
      return report;
    })()`), 'all repeated dressing families mounted');
  };
  await startChapter(0);
  await observe();
  const boilerMap = await mapMeshes(['cylinder','toolbox']);
  const chest = await inspect('boiler-tool-chest');
  assert.ok(chest.meshes >= 7);
  await moveTo('x', tileCentre(7) - .15);
  await moveTo('z', tileCentre(15));
  await aim('pitch', -.19);
  assert.equal(await read("modelView.stage.getObjectByName('Arrival extractor fallback').visible"), false);
  const spin = () => read("modelView.stage.getObjectByName('ExtractorRotor').quaternion.toArray()");
  const rotation1 = await spin();
  await shot('boiler-tool-chest-and-extractor-day');
  assert.notDeepEqual(await spin(), rotation1, 'separate extractor rotor moves');
  await phaseTo('night');
  await shot('boiler-tool-chest-and-extractor-night');
  if (boilerMap) {
    await phaseTo('day');
    await moveTo('x',tileCentre(6));
    await moveTo('z',tileCentre(16));
    await aim('yaw',Math.PI);
    await aim('pitch',-.43);
    await shot('boiler-cylinder-repeat');
    // Camera movement controls are relative to current yaw.
    await aim('yaw',0);
    await moveTo('x',tileCentre(4));
    await aim('yaw',Math.PI);
    await aim('pitch',-.49);
    await shot('boiler-toolbox-repeat');
  }
  await startChapter(1);
  await observe();
  const archiveMap = await mapMeshes(['desk','notepads','cabinet']);
  const cabinet = await inspect('archive-drawer-cabinet', 'Personnel drawers');
  assert.ok(cabinet.meshes >= 5);
  await moveTo('x', tileCentre(9));
  await aim('yaw', Math.PI);
  await aim('pitch', -.22);
  await shot('archive-drawer-cabinet-day');
  await phaseTo('night');
  await shot('archive-drawer-cabinet-night');
  if (archiveMap) {
    await phaseTo('day');
    await aim('yaw',0);
    await moveTo('z',tileCentre(13));
    await moveTo('x',tileCentre(9) + .21);
    await aim('yaw',-Math.PI/2);
    await aim('pitch',-.30);
    await shot('archive-desk-and-stationery-repeat');
  }
  await startChapter(1, true);
  await observe();
  const firstRack = BACKROOMS_TRACK.obstacles.find(o => o.kind === 'rack');
  await until(() => read(`(() => {
    let found = false;
    window.modelView?.stage?.traverse(o=>{ if(o.isInstancedMesh && o.geometry.name === 'Poly Haven worn metal rack' && o.count) found = true; });
    return found;
  })()`), 'textured annex rack instances enter range');
  const evidence = [];
  const checkCrate = Boolean(process.env.MAP_DRESSING_STILLS);
  if (checkCrate) await until(() => read(`(() => {
    let found = false;
    window.modelView?.stage?.traverse(o=>{ if(o.isInstancedMesh && o.geometry.name === 'Poly Haven wooden shipping crate' && o.count) found = true; });
    return found;
  })()`), 'shipping crate meshes dress all annex hurdles');
  const run = await runTransfer({ snapshot, input, onFrame: state => {
    if (checkCrate && !evidence.length && state.chase.distance >= 8) evidence.push(shot('annex-crate-hurdle'));
    if (evidence.length === Number(checkCrate) && state.chase.distance >= firstRack.at - 6) evidence.push(shot('annex-steel-rack'));
  }});
  await Promise.all(evidence);
  assert.equal(evidence.length, 1 + Number(checkCrate));
  console.log(JSON.stringify({chest,cabinet,boilerMap,archiveMap,firstRack:firstRack.id,transfer:run}));
}

async function playRoofGarden(folder) {
  if (!folder) throw new Error('Provide a folder for the roof evidence');
  await startChapter(2);
  const observation = await send('Runtime.evaluate', { awaitPromise: true, expression: `import('./visual.js').then(({ Visual }) => {
    const update = Visual.prototype.updateProps;
    Visual.prototype.updateProps = function(state, time) {
      update.call(this, state, time);
      if (!window.roofEdgeMounts) {
        const part = this.stage.getObjectByName('Modeled roof services')?.children.find(node => node.name.startsWith('PlanterBracket'));
        if (part) window.roofEdgeMounts = part.count;
      }
      if (this.skyline?.fallback.visible === false && !window.roofSkylineSites) {
        const group = this.stage.getObjectByName('Modeled roof skyline');
        window.roofSkylineSites = this.skyline.sites.length;
        window.roofSkylineDraws = group.children.length;
        window.roofSkylineTriangles = group.children.reduce((sum, mesh) =>
          sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count)/3*mesh.count, 0);
      }
      if (window.roofGardenMeshes) return;
      const assets = ['roof-garden-bed', 'roof-irrigation-header'];
      const replacements = assets.map(name => this.stage.getObjectByName('Environment asset: ' + name));
      const old = ['Rooftop rain-fed herb bed', 'Roof irrigation header'].map(name => this.stage.getObjectByName(name));
      const nursery = this.stage.getObjectByName('Modeled nursery boxes');
      const nurseryFallback = this.stage.getObjectByName('Nursery box fallback');
      if (!replacements.every(Boolean) || !old.every(part => part?.visible === false) ||
          !nursery?.children.length || nurseryFallback?.visible !== false) return;
      window.roofNurseryInstances = nursery.children[0].count;
      window.roofGardenMeshes = replacements.map(root => {
        let vertices = 0, parts = 0;
        root.traverse(node => {
          if (node.isMesh) { vertices += node.geometry.attributes.position.count; parts++; }
        });
        return {parts, vertices};
      });
    };
  })` });
  assert.equal(observation.exceptionDetails, undefined, 'Attach read-only replacement observer');
  const meshes = await until(() => read('window.roofGardenMeshes'), 'both authored replacement assets hide the old meshes');
  assert.ok(meshes[0].parts >= 10 && meshes[0].vertices > 15000, 'garden retains separate finishes and plant geometry');
  assert.ok(meshes[1].parts >= 6 && meshes[1].vertices > 5000, 'header retains the six batched finishes and mechanical parts');
  const nurseries = await read('window.roofNurseryInstances');
  assert.ok(nurseries >= 3, 'nursery box meshes replace the scattered roof props');
  const shot = async filename => {
    await delay(200);
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    await writeFile(join(folder, filename + '.jpg'), Buffer.from(image.data, 'base64'));
  };
  let skyline = null, edgeMounts = null;
  if (process.env.SKYLINE_CHECK) {
    skyline = await until(() => read('window.roofSkylineDraws && [roofSkylineSites, roofSkylineDraws, roofSkylineTriangles]'), 'authored skyline replaces the fallback');
    assert.equal(skyline[0],48);
    assert.ok(skyline[1] >= 15 && skyline[2] < 340000,JSON.stringify(skyline));
    edgeMounts = await until(() => read('window.roofEdgeMounts'), 'steel brackets are instanced at the deck-edge planters');
    assert.equal(edgeMounts,7);
    await shot('roof-skyline-day');
    await phaseTo('night');
    await shot('roof-skyline-night');
    await delay(80);
    await phaseTo('day');
    await moveTo('x',22.18);
    await moveTo('z',37.47);
    await aim('pitch',-.54);
    await shot('roof-nursery-saddle');
  }
  await moveTo('x', 24.02);
  await moveTo('z', 36.54);
  await aim('pitch', -.58);
  await shot('roof-bed-day');
  await phaseTo('night');
  await shot('roof-bed-night');
  await aim('pitch', 0);
  // Follow the tested roof route: east lane on the night bridge, then day on the greenhouse deck.
  await moveTo('z', tileCentre(15));
  await moveTo('x', tileCentre(12));
  await moveTo('z', tileCentre(10));
  await phaseTo('day');
  await moveTo('z', tileCentre(6));
  await moveTo('x', 25.85);
  await aim('yaw', -Math.PI / 2);
  await aim('pitch', -.48);
  await shot('roof-header-day');
  await phaseTo('night');
  await shot('roof-header-night');
  assert.equal((await snapshot()).deaths, 0);
  console.log(JSON.stringify({ roofGardenMeshes: meshes, nurseries, skyline, edgeMounts, twoPhases: true, realInput: true, deaths: 0 }));
}

async function playShortcuts() {
  for (const [index, spec] of LEVELS.entries()) {
    const { pads, title } = spec.shortcut;
    const [col, row] = pads[0];
    await startChapter(index);
    if (process.env.CHAPTER_STILLS) {
      await until(() => read('window.reviewLampParts === 5'), 'authored five-part checkpoints entered the scene');
      // Capture the actual first-person view from the arrival point, not an editor render.
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
      await writeFile(join(process.env.CHAPTER_STILLS, spec.id + '-arrival.jpg'), Buffer.from(shot.data, 'base64'));
    }
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
    } else recording?.handle(message);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await recording?.install(gameEntry);
  if(process.env.RECORD_MIX){assert.ok(process.env.JOURNEY||process.env.MOURNING,'real input required for mix');await installMixTap(send);}
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.QA_WIDTH || 1280), height: Number(process.env.QA_HEIGHT || 720), deviceScaleFactor: 1, mobile: false });
  if (process.env.CHECK_BINDINGS) {
    await playBindings();
  } else if (process.env.JOURNEY) {
    const presentation = process.env.PRESENTATION_STILLS;
    if (presentation) await mkdir(presentation,{recursive:true});
    const capturePresentation = async name => {
      const still = await send('Page.captureScreenshot', {format:'jpeg',quality:91});
      await writeFile(join(presentation,name+'.jpg'),Buffer.from(still.data,'base64'));
    };
    if (process.env.INSPECTION_PROOF) await mkdir(process.env.INSPECTION_PROOF,{recursive:true});
    if (process.env.LANDING_STILLS) await mkdir(process.env.LANDING_STILLS,{recursive:true});
    if (process.env.ROOF_ROUTE_STILLS) await mkdir(process.env.ROOF_ROUTE_STILLS,{recursive:true});
    await startChapter();
    if (presentation) {
      await until(() => read(`(() => {
        const scene = document.getElementById('shift-cinematic');
        return scene.dataset.shot === 'arrival' && !scene.hidden &&
          Number(scene.style.getPropertyValue('--scene-caption')) > .85;
      })()`), 'arrival handover becomes visible');
      await capturePresentation('opening');
      if (process.env.SKIP_OPENING) {
        for (const type of ['keyDown','keyUp']) await send('Input.dispatchKeyEvent',{type,code:'Enter',key:'Enter'});
      }
      await until(() => read("document.getElementById('shift-cinematic').hidden"), 'opening returns to play');
      assert.equal((await snapshot()).mode, 'playing');
    }
    const proof = await play3DJourney({ snapshot, until, whenPlaying, moveTo, hold, tap, aim, readHud,
      pauseAndReadGuide: showcase ? undefined : pauseAndReadGuide,
      showOfficeNote: showcase ? showOfficeNote : undefined,
      showOfficeNurse: showcase ? showOfficeNurse : undefined,
      inspectRecord: process.env.INSPECTION_PROOF ? inspectionRecordShot : undefined,
      inspectExit: process.env.LANDING_STILLS ? landingShot : undefined,
      recordRoofBeat: process.env.ROOF_ROUTE_STILLS ? async name => {
        const shot=await send('Page.captureScreenshot',{format:'jpeg',quality:91});
        await writeFile(join(process.env.ROOF_ROUTE_STILLS,name+'.jpg'),Buffer.from(shot.data,'base64'));
      } : undefined,
      onChapter: showcase ? (chapter, state) => console.log(`Playthrough chapter ${chapter + 1}: ${state}`) : undefined,
      runTransfer:()=>runTransfer({snapshot,input}) }, process.env.JOURNEY);
    if (presentation) {
      await until(() => read(`(() => {
        const scene = document.getElementById('shift-cinematic');
        return scene.dataset.shot === 'success' && !scene.hidden && document.getElementById('intro').hasAttribute('data-finishing');
      })()`), 'the success animation starts');
      await capturePresentation('success-transition');
      await until(() => read("document.getElementById('shift-cinematic').hidden"), 'the success animation settles');
      await capturePresentation('success');
    }
    if (showcase) await delay(watch ? 15000 : 6000);
    await recording?.stop();
    if(process.env.RECORD_MIX){await delay(3800);console.log(JSON.stringify({liveMix:await saveMix(send,process.env.RECORD_MIX)}));}
    const saved = await until(() => read("JSON.parse(localStorage.getItem('last-light-3d-v1'))?.finished && JSON.parse(localStorage.getItem('last-light-3d-v1'))"), 'the saved ending settles');
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
      assert.match(prompt,/按住 W 奔跑.*空格\s*跳跃.*A \/ D 绕架.*鼠标右键 切换长桥/);
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
  } else if (process.env.MOURNING) {
    await playMourning();
    if(process.env.RECORD_MIX)console.log(JSON.stringify({liveMix:await saveMix(send,process.env.RECORD_MIX,5)}));
  }
  else if (process.env.ROOF_COMBAT_STILLS) await playRoofCombat(process.env.ROOF_COMBAT_STILLS);
  else if (process.env.OUTLET_STILLS) await playOutletInspection(process.env.OUTLET_STILLS);
  else if (process.env.FIT_DIAGNOSTIC_STILLS) await auditFitCandidates(process.env.FIT_DIAGNOSTIC_STILLS);
  else if (process.env.WEST_CATWALK_PROOF) await verifyWestCatwalk(process.env.WEST_CATWALK_PROOF);
  else if (process.env.MOBILE_LOOK_ONLY) await verifyMobileLook();
  else if (process.env.MOBILE_HUD_PROOF) await verifyMobileHud(process.env.MOBILE_HUD_PROOF);
  else if (process.env.SERVICE_MODELS) await auditImportedServices(process.env.SERVICE_MODELS);
  else if (process.env.MAP_MOUNT_INVENTORY) await auditWholeMapMounts(process.env.MAP_MOUNT_INVENTORY);
  else if (process.env.CITY_SIGHTLINES) await playCitySightlines(process.env.CITY_SIGHTLINES);
  else if (process.env.ROOF_CORNER_STILLS) await auditRoofCorners(process.env.ROOF_CORNER_STILLS);
  else if (process.env.TRIM_STILLS) await playFitTrim(process.env.TRIM_STILLS);
  else if (process.env.FIT_STILLS) await auditArchiveFit(process.env.FIT_STILLS);
  else if (process.env.DETAIL_STILLS) await playFineDetails(process.env.DETAIL_STILLS);
  else if (process.env.UTILITY_STILLS) await playUtilities(process.env.UTILITY_STILLS);
  else if (process.env.JUNCTION_STILLS) await playJunctions(process.env.JUNCTION_STILLS);
  else if (process.env.ARCHITECTURE_STILLS) await playArchitecture(process.env.ARCHITECTURE_STILLS);
  else if (process.env.MAP_DRESSING_STILLS || process.env.IMPORTED_MODEL_STILLS) await playImportedModels(process.env.MAP_DRESSING_STILLS || process.env.IMPORTED_MODEL_STILLS);
  else if (process.env.CLASSIC_ENGLISH_VOICE) await playClassicEnglishVoice();
  else if (process.env.ROOF_GARDEN_STILLS) await playRoofGarden(process.env.ROOF_GARDEN_STILLS);
  else if (process.env.GHOST_RECOVERY) await playGhostRecoveries();
  else await playShortcuts();
  assert.deepEqual(exceptions, []);
} finally {
  await recording?.stop();
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
