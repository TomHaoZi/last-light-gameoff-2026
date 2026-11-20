import { Visual } from './visual.js';
import { HorrorAudio } from './audio.js';
import { Simulation3D, SAVE_KEY, STEP } from './simulation.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const settingsKey = SAVE_KEY + '-settings';
const read = name => {
  try { return JSON.parse(localStorage.getItem(name)); } catch { return null; }
};
function write(name, data) {
  try { localStorage.setItem(name, JSON.stringify(data)); return true; } catch { return false; }
}

const strings = {
  en: {
    intro: 'At 17:59, Gary went back for the people still inside. The register says he was gone. You’re here to close the building. The building has other plans.',
    handover: '17:59 / THE FINAL HANDOVER', title: 'LAST LIGHT', subtitle: 'ONE MORE SHIFT',
    start: 'Enter the building', resumeSave: 'Continue the shift', settings: 'Settings', on: 'Sound on', off: 'Sound off',
    pause: 'Pause', paused: 'Take a breath.', pausedStory: 'When you’re ready, go back in. Your work is recorded at the last lamp.',
    resume: 'Resume shift', before: 'DAY · BEFORE THE FIRE', after: 'NIGHT · AFTER THE FIRE',
    chapter: 'CHAPTER', hp: 'INTEGRITY', journal: 'Journal', archive: 'Original 2D edition',
    tip: 'Headphones recommended · Flashing lights and horror themes',
    controlsTitle: 'Controls', phaseControl: 'Switch day / night', toDay: 'Switch to day', toNight: 'Switch to night',
    move: 'Move', look: 'Look around', use: 'Interact', jump: 'Jump', dragArrows: 'Drag / arrow keys',
    drag: 'Drag the scene', onScreen: 'On-screen buttons', tapDayNight: 'Day / Night button', space: 'Space',
    firstSteps: 'Use the emergency lamp ahead to save your progress. Then switch to night to reveal the first bridge.',
    lampSteps: 'Switch to night to reveal the bridge ahead.',
    legend: 'WASD Move · Drag / arrows Look · E Interact', capturedLegend: 'WASD Move · Mouse Look · E Interact · Esc Pause and release mouse',
    capture: 'Capture mouse', captureFailed: 'Mouse capture is unavailable. Drag the scene or use the arrow keys to look around.',
    controls: 'X switches between day and night. WASD moves. Drag the scene or use the arrow keys to look around. Use Capture mouse for continuous mouse look and Esc to release. Space jumps, E interacts, Shift sprints, C walks quietly, J opens the journal and M mutes. On touch screens, drag the scene and use the on-screen buttons.',
    volume: 'Master volume', quality: 'Graphics', high: 'High', medium: 'Balanced', low: 'Performance', reduced: 'Reduce visual effects',
    restart: 'Restart 3D shift', restartConfirm: 'Confirm 3D restart', lift: 'Open exit', lampAction: 'Rest at emergency lamp', powerAction: 'Power the exit light', work: 'Operate station', clue: 'Read evidence',
    workDone: 'Handover logged.', clueFound: 'Evidence recorded.', lamp: 'Checkpoint saved. Integrity restored.',
    power: 'The emergency light will stay on when you leave.', locked: 'Finish the handover at all three stations first.',
    needDay: 'This equipment works at 17:59. Switch to day.', needNight: 'This memory exists at 18:00. Switch to night.',
    warning: 'It’s coming. Break line of sight or reach a lamp.', fall: 'THE FLOOR IS GONE', ghost: 'IT FOUND YOU', machinery: 'INTEGRITY LOST',
    revival: 'BACK AT THE LAMP', journalEmpty: 'No evidence recorded yet. Look for documents in the building.', evidence: 'Evidence', workCount: 'stations completed',
    normalTitle: 'The door is open.', fullTitle: 'The last light stays on.',
    normal: 'You finished the handover and made it to the street. The register is still missing part of the story. The building waits for someone to read it.',
    full: 'You restored the record. Gary stayed. He held the doors while the others got out. You leave his name on the register and a light for the next person.',
    run: 'Shift complete', fps: '3D could not start. This build requires a browser with WebGL 2 enabled.', saveFailed: 'Browser storage is unavailable. You can play, but progress will not persist.',
    quiet: 'Quiet', sprint: 'Sprint', shift: 'Day / Night', touchUse: 'Use', directions: ['Forward', 'Left', 'Back', 'Right']
  },
  zh: {
    intro: '17:59，Gary 折返回去救还留在楼里的人。登记簿却说他已经走了。你回来做最后一次交接。大楼似乎还不想让你走。',
    handover: '17:59 / 最后一次交班', title: '最后一盏灯', subtitle: '再值一班',
    start: '进入大楼', resumeSave: '继续上次交班', settings: '设置', on: '声音开', off: '声音关',
    pause: '暂停', paused: '喘口气。', pausedStory: '准备好再回去。已经完成的工作会保存在最近的应急灯。',
    resume: '继续值班', before: '白天 · 火灾之前', after: '黑夜 · 火灾之后', chapter: '章节', hp: '生命', journal: '日志', archive: '原始 2D 版',
    tip: '推荐戴耳机 · 含闪光与恐怖元素',
    controlsTitle: '操作指南', phaseControl: '切换白天 / 黑夜', toDay: '切到白天', toNight: '切到黑夜',
    move: '移动', look: '转动视角', use: '互动', jump: '跳跃', dragArrows: '拖动画面 / 方向键',
    drag: '拖动画面', onScreen: '屏幕按钮', tapDayNight: '「昼夜」按钮', space: '空格',
    firstSteps: '走到前方的应急灯旁互动，保存进度。切到黑夜后，前方会出现第一座桥。',
    lampSteps: '切到黑夜，让前方的桥出现。',
    legend: 'WASD 移动 · 拖动 / 方向键转视角 · E 互动', capturedLegend: 'WASD 移动 · 鼠标转视角 · E 互动 · Esc 暂停并释放鼠标',
    capture: '捕获鼠标', captureFailed: '浏览器未捕获鼠标。可拖动画面或按方向键转动视角。',
    controls: 'X 切换白天和黑夜，WASD 移动。拖动画面或按方向键转动视角。点击「捕获鼠标」后可直接用鼠标转动视角，按 Esc 释放。空格跳跃，E 互动，Shift 冲刺，C 轻声走，J 打开日志，M 静音。触屏可拖动画面并使用屏幕按钮。',
    volume: '总音量', quality: '画质', high: '高', medium: '均衡', low: '性能', reduced: '减弱视觉特效', restart: '重开 3D 值班', restartConfirm: '确认重开 3D 版',
    lift: '打开出口', lampAction: '在应急灯休息', powerAction: '给出口灯通电', work: '操作设备', clue: '查看线索', workDone: '交班已记录。', clueFound: '线索已记下。',
    lamp: '检查点已保存，生命恢复。', power: '你离开后，应急灯也会继续亮着。', locked: '先完成本区的三项交接工作。',
    needDay: '设备只在 17:59 运转，切到白天。', needNight: '这段记忆只在 18:00 出现，切到夜晚。',
    warning: '它来了。拐弯甩开它，或者跑到应急灯下。', fall: '脚下的路消失了', ghost: '它找到你了', machinery: '生命耗尽', revival: '在应急灯下醒来',
    journalEmpty: '还没有线索。留意楼里的文件。', evidence: '线索', workCount: '项交接已完成',
    normalTitle: '门开了。', fullTitle: '最后一盏灯没有熄灭。',
    normal: '你做完了交接，回到了街上。登记簿里仍缺着一段故事。大楼还在等人把它读完。',
    full: '你修正了登记簿。Gary 没有离开，他一直撑着门，直到其他人出去。你把他的名字留在纸上，也为下一个人留了一盏灯。',
    run: '交班完成', fps: '3D 版启动失败。请用支持并启用了 WebGL 2 的浏览器。', saveFailed: '浏览器存储不可用。可以继续玩，但本次进度无法保存。',
    quiet: '轻声', sprint: '冲刺', shift: '昼夜', touchUse: '互动', directions: ['前进', '左移', '后退', '右移']
  }
};

