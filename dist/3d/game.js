import { Visual } from './visual.js';
import { BACKROOMS_TRACK, nextChaseObstacle } from './backrooms-track.js';
import { HorrorAudio } from './audio.js';
import { Dialogue } from './dialogue.js';
import { Simulation3D, SAVE_KEY, STEP } from './simulation.js';
import { loadRun, storeRun, restartRun } from './save.js';

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
    start: 'Play 3D', resumeSave: 'Continue 3D', play2D: 'Play 2D', settings: 'Settings', on: 'Sound on', off: 'Sound off',
    pause: 'Pause', paused: 'Take a breath.', pausedStory: 'When you’re ready, go back in. Your work is recorded at the last lamp.',
    resume: 'Resume shift', before: 'DAY · BEFORE THE FIRE', after: 'NIGHT · AFTER THE FIRE',
    chapter: 'CHAPTER', hp: 'INTEGRITY', journal: 'Journal',
    tip: 'Headphones recommended · Flashing lights and horror themes',
    controlsTitle: 'Controls', phaseControl: 'Switch day / night', toDay: 'Switch to day', toNight: 'Switch to night',
    move: 'Move', look: 'Look around', use: 'Interact', jump: 'Jump', mouse: 'Move the mouse',
    drag: 'Drag the scene', onScreen: 'On-screen buttons', tapDayNight: 'Day / Night button', space: 'Space',
    firstSteps: 'Save at the emergency lamp. Switch to night for the first bridge.',
    exitReady: 'Take the lift beside the fire interlock.',
    archiveExit: 'Take the lift beyond Gary’s wing.',
    mourningArrival: 'Someone is crying. There’s a gramophone by the lift.',
    mourningNote: 'Play the gramophone',
    mourningRule: 'The Mourning Clerk attacks if you stare. Look down or turn away, and give it space.',
    mourningLook: 'LOOK AWAY',
    mourningBreak: 'KEEP LOOKING AWAY',
    mourningContact: 'YOU GOT TOO CLOSE',
    gaze: 'IT CAUGHT YOUR EYE',
    mourningRevival: 'Use the sound to find it. Keep your eyes low.',
    roofExit: 'The roof exit is open. Leave when you’re ready.',
    roofCircuit: 'The exit is open. Its independent light is still off.',
    lampSteps: 'Switch to night to reveal the bridge ahead.',
    shortcutKeys: 'Hold Shift, jump with Space, switch midair with X.',
    shortcutTouch: 'Hold Sprint, tap Jump, then tap Day / Night in the air.',
    legend: 'WASD Move · Mouse Look · E Interact', capturedLegend: 'WASD Move · Mouse Look · E Interact · Esc Pause and release mouse',
    capture: 'Capture mouse', captureFailed: 'Move the mouse within the scene to look around. Click the scene to retry capture.',
    controls: 'X switches between day and night. WASD moves. Move the mouse to look around. The game captures it when you start or resume. Esc pauses and releases the mouse. Space jumps, E interacts, Shift sprints, C walks quietly, J opens the journal and M mutes. On touch screens, drag the scene and use the on-screen buttons.',
    volume: 'Master volume', mouseSensitivity: 'Mouse sensitivity', quality: 'Graphics', high: 'High', medium: 'Balanced', low: 'Performance', adaptive: 'Adaptive resolution', fpsMonitor: 'Show frame rate', reduced: 'Reduce visual effects',
    restart: 'Restart 3D shift', restartConfirm: 'Confirm 3D restart', lift: 'Open exit', lampAction: 'Rest at emergency lamp', powerAction: 'Power the exit light', work: 'Operate station', clue: 'Read evidence',
    workDone: 'Handover logged.', clueFound: 'Evidence recorded.', lamp: 'Checkpoint saved. Integrity restored.',
    reviewRecord: 'Reread journal entry', lightOn: 'Exit light is on', lightOff: 'exit light has no power',
    remainingRecords: n => `${n} unread ${n === 1 ? 'record stays' : 'records stay'} on this floor`,
    remainingStations: n => `Exit locked · ${n} ${n === 1 ? 'station' : 'stations'} left`,
    power: 'The emergency light will stay on when you leave.', locked: 'Finish the handover at all three stations first.',
    needDay: 'This equipment works at 17:59. Switch to day.', needNight: 'This memory exists at 18:00. Switch to night.',
    warning: 'It’s coming. Break line of sight or reach a lamp.', fall: 'THE FLOOR IS GONE', ghost: 'IT FOUND YOU', machinery: 'INTEGRITY LOST',
    revival: 'BACK AT THE LAMP', journalEmpty: 'No evidence recorded yet. Look for documents in the building.', evidence: 'Evidence', workCount: 'stations completed',
    normalTitle: 'The door is open.', fullTitle: 'The last light stays on.',
    normal: 'You finished the handover and made it to the street. The register is still missing part of the story. The building waits for someone to read it.',
    full: 'You restored the record. Gary stayed. He held the doors while the others got out. You leave his name on the register and a light for the next person.',
    run: 'Shift complete', fps: '3D could not start. This build requires a browser with WebGL 2 enabled.', saveFailed: 'Browser storage is unavailable. You can play, but progress will not persist.',
    protectedSave: 'Your existing save cannot be loaded in this version. It is protected. Play for this session, or choose Restart in Settings to back it up and begin a new save.',
    quiet: 'Quiet', sprint: 'Sprint', shift: 'Day / Night', touchUse: 'Use', directions: ['Forward', 'Left', 'Back', 'Right']
  },
  zh: {
    intro: '17:59，Gary 折返回去救还留在楼里的人。登记簿却说他已经走了。你回来做最后一次交接。大楼似乎还不想让你走。',
    handover: '17:59 / 最后一次交班', title: '最后一盏灯', subtitle: '再值一班',
    start: '玩 3D 版', resumeSave: '继续 3D 版', play2D: '玩 2D 版', settings: '设置', on: '声音开', off: '声音关',
    pause: '暂停', paused: '喘口气。', pausedStory: '准备好再回去。已经完成的工作会保存在最近的应急灯。',
    resume: '继续值班', before: '白天 · 火灾之前', after: '黑夜 · 火灾之后', chapter: '章节', hp: '生命', journal: '日志',
    tip: '推荐戴耳机 · 含闪光与恐怖元素',
    controlsTitle: '操作指南', phaseControl: '切换白天 / 黑夜', toDay: '切到白天', toNight: '切到黑夜',
    move: '移动', look: '转动视角', use: '互动', jump: '跳跃', mouse: '直接移动鼠标',
    drag: '拖动画面', onScreen: '屏幕按钮', tapDayNight: '「昼夜」按钮', space: '空格',
    firstSteps: '在应急灯处存档。切到黑夜，就能看见第一座桥。',
    exitReady: '去消防联锁旁搭电梯。',
    archiveExit: '穿过 Gary 的办公区，去尽头搭电梯。',
    mourningArrival: '有人在哭。电梯旁放着一台留声机。',
    mourningNote: '播放留声机录音',
    mourningRule: '默哀档案员受直视刺激。低头或转开视线，绕行时留一点距离。',
    mourningLook: '移开视线',
    mourningBreak: '继续避开视线',
    mourningContact: '你离它太近了',
    gaze: '它抓住了你的视线',
    mourningRevival: '听哭声辨位。把视线放低。',
    roofExit: '屋顶出口已打开。准备好就可以离开。',
    roofCircuit: '屋顶出口已打开，门边的独立应急灯还没通电。',
    lampSteps: '切到黑夜，让前方的桥出现。',
    shortcutKeys: '按住 Shift 冲刺，用空格跳跃，在空中按 X 切换。',
    shortcutTouch: '按住「冲刺」，点「跳跃」，再在半空点「昼夜」。',
    legend: 'WASD 移动 · 鼠标转视角 · E 互动', capturedLegend: 'WASD 移动 · 鼠标转视角 · E 互动 · Esc 暂停并释放鼠标',
    capture: '捕获鼠标', captureFailed: '在画面内移动鼠标来转动视角。点击画面可重试捕获。',
    controls: 'X 切换白天和黑夜，WASD 移动。移动鼠标即可转动视角。进入或继续值班时自动捕获鼠标，按 Esc 暂停并释放。空格跳跃，E 互动，Shift 冲刺，C 轻声走，J 打开日志，M 静音。触屏可拖动画面并使用屏幕按钮。',
    volume: '总音量', mouseSensitivity: '鼠标灵敏度', quality: '画质', high: '高', medium: '均衡', low: '性能', adaptive: '自适应分辨率', fpsMonitor: '显示帧率', reduced: '减弱视觉特效', restart: '重开 3D 值班', restartConfirm: '确认重开 3D 版',
    lift: '打开出口', lampAction: '在应急灯休息', powerAction: '给出口灯通电', work: '操作设备', clue: '查看线索', workDone: '交班已记录。', clueFound: '线索已记下。',
    lamp: '检查点已保存，生命恢复。', power: '你离开后，应急灯也会继续亮着。', locked: '先完成本区的三项交接工作。',
    reviewRecord: '重读日志里的记录', lightOn: '出口灯已通电', lightOff: '出口灯还未通电',
    remainingRecords: n => `离开会错过本层 ${n} 份未读记录`,
    remainingStations: n => `出口未解锁 · 还剩 ${n} 项交接`,
    needDay: '设备只在 17:59 运转，切到白天。', needNight: '这段记忆只在 18:00 出现，切到夜晚。',
    warning: '它来了。拐弯甩开它，或者跑到应急灯下。', fall: '脚下的路消失了', ghost: '它找到你了', machinery: '生命耗尽', revival: '在应急灯下醒来',
    journalEmpty: '还没有线索。留意楼里的文件。', evidence: '线索', workCount: '项交接已完成',
    normalTitle: '门开了。', fullTitle: '最后一盏灯没有熄灭。',
    normal: '你做完了交接，回到了街上。登记簿里仍缺着一段故事。大楼还在等人把它读完。',
    full: '你修正了登记簿。Gary 没有离开，他一直撑着门，直到其他人出去。你把他的名字留在纸上，也为下一个人留了一盏灯。',
    run: '交班完成', fps: '3D 版启动失败。请用支持并启用了 WebGL 2 的浏览器。', saveFailed: '浏览器存储不可用。可以继续玩，但本次进度无法保存。',
    protectedSave: '此版本无法读取现有存档，已保留原档。可以临时游玩，或在设置里选择重新开始，备份原档后建立新存档。',
    quiet: '轻声', sprint: '冲刺', shift: '昼夜', touchUse: '互动', directions: ['前进', '左移', '后退', '右移']
  }
};