const prefs = read(settingsKey) ?? {};
const coarsePointer = matchMedia('(pointer: coarse)');
let lang = ['en', 'zh'].includes(prefs.lang) ? prefs.lang : (navigator.language?.startsWith('zh') ? 'zh' : 'en');
let muted = prefs.muted === true;
let volume = Number.isFinite(prefs.volume) ? Math.max(0, Math.min(1, prefs.volume)) : .8;
const state = new Simulation3D({ progress: read(SAVE_KEY) });
state.quality = ['high', 'medium', 'low'].includes(prefs.quality) ? prefs.quality : (coarsePointer.matches ? 'medium' : 'high');
state.reduceMotion = typeof prefs.reduced === 'boolean' ? prefs.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = new HorrorAudio();
const keys = new Set();
let edges = {}, noticeUntil = 0, lastChapter = -1, lastFrame = 0, accumulator = 0;
let previouslyLocked = false, dragging = null, previousHUD = '', visual = null, error = null;
let overlayMode = '';
const t = () => strings[lang];
const screenText = (id, value) => { $(id).textContent = value; };

function savePrefs() {
  write(settingsKey, { lang, muted, volume, quality: state.quality, reduced: state.reduceMotion });
}

function saveProgress() {
  if (!write(SAVE_KEY, state.saveData())) notice(t().saveFailed, 5);
}

function notice(copy, secs = 3) {
  screenText('notice', copy);
  noticeUntil = performance.now() + secs * 1000;
  $('notice').hidden = false;
}

function readyVisual() {
  try {
    const renderer = new Visual(canvas);
    renderer.load(state.level, state.map);
    visual = renderer;
    lastChapter = state.levelIndex;
  } catch (reason) {
    console.error(reason);
    error = reason;
  }
}
readyVisual();

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  error = new Error('WebGL context lost');
  pause();
  updateScreen(true);
});
canvas.addEventListener('webglcontextrestored', () => {
  error = null;
  updateScreen(true);
});

function updateScreen(force = false) {
  const mode = error ? 'error' : state.mode;
  if (mode === overlayMode && !force) return;
  overlayMode = mode;
  const copy = t();
  const active = mode === 'playing';
  $('intro').hidden = active;
  $('hud').hidden = !active;
  $('pause').hidden = !active;
  $('classic-link').hidden = mode !== 'menu' && mode !== 'error';
  $('quick-guide').hidden = mode !== 'menu' && mode !== 'paused';
  $('phase-primer').hidden = $('quick-guide').hidden;
  $('screen-tip').hidden = mode !== 'menu';
  $('start').hidden = mode === 'error';
  updateMouseLook();
  $('intro').classList.toggle('compact', mode !== 'menu');
  if (active) return;
  screenText('screen-strap', mode === 'won' ? copy.run : copy.handover);
  if (mode === 'menu' && lang === 'en') $('screen-title').replaceChildren('LAST ', document.createElement('br'), 'LIGHT');
  else screenText('screen-title', mode === 'paused' ? copy.paused : mode === 'won' ? (state.ending === 'complete' ? copy.fullTitle : copy.normalTitle) : copy.title);
  screenText('screen-subtitle', copy.subtitle);
  screenText('screen-story', mode === 'error' ? copy.fps : mode === 'paused' ? copy.pausedStory : mode === 'won' ? (state.ending === 'complete' ? copy.full : copy.normal) : copy.intro);
  screenText('start', mode === 'won' ? copy.journal : mode === 'paused' ? copy.resume : read(SAVE_KEY) ? copy.resumeSave : copy.start);
  screenText('screen-tip', copy.tip);
}