const prefs = read(settingsKey) ?? {};
const coarsePointer = matchMedia('(pointer: coarse)');
const finePointer = matchMedia('(any-pointer: fine)');
let lang = ['en', 'zh'].includes(prefs.lang) ? prefs.lang : (navigator.language?.startsWith('zh') ? 'zh' : 'en');
let muted = prefs.muted === true;
let volume = Number.isFinite(prefs.volume) ? Math.max(0, Math.min(1, prefs.volume)) : .8;
let mouseSensitivity = Number.isFinite(prefs.mouseSensitivity) ? Math.max(.5, Math.min(2, prefs.mouseSensitivity)) : 1;
let storage;
try { storage = window.localStorage; } catch {}
let storedRun = loadRun(storage);
const state = new Simulation3D({ progress: storedRun.progress });
state.quality = ['high', 'medium', 'low'].includes(prefs.quality) ? prefs.quality : (coarsePointer.matches ? 'medium' : 'high');
state.autoResolution = prefs.adaptive !== false;
let showFps = prefs.showFps === true;
state.reduceMotion = typeof prefs.reduced === 'boolean' ? prefs.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = new HorrorAudio();
const dialogue = new Dialogue(sound, $('dialogue'));
dialogue.preload();
const keys = new Set();
const touchKeys = new Map();
let edges = {}, noticeUntil = 0, lastChapter = -1, lastFrame = 0, accumulator = 0;
let previouslyLocked = false, freeMouse = null, dragging = null, previousHUD = '', previousStamina = -1, visual = null, error = null;
let overlayMode = '';
const t = () => strings[lang];
const screenText = (id, value) => { $(id).textContent = value; };