function labels() {
  const copy = t();
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  [
    ['language', lang === 'en' ? '中文' : 'EN'], ['mute', muted ? copy.off : copy.on], ['pause', copy.pause],
    ['settings-button', copy.settings], ['classic-link', copy.archive], ['controls-copy', copy.controls],
    ['volume-label', copy.volume], ['quality-label', copy.quality], ['reduced-label', copy.reduced],
    ['restart', copy.restart], ['confirm-restart', copy.restartConfirm], ['health-label', copy.hp],
    ['touch-quiet', copy.quiet], ['touch-sprint', copy.sprint], ['touch-jump', copy.jump], ['touch-shift', copy.shift], ['touch-use', copy.touchUse],
    ['guide-title', copy.controlsTitle], ['guide-phase', copy.phaseControl], ['primer-action', copy.phaseControl], ['guide-move', copy.move], ['guide-look', copy.look],
    ['guide-use', copy.use], ['guide-jump', copy.jump], ['guide-note', copy.firstSteps], ['mouse-look', copy.capture]
  ].forEach(([id, value]) => screenText(id, value));
  const touch = coarsePointer.matches;
  const keyCap = key => Object.assign(document.createElement('kbd'), { textContent: key });
  $('guide-phase-key').replaceChildren(touch ? copy.tapDayNight : keyCap('X'));
  $('primer-key').replaceChildren(touch ? copy.tapDayNight : keyCap('X'));
  $('guide-move-key').replaceChildren(touch ? copy.onScreen : keyCap('WASD'));
  $('guide-look-key').replaceChildren(touch ? copy.drag : copy.dragArrows);
  $('guide-use-key').replaceChildren(touch ? copy.onScreen : keyCap('E'));
  $('guide-jump-key').replaceChildren(touch ? copy.onScreen : keyCap(copy.space));
  document.querySelectorAll('.pad button').forEach((button, index) => button.setAttribute('aria-label', copy.directions[index]));
  $('journal').replaceChildren(copy.journal, Object.assign(document.createElement('kbd'), { textContent: 'J' }));
  $('quality').options[0].text = copy.high;
  $('quality').options[1].text = copy.medium;
  $('quality').options[2].text = copy.low;
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  previousHUD = '';
  updateScreen(true);
}

function loadChapter() {
  if (lastChapter === state.levelIndex) return;
  visual?.load(state.level, state.map);
  lastChapter = state.levelIndex;
  previousHUD = '';
  notice(lang === 'zh' ? state.level.subtitleZh : state.level.subtitle, 5);
}

function updateHUD() {
  const status = [state.levelIndex, state.night, state.hp, state.completed.size, Math.round(state.stamina * 100)].join('/');
  if (status !== previousHUD) {
    const copy = t();
    previousHUD = status;
    const { level, levelIndex, completed, map, night, hp } = state;
    screenText('floor-label', copy.chapter + ' ' + (levelIndex + 1) + ' / ' + state.levels.length);
    screenText('room-title', lang === 'zh' ? level.zh : level.title);
    screenText('objective', completed.size + ' / ' + map.stations.length + ' ' + copy.workCount + ' · ' + (lang === 'zh' ? level.objectiveZh : level.objective));
    screenText('phase-time', night ? '18:00' : '17:59');
    screenText('phase-label', night ? copy.after : copy.before);
    screenText('phase-action', night ? copy.toDay : copy.toNight);
    $('phase-badge').dataset.night = String(night);
    [...$('health').children].forEach((node, i) => node.classList.toggle('full', i < hp));
    $('health').setAttribute('aria-label', hp + ' HP');
    $('stamina').style.width = state.stamina * 100 + '%';
    $('stamina-meter').setAttribute('aria-valuenow', Math.round(state.stamina * 100));
  }
  const target = state.mode === 'playing' ? state.getInteraction() : null;
  const names = { station: 'work', clue: 'clue', lamp: 'lampAction', door: 'lift', power: 'powerAction' };
  const prompt = target ? (coarsePointer.matches ? '' : '[E] ') + t()[names[target.type]] : '';
  if ($('interaction').textContent !== prompt) screenText('interaction', prompt);
  $('interaction').hidden = !prompt;
  $('death').hidden = state.life === 'alive' || state.mode !== 'playing';
  if (!$('death').hidden) {
    const deathCopy = state.life === 'dying' ? t()[state.deathCause] : t().revival;
    if ($('death-copy').textContent !== deathCopy) screenText('death-copy', deathCopy);
    $('death').style.opacity = state.life === 'dying' ? Math.min(1, .2 + state.lifeTimer) : Math.max(0, 1 - state.lifeTimer / .68);
  }
  $('flash').style.opacity = state.reduceMotion ? 0 : state.shiftFx * .57;
}