function savePrefs() {
  write(settingsKey, { lang, muted, volume, mouseSensitivity, quality: state.quality, adaptive: state.autoResolution, showFps, reduced: state.reduceMotion });
}

function saveProgress() {
  const progress = state.saveData();
  const issue = storeRun(storage, progress);
  storedRun = { progress: issue ? storedRun.progress : progress, issue };
  if (issue) notice(t()[issue], 5);
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
    lastChapter = state.level.id;
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

function currentObjective() {
  const { level, completed, map, progress } = state;
  if (state.chase && state.departing) return lang === 'zh' ? '门开了。你可以喘口气了。' : 'The door gives. You can breathe.';
  if (state.chase?.started) return lang === 'zh' ? '奔向绿灯防火门。' : 'Reach the green fire door.';
  if (state.chase || completed.size < map.stations.length) return lang === 'zh' ? level.objectiveZh : level.objective;
  if (map.power) return progress.powered ? t().roofExit : t().roofCircuit;
  return level.id === 'office' ? t().archiveExit : t().exitReady;
}

function updateScreen(force = false) {
  const mode = error ? 'error' : state.mode;
  if (mode === overlayMode && !force) return;
  overlayMode = mode;
  const copy = t();
  const active = mode === 'playing';
  const caption = $('dialogue');
  if (mode === 'won') $('screen-story').after(caption);
  else if (!caption.parentElement.matches('.feedback')) document.querySelector('.feedback').prepend(caption);
  $('intro').hidden = active;
  $('hud').hidden = !active;
  $('pause').hidden = !active;
  $('classic-link').hidden = active;
  $('quick-guide').hidden = mode !== 'menu' && mode !== 'paused';
  $('phase-primer').hidden = $('quick-guide').hidden;
  $('screen-tip').hidden = mode !== 'menu';
  $('start').hidden = mode === 'error';
  updateMouseLook();
  $('intro').classList.toggle('compact', mode !== 'menu');
  if (active) return;
  const enteringBoiler = state.levelIndex === 0 && !state.completed.size && state.checkpoint === state.map.spawn;
  screenText('guide-note', enteringBoiler ? copy.firstSteps : state.level.mourning ? copy.mourningRule : currentObjective());
  screenText('screen-strap', mode === 'won' ? copy.run : copy.handover);
  if (mode === 'menu' && lang === 'en') $('screen-title').replaceChildren('LAST ', document.createElement('br'), 'LIGHT');
  else screenText('screen-title', mode === 'paused' ? copy.paused : mode === 'won' ? (state.ending === 'complete' ? copy.fullTitle : copy.normalTitle) : copy.title);
  screenText('screen-subtitle', copy.subtitle);
  screenText('screen-story', mode === 'error' ? copy.fps : mode === 'paused' ? copy.pausedStory : mode === 'won' ? (state.ending === 'complete' ? copy.full : copy.normal) : copy.intro);
  screenText('start', mode === 'won' ? copy.journal : mode === 'paused' ? copy.resume : storedRun.progress ? copy.resumeSave : copy.start);
  screenText('screen-tip', storedRun.issue ? copy[storedRun.issue] : copy.tip);
}

function labels() {
  const copy = t();
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  dialogue.setLanguage(lang);
  [
    ['language', lang === 'en' ? '中文' : 'EN'], ['mute', muted ? copy.off : copy.on], ['pause', copy.pause],
    ['settings-button', copy.settings], ['classic-link', copy.play2D], ['controls-copy', copy.controls],
    ['volume-label', copy.volume], ['mouse-sensitivity-label', copy.mouseSensitivity], ['quality-label', copy.quality], ['adaptive-label', copy.adaptive], ['fps-label', copy.fpsMonitor], ['reduced-label', copy.reduced],
    ['voice-edits', lang === 'zh' ? '录音为 LAST LIGHT 剪辑、均衡和混音。' : 'Edited, equalized and mixed for LAST LIGHT.'],
    ['voice-credits', lang === 'zh' ? '配音演员与录音来源' : 'Voice cast and recording credits'], ['restart', copy.restart], ['confirm-restart', copy.restartConfirm], ['health-label', copy.hp],
    ['touch-quiet', copy.quiet], ['touch-sprint', copy.sprint], ['touch-jump', copy.jump], ['touch-shift', copy.shift], ['touch-use', copy.touchUse],
    ['guide-title', copy.controlsTitle], ['guide-phase', copy.phaseControl], ['primer-action', copy.phaseControl], ['guide-move', copy.move], ['guide-look', copy.look],
    ['guide-use', copy.use], ['guide-jump', copy.jump], ['mouse-look', copy.capture]
  ].forEach(([id, value]) => screenText(id, value));
  const touch = coarsePointer.matches;
  const keyCap = key => Object.assign(document.createElement('kbd'), { textContent: key });
  $('guide-phase-key').replaceChildren(touch ? copy.tapDayNight : keyCap('X'));
  $('primer-key').replaceChildren(touch ? copy.tapDayNight : keyCap('X'));
  $('guide-move-key').replaceChildren(touch ? copy.onScreen : keyCap('WASD'));
  $('guide-look-key').replaceChildren(touch ? copy.drag : copy.mouse);
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
  if (lastChapter === state.level.id) return;
  dialogue.stop();
  visual?.load(state.level, state.map);
  lastChapter = state.level.id;
  previousHUD = '';
  notice(lang === 'zh' ? state.level.subtitleZh : state.level.subtitle, 5);
}

function interactionPrompt({ type, id }) {
  const copy = t();
  const use = coarsePointer.matches ? '' : '[E] ';
  if (type === 'station') {
    if (state.completed.has(id)) return copy.workDone;
    const phase = state.requiredPhase(id);
    if (phase && phase !== (state.night ? 'night' : 'day')) return phase === 'night' ? copy.needNight : copy.needDay;
    return use + copy.work;
  }
  if (type === 'clue') return use + (state.hasRecord(id) ? copy.reviewRecord : copy.clue);
  if (type === 'note') return use + copy.mourningNote;
  if (type === 'power') return state.progress.powered ? copy.lightOn : use + copy.powerAction;
  if (type === 'lamp') return use + copy.lampAction;

  const stationsLeft = state.map.stations.length - state.completed.size;
  if (stationsLeft) return copy.remainingStations(stationsLeft);
  let text = use + copy.lift;
  const unread = state.map.clues.reduce((count, tile) => count + Number(!state.hasRecord(tile.key)), 0);
  if (unread) text += ' · ' + copy.remainingRecords(unread);
  if (state.map.power && !state.progress.powered) text += ' · ' + copy.lightOff;
  return text;
}

function pursuitPrompt() {
  const zh = lang === 'zh', touch = coarsePointer.matches;
  if (!state.chase.started) {
    if (touch) return zh ? '按住前进奔跑 · 跳过断口 · 左右绕架 · 切换长桥' : 'Hold forward to run · Jump gaps · Dodge shelving · Switch bridges';
    return zh ? '按住 W 奔跑 · 空格跳跃 · A / D 绕架 · X 切换长桥' : 'Hold W to run · Space to jump · A / D to dodge · X to switch bridges';
  }
  const part = nextChaseObstacle(state.chase.distance);
  if (!part) return zh ? '靠向走廊正中，穿过绿灯门' : 'Aim for the centre of the green fire door';
  if (part.at - state.chase.distance > 11) return '';
  if (part.kind === 'rack') return part.opening === 'left' ? (zh ? '← 左侧通过' : '← Pass on the left') : (zh ? '右侧通过 →' : 'Pass on the right →');
  if (part.kind === 'bridge') {
    if (part.phase === (state.night ? 'night' : 'day')) return zh ? '过桥，保持奔跑' : 'Bridge connected · Keep running';
    const prefix = touch ? '' : '[X] ';
    return prefix + (part.phase === 'night' ? (zh ? '切到黑夜接桥' : 'Switch to night for the bridge') : (zh ? '切到白天接桥' : 'Switch to day for the bridge'));
  }
  return (touch ? '' : '[Space] ') + (part.kind === 'gap' ? (zh ? '跳过断口' : 'Jump the gap') : (zh ? '跨过矮栏' : 'Jump the barrier'));
}

function updateHUD() {
  const status = [state.level.id, state.chase?.started, state.departing, state.chase ? Math.floor(state.chase.distance / 2) : '', state.night, state.hp, state.completed.size, state.progress.powered].join('/');
  if (status !== previousHUD) {
    const copy = t();
    previousHUD = status;
    $('hud').classList.toggle('pursuit', Boolean(state.chase));
    const { level, levelIndex, completed, map, night, hp } = state;
    screenText('floor-label', state.chase ? 'B½' : copy.chapter + ' ' + (levelIndex + 1) + ' / ' + state.levels.length);
    screenText('room-title', lang === 'zh' ? level.zh : level.title);
    screenText('station-progress', state.chase ? Math.max(0, Math.ceil(BACKROOMS_TRACK.length - state.chase.distance)) + ' m' : completed.size + ' / ' + map.stations.length + ' ' + copy.workCount);
    const objective = state.chase && !state.chase.started
      ? (lang === 'zh' ? '电梯停在夹层。你出来时，身后又响起了脚步声。' : 'The lift stopped between floors. A second pair of footsteps followed you out.')
      : currentObjective();
    screenText('objective', ' · ' + objective);
    screenText('phase-time', night ? '18:00' : '17:59');
    screenText('phase-label', night ? copy.after : copy.before);
    screenText('phase-action', night ? copy.toDay : copy.toNight);
    $('phase-badge').dataset.night = String(night);
    [...$('health').children].forEach((node, i) => node.classList.toggle('full', i < hp));
    $('health').setAttribute('aria-label', hp + ' HP');
  }
  const stamina = Math.round(state.stamina * 100);
  if (stamina !== previousStamina) {
    previousStamina = stamina;
    $('stamina').style.width = state.stamina * 100 + '%';
    $('stamina-meter').setAttribute('aria-valuenow', stamina);
  }
  const target = state.mode === 'playing' ? state.getInteraction() : null;
  const shortcut = state.map.shortcut;
  const atShortcut = state.mode === 'playing' && state.life === 'alive' && shortcut &&
    state.map.at(state.x, state.z) === shortcut.pads[0];
  const prompt = state.chase && state.life === 'alive' && !state.departing && state.mode === 'playing' ? pursuitPrompt() : target ? interactionPrompt(target) :
    atShortcut ? shortcut.title[Number(lang === 'zh')] + ' · ' +
      t()[coarsePointer.matches ? 'shortcutTouch' : 'shortcutKeys'] : '';
  if ($('interaction').textContent !== prompt) screenText('interaction', prompt);
  $('interaction').hidden = !prompt;
  const gazeWarning = $('gaze-warning');
  gazeWarning.hidden = state.mode !== 'playing' || state.life !== 'alive' || state.gaze < .08;
  if (!gazeWarning.hidden) {
    const command = state.watching ? t().mourningLook : t().mourningBreak;
    if ($('gaze-command').textContent !== command) screenText('gaze-command', command);
    gazeWarning.dataset.breaking = String(!state.watching);
    $('gaze-fill').style.transform = 'scaleX(' + state.gaze + ')';
    $('gaze-meter').setAttribute('aria-valuenow', Math.floor(state.gaze * 20) * 5);
  }
  $('death').hidden = state.life === 'alive' || state.mode !== 'playing';
  if (!$('death').hidden) {
    const deathCopy = state.life === 'dying'
      ? (state.level.mourning && state.deathCause === 'ghost' ? t().mourningContact : t()[state.deathCause])
      : state.chase ? (lang === 'zh' ? '回到中转层电梯' : 'Back at the transfer lift')
        : state.level.mourning ? t().mourningRevival : t().revival;
    if ($('death-copy').textContent !== deathCopy) screenText('death-copy', deathCopy);
    $('death').style.opacity = state.life === 'dying' ? Math.min(1, .2 + state.lifeTimer) : Math.max(0, 1 - state.lifeTimer / .68);
  }
  $('flash').style.opacity = state.reduceMotion ? 0 : state.shiftFx * .57;
}

function processEvents() {
  for (const event of state.drain()) {
    if (event.type === 'sound') {
      sound.cue(event.name, event.position);
      if (['interact', 'pickup', 'door'].includes(event.name)) visual?.janitorHands.operate();
    }
    if (event.type === 'warning') { sound.cue('warning', event.ghost); notice(t().warning, 2.6); }
    if (event.type === 'notice') {
      const firstLamp = event.id === 'lamp' && state.levelIndex === 0 && state.completed.size === 0 && !state.night;
      notice(t()[event.id] + (firstLamp ? ' ' + t().lampSteps : ''), firstLamp || event.id === 'mourningArrival' ? 6 : 3);
    }
    if (event.type === 'story') {
      notice(event.pair?.[lang === 'zh' ? 1 : 0] ?? t()[event.id], 6);
    }
    if (event.type === 'save') saveProgress();
    if (event.type === 'chapter' || event.type === 'backrooms') loadChapter();
    if (event.type === 'mourning-guide' && event.manual) {
      noticeUntil = 0;
      $('notice').hidden = true;
    }
    if (event.type === 'death') { clearInput(); dialogue.stop(); }
    if (!state.chase) dialogue.onGameEvent(event, state);
  }
}

function clearInput() {
  keys.clear();
  for (const { button } of touchKeys.values()) button.removeAttribute('data-held');
  touchKeys.clear();
  edges = {};
  dragging = null;
  freeMouse = null;
}

function focusScene() { canvas.focus({ preventScroll: true }); }

function updateMouseLook() {
  const locked = document.pointerLockElement === canvas;
  $('mouse-sensitivity-row').hidden = !finePointer.matches;
  $('mouse-look').hidden = Boolean(error) || state.mode !== 'playing' || !finePointer.matches || !canvas.requestPointerLock || locked;
  screenText('key-legend', locked ? t().capturedLegend : t().legend);
}

function requestMouseLook() {
  if (state.mode !== 'playing' || !finePointer.matches ||
    !canvas.requestPointerLock || document.pointerLockElement === canvas) return;
  // Request during the trusted click, before audio startup or other async work.
  // Older implementations signal a failure through pointerlockerror only.
  try { canvas.requestPointerLock()?.catch(() => {}); }
  catch { notice(t().captureFailed, 5); }
}

function start() {
  if (error) return;
  if (state.mode === 'won') return showPanel('journal');
  const firstShift = state.mode === 'menu' && !storedRun.progress;
  clearInput();
  state.mode = 'playing';
  updateScreen();
  if (firstShift) notice(storedRun.issue ? t()[storedRun.issue] : t().firstSteps, 8);
  sound.setMuted(muted);
  sound.setVolume(volume);
  focusScene();
  requestMouseLook();
  sound.start().catch(e => console.warn('Audio unavailable.', e));
  sound.update(soundState());
  dialogue.resume();
  if (firstShift) dialogue.play('boilerGuide');
}

function focusResume() {
  const active = document.activeElement;
  if (state.mode !== 'paused' || error || document.hidden || !document.hasFocus() || $('panel').open) return;
  if (active === canvas || active === document.body) $('start').focus({ preventScroll: true });
}

function pause() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  dialogue.pause();
  clearInput();
  saveProgress();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  updateScreen();
  requestAnimationFrame(focusResume);
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
  $('restart').hidden = !storedRun.progress && storedRun.issue !== 'protectedSave' && state.mode !== 'won';
  $('confirm-restart').hidden = true;
  screenText('panel-title', isJournal ? t().journal : t().settings);
  if (isJournal) {
    const records = state.progress.evidence;
    screenText('journal-summary', records.length + ' / ' + state.totalClues + ' · ' + t().evidence);
    const list = $('journal-list');
    list.replaceChildren();
    if (!records.length) screenText('journal-list', t().journalEmpty);
    const guide = state.levels.find((level, i) => level.mourning && i <= state.levelIndex)?.guide;
    if (guide) {
      const article = document.createElement('p');
      article.className = 'journal-guide';
      article.textContent = guide[lang === 'zh' ? 1 : 0];
      list.append(article);
    }
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
  const run = state.chase;
  const active = run?.started && state.mode === 'playing' && state.life === 'alive' && !state.departing;
  const part = active && nextChaseObstacle(run.distance);
  return {
    x: state.x, z: state.z, yaw: state.yaw, night: state.night,
    chase: active ? { progress: Math.min(1, run.distance / BACKROOMS_TRACK.length), elapsed: run.elapsed,
      danger: run.danger, threat: state.ghosts[0],
      obstacle: part && part.at >= run.distance && part.at - run.distance <= BACKROOMS_TRACK.speed ? part.id : null,
      obstacleType: part?.kind ?? null } : null,
    level: state.levelIndex, tension: state.tension, ghosts: state.ghosts,
    paused: state.mode === 'paused' || state.mode === 'menu' || document.hidden || Boolean(error)
  };
}

$('start').onclick = start;
$('settings-button').onclick = () => showPanel('settings');
$('journal').onclick = () => showPanel('journal');
$('close-panel').onclick = () => $('panel').close();
$('pause').onclick = pause;
$('mouse-look').onclick = () => { focusScene(); requestMouseLook(); };
$('phase-badge').onclick = () => { edges.shift = true; focusScene(); };
$('language').onclick = () => {
  lang = lang === 'en' ? 'zh' : 'en';
  noticeUntil = 0;
  labels();
  savePrefs();
};
coarsePointer.addEventListener('change', labels);
finePointer.addEventListener('change', updateMouseLook);
function toggleSound() { muted = !muted; sound.setMuted(muted); labels(); savePrefs(); }
$('mute').onclick = toggleSound;
$('volume').value = String(volume);
$('volume').oninput = () => { volume = Number($('volume').value); sound.setVolume(volume); savePrefs(); };
const sensitivityControl = $('mouse-sensitivity');
sensitivityControl.value = String(mouseSensitivity);
function updateSensitivityLabel() {
  const label = Math.round(mouseSensitivity * 100) + '%';
  screenText('mouse-sensitivity-value', label);
  sensitivityControl.setAttribute('aria-valuetext', label);
}
updateSensitivityLabel();
sensitivityControl.oninput = () => {
  mouseSensitivity = Number(sensitivityControl.value);
  updateSensitivityLabel();
  savePrefs();
};
$('quality').value = state.quality;
$('quality').onchange = () => { state.quality = $('quality').value; savePrefs(); };
$('adaptive').checked = state.autoResolution;
$('adaptive').onchange = () => { state.autoResolution = $('adaptive').checked; savePrefs(); };
$('fps-visible').checked = showFps;
$('fps-visible').onchange = () => { showFps = $('fps-visible').checked; savePrefs(); };
$('reduced').checked = state.reduceMotion;
$('reduced').onchange = () => { state.reduceMotion = $('reduced').checked; savePrefs(); };
$('restart').onclick = () => { $('confirm-restart').hidden = false; $('confirm-restart').focus(); };
$('confirm-restart').onclick = () => {
  if (!restartRun(storage)) {
    notice(t().saveFailed, 5);
    return;
  }
  storedRun = loadRun(storage);
  state.reset();
  dialogue.reset();
  lastChapter = -1;
  loadChapter();
  $('panel').close();
  start();
};
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  const wasLocked = previouslyLocked;
  previouslyLocked = locked;
  freeMouse = null;
  if (locked && state.mode !== 'playing') document.exitPointerLock();
  if (!locked && wasLocked) {
    if (state.mode === 'playing') pause();
    else requestAnimationFrame(focusResume);
  }
  updateMouseLook();
});
document.addEventListener('pointerlockerror', () => {
  if (state.mode === 'playing') notice(t().captureFailed, 5);
});
function mouseLook(dx, dy) {
  const gain = .0023 * mouseSensitivity;
  state.look(dx * gain, -dy * gain);
}