function processEvents() {
  for (const event of state.drain()) {
    if (event.type === 'sound') sound.cue(event.name, event.position);
    if (event.type === 'warning') { sound.cue('warning', event.ghost); notice(t().warning, 2.6); }
    if (event.type === 'notice') {
      const firstLamp = event.id === 'lamp' && state.levelIndex === 0 && state.completed.size === 0 && !state.night;
      notice(t()[event.id] + (firstLamp ? ' ' + t().lampSteps : ''), firstLamp ? 6 : 3);
    }
    if (event.type === 'story') notice(event.pair?.[lang === 'zh' ? 1 : 0] ?? t()[event.id], 6);
    if (event.type === 'save') saveProgress();
    if (event.type === 'chapter') loadChapter();
    if (event.type === 'death') clearInput();
  }
}

function clearInput() {
  keys.clear();
  edges = {};
  dragging = null;
}

function focusScene() { canvas.focus({ preventScroll: true }); }

function updateMouseLook() {
  const locked = document.pointerLockElement === canvas;
  $('mouse-look').hidden = Boolean(error) || state.mode !== 'playing' || coarsePointer.matches || !canvas.requestPointerLock || locked;
  screenText('key-legend', locked ? t().capturedLegend : t().legend);
}

function requestMouseLook() {
  if (state.mode !== 'playing' || !canvas.requestPointerLock) return;
  focusScene();
  try { canvas.requestPointerLock()?.catch(() => notice(t().captureFailed, 5)); }
  catch { notice(t().captureFailed, 5); }
}

function start() {
  if (error) return;
  if (state.mode === 'won') return showPanel('journal');
  const firstShift = state.mode === 'menu' && !read(SAVE_KEY);
  clearInput();
  state.mode = 'playing';
  updateScreen();
  if (firstShift) notice(t().firstSteps, 8);
  sound.setMuted(muted);
  sound.setVolume(volume);
  focusScene();
  sound.start().catch(e => console.warn('Audio unavailable.', e));
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  clearInput();
  saveProgress();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  updateScreen();
}

function transitionToMenuWhenUnfocused() {
  if (state.mode === 'playing') pause();
  clearInput();
  sound.update({ ...soundState(), paused: true });
}

function showPanel(view) {
  if (state.mode === 'playing') pause();
  const isJournal = view === 'journal';
  $('settings').hidden = isJournal;
  $('journal-view').hidden = !isJournal;
  $('restart').hidden = !read(SAVE_KEY) && state.mode !== 'won';
  $('confirm-restart').hidden = true;
  screenText('panel-title', isJournal ? t().journal : t().settings);
  if (isJournal) {
    const records = state.progress.evidence;
    screenText('journal-summary', records.length + ' / ' + state.totalClues + ' · ' + t().evidence);
    const list = $('journal-list');
    list.replaceChildren();
    if (!records.length) screenText('journal-list', t().journalEmpty);
    for (const record of records) {
      const [index, id] = record.split('/');
      const article = document.createElement('article');
      article.textContent = state.levels[index].clues?.[id]?.[lang === 'zh' ? 1 : 0] ?? record;
      list.append(article);
    }
  }
  if (!$('panel').open) $('panel').showModal();
}

function soundState() {
  return {
    x: state.x, z: state.z, yaw: state.yaw, night: state.night,
    level: state.levelIndex, tension: state.tension, ghosts: state.ghosts,
    paused: state.mode === 'paused' || state.mode === 'menu' || document.hidden || Boolean(error)
  };
}

$('start').onclick = start;
$('settings-button').onclick = () => showPanel('settings');
$('journal').onclick = () => showPanel('journal');
$('close-panel').onclick = () => $('panel').close();
$('pause').onclick = pause;
$('mouse-look').onclick = requestMouseLook;
$('phase-badge').onclick = () => { edges.shift = true; focusScene(); };
$('language').onclick = () => {
  lang = lang === 'en' ? 'zh' : 'en';
  noticeUntil = 0;
  labels();
  savePrefs();
};
coarsePointer.addEventListener('change', labels);
function toggleSound() { muted = !muted; sound.setMuted(muted); labels(); savePrefs(); }
$('mute').onclick = toggleSound;
$('volume').value = String(volume);
$('volume').oninput = () => { volume = Number($('volume').value); sound.setVolume(volume); savePrefs(); };
$('quality').value = state.quality;
$('quality').onchange = () => { state.quality = $('quality').value; savePrefs(); };
$('reduced').checked = state.reduceMotion;
$('reduced').onchange = () => { state.reduceMotion = $('reduced').checked; savePrefs(); };
$('restart').onclick = () => { $('confirm-restart').hidden = false; $('confirm-restart').focus(); };
$('confirm-restart').onclick = () => {
  const previous = read(SAVE_KEY);
  if (previous && !write(SAVE_KEY + '-backup', previous)) return;
  state.reset();
  lastChapter = -1;
  loadChapter();
  $('panel').close();
  start();
};
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && previouslyLocked) pause();
  previouslyLocked = locked;
  updateMouseLook();
});
document.addEventListener('pointerlockerror', () => notice(t().captureFailed, 5));
document.addEventListener('mousemove', event => {
  if (document.pointerLockElement === canvas) state.look(event.movementX * .0023, -event.movementY * .0023);
});