document.addEventListener('mousemove', event => {
  if (document.pointerLockElement === canvas) mouseLook(event.movementX, event.movementY);
});
canvas.addEventListener('pointerleave', () => { freeMouse = null; });

const actions = { Space: 'jump', KeyX: 'shift', KeyE: 'interact' };
const playKeys = new Set(['KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight','Space','KeyX','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
function held(code) { return keys.has(code) || touchKeys.has(code); }
function down(code, repeat = false) {
  if (!repeat && !held(code) && actions[code]) edges[actions[code]] = true;
  keys.add(code);
}
function releaseJump(code) {
  if (code === 'Space' && !held(code)) edges.release = true;
}
window.addEventListener('keydown', event => {
  if ($('panel').open || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || event.target.closest?.('input,select')) return;
  const { code, repeat } = event;
  if (code === 'KeyM' && !repeat) return toggleSound();
  if (code === 'KeyJ' && !repeat) return showPanel('journal');
  if (code === 'Escape' && !repeat && state.mode === 'playing') return pause();
  if (event.key === 'Enter' && !repeat && state.mode === 'paused' && (event.target === canvas || event.target === document.body)) {
    event.preventDefault();
    start();
    return;
  }
  if (state.mode !== 'playing' || !playKeys.has(code)) return;
  if (code === 'Space' && event.target.closest?.('button,a')) return;
  event.preventDefault();
  down(code, repeat);
});
window.addEventListener('keyup', event => {
  if (keys.delete(event.code)) releaseJump(event.code);
});
window.addEventListener('blur', transitionToMenuWhenUnfocused);
document.addEventListener('visibilitychange', () => { if (document.hidden) transitionToMenuWhenUnfocused(); });

for (const button of document.querySelectorAll('[data-touch]')) {
  const code = button.dataset.touch;
  button.addEventListener('pointerdown', event => {
    if (state.mode !== 'playing' || state.life !== 'alive' || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (!held(code) && actions[code]) edges[actions[code]] = true;
    if (!touchKeys.has(code)) touchKeys.set(code, { button, pointers: new Set() });
    touchKeys.get(code).pointers.add(event.pointerId);
    button.setAttribute('data-held', '');
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, event => {
      const control = touchKeys.get(code);
      if (!control?.pointers.delete(event.pointerId) || control.pointers.size) return;
      touchKeys.delete(code);
      button.removeAttribute('data-held');
      releaseJump(code);
    });
  }
  button.addEventListener('click', event => {
    if (state.mode === 'playing' && state.life === 'alive' && event.detail === 0 && actions[code]) {
      edges[actions[code]] = true;
    }
  });
}
canvas.addEventListener('pointerdown', event => {
  if (state.mode !== 'playing' || event.button !== 0 || document.pointerLockElement === canvas || dragging) return;
  focusScene();
  if (event.pointerType === 'mouse') return;
  canvas.setPointerCapture(event.pointerId);
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
canvas.addEventListener('click', event => {
  // Use the completed mouse gesture, like the Resume and Capture buttons.
  if (event.pointerType === 'mouse' || (!event.pointerType && !coarsePointer.matches)) requestMouseLook();
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') {
    if (state.mode !== 'playing' || document.pointerLockElement === canvas) return;
    const { clientX: x, clientY: y } = event;
    if (freeMouse) mouseLook(x - freeMouse.x, y - freeMouse.y);
    freeMouse = { x, y };
    return;
  }
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
    forward: Number(held('KeyW')) - Number(held('KeyS')),
    side: Number(held('KeyD')) - Number(held('KeyA')),
    sprint: held('ShiftLeft') || held('ShiftRight'), quiet: held('KeyC'), ...edges
  };
  edges = {};
  return input;
}

function frame(time) {
  const elapsed = lastFrame ? (time - lastFrame) / 1000 : 0;
  const dt = Math.min(.067, elapsed);
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
  if (!error) visual?.render(state, dt, elapsed);
  const stats = visual?.frameBudget;
  const fpsLabel = showFps && stats?.fps ? Math.round(stats.fps) + ' FPS' : '';
  if ($('fps-readout').textContent !== fpsLabel) {
    screenText('fps-readout', fpsLabel);
    $('fps-readout').hidden = !fpsLabel;
  }
  requestAnimationFrame(frame);
}
labels();
requestAnimationFrame(frame);
// Read-only smoke-test and accessibility diagnostics.
window.lastLight3D = Object.freeze({
  snapshot: () => ({
    chapter: state.levelIndex, mode: state.mode, phase: state.night ? 'night' : 'day',
    x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch,
    mouseLocked: document.pointerLockElement === canvas, hp: state.hp, deaths: state.progress.deaths,
    work: [...state.completed], evidence: [...state.progress.evidence], life: state.life, deathCause: state.life === 'dying' ? state.deathCause : null,
    chase: state.chase ? { ...state.chase, length: BACKROOMS_TRACK.length, exiting: state.departing,
      pursuer: { x: state.ghosts[0].x, z: state.ghosts[0].z } } : null,
    gaze: state.level.mourning ? {
      amount: state.gaze, direct: state.watching, noteRead: state.mourningNoteRead,
      figures: state.ghosts.map(({ key, x, z, active, watching }) => ({ key, x, z, active, watching }))
    } : null,
    dialogue: { id: dialogue.active?.id ?? null, playing: Boolean(dialogue.active?.source) },
    fps: visual?.frameBudget.fps ?? null, resolutionScale: visual?.frameBudget.scale ?? 1,
    webgl: Boolean(visual && !error), ending: state.mode === 'won' ? state.ending : null
  })
});