const actions = { Space: 'jump', KeyX: 'shift', KeyE: 'interact' };
const playKeys = new Set(['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space','KeyX','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
function down(code, repeat = false) {
  keys.add(code);
  if (!repeat && actions[code]) edges[actions[code]] = true;
}
function up(code) {
  keys.delete(code);
  if (code === 'Space') edges.release = true;
}
window.addEventListener('keydown', event => {
  if ($('panel').open || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input,select')) return;
  const { code, repeat } = event;
  if (code === 'KeyM' && !repeat) return toggleSound();
  if (code === 'KeyJ' && !repeat) return showPanel('journal');
  if (code === 'Escape' && !repeat && state.mode === 'playing') return pause();
  if (state.mode !== 'playing' || !playKeys.has(code)) return;
  if (code === 'Space' && event.target.closest?.('button,a')) return;
  event.preventDefault();
  down(code, repeat);
});
window.addEventListener('keyup', event => up(event.code));
window.addEventListener('blur', transitionToMenuWhenUnfocused);
document.addEventListener('visibilitychange', () => { if (document.hidden) transitionToMenuWhenUnfocused(); });

for (const button of document.querySelectorAll('[data-touch]')) {
  const code = button.dataset.touch;
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    down(code);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, () => up(code));
  }
  button.addEventListener('click', event => {
    if (event.detail === 0 && actions[code]) edges[actions[code]] = true;
  });
}
canvas.addEventListener('pointerdown', event => {
  if (state.mode !== 'playing' || event.button !== 0 || document.pointerLockElement === canvas || dragging) return;
  focusScene();
  canvas.setPointerCapture(event.pointerId);
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerId !== dragging?.id) return;
  state.look((event.clientX - dragging.x) * .005, (dragging.y - event.clientY) * .005);
  dragging.x = event.clientX;
  dragging.y = event.clientY;
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  canvas.addEventListener(type, event => { if (event.pointerId === dragging?.id) dragging = null; });
}

function keyboardInput() {
  state.look((Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * STEP * 1.92,
    (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * STEP * 1.2);
  const input = {
    forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
    side: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), quiet: keys.has('KeyC'), ...edges
  };
  edges = {};
  return input;
}

function frame(time) {
  const dt = lastFrame ? Math.min(.067, (time - lastFrame) / 1000) : 0;
  lastFrame = time;
  if (state.mode === 'playing' && !error) {
    accumulator += dt;
    while (accumulator >= STEP) {
      state.step(keyboardInput());
      accumulator -= STEP;
    }
  } else accumulator = 0;
  sound.update(soundState());
  processEvents();
  if (state.mode === 'won' && document.pointerLockElement === canvas) document.exitPointerLock();
  updateScreen();
  updateHUD();
  if (time >= noticeUntil) $('notice').hidden = true;
  if (!error) visual?.render(state, dt);
  requestAnimationFrame(frame);
}
labels();
requestAnimationFrame(frame);
// Read-only smoke-test and accessibility diagnostics.
window.lastLight3D = Object.freeze({
  snapshot: () => ({
    chapter: state.levelIndex, mode: state.mode, phase: state.night ? 'night' : 'day',
    x: state.x, y: state.y, z: state.z, hp: state.hp, deaths: state.progress.deaths,
    work: [...state.completed], evidence: [...state.progress.evidence], life: state.life,
    webgl: Boolean(visual && !error), ending: state.mode === 'won' ? state.ending : null
  })
});
