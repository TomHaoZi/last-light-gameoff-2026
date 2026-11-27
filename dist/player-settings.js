// Control preferences live separately from progression and autosave data.
export const MOUSE_RIGHT = 'MouseRight';
const BINDINGS_VERSION = 1;

const options = [
  ['left', ['Move left', '向左移动'], ['ArrowLeft', 'KeyA'], ['KeyA'], 'move'],
  ['right', ['Move right', '向右移动'], ['ArrowRight', 'KeyD'], ['KeyD'], 'move'],
  ['forward', ['Move forward', '向前移动'], null, ['KeyW'], 'move'],
  ['back', ['Move backward', '向后移动'], null, ['KeyS'], 'move'],
  ['lookLeft', ['Look left', '向左转视角'], null, ['ArrowLeft'], 'look'],
  ['lookRight', ['Look right', '向右转视角'], null, ['ArrowRight'], 'look'],
  ['lookUp', ['Look up', '向上看'], null, ['ArrowUp'], 'look'],
  ['lookDown', ['Look down', '向下看'], null, ['ArrowDown'], 'look'],
  ['jump', ['Jump', '跳跃'], ['Space', 'ArrowUp', 'KeyW'], ['Space'], 'act'],
  ['shift', ['Switch day / night', '切换昼夜'], [MOUSE_RIGHT, 'ShiftLeft', 'ShiftRight'], [MOUSE_RIGHT], 'act'],
  ['interact', ['Interact / read', '互动 / 阅读'], ['KeyE', 'ArrowDown'], ['KeyE'], 'act'],
  ['attack', ['Strike on the roof', '屋顶挥击'], null, ['KeyF'], 'act'],
  ['sprint', ['Sprint', '冲刺'], null, ['ShiftLeft', 'ShiftRight'], 'move'],
  ['walk', ['Walk quietly / lower eyes', '轻步 / 低头'], ['KeyC'], ['KeyC'], 'move'],
  ['journal', ['Journal', '日志'], ['KeyJ'], ['KeyJ'], 'menu'],
  ['mute', ['Toggle audio', '静音开关'], ['KeyM'], ['KeyM'], 'menu'],
  ['pause', ['Pause / resume', '暂停 / 继续'], ['Escape'], ['Escape'], 'menu']
];

export const BINDING_SLOTS = 3;
const GAME_CODES = /^(?:Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Add|Subtract|Divide|Multiply|Decimal|Enter)|Arrow(?:Left|Right|Up|Down)|Shift(?:Left|Right)|Control(?:Left|Right)|Space|Enter|Home|End|PageUp|PageDown|Insert|Delete|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote)$/;

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: ['Story', '故事'], description: ['Enemies give you more time to react.', '敌人反应较慢，留出更多闪避时间。'],
    gazeDelay: .36, gazeRange: .88, gazeSpeed: .78, ghostSpeed: .84, ghostAlert: .85, hazardRecovery: 1.45
  }),
  normal: Object.freeze({
    label: ['Standard', '标准'], description: ['The usual pace and reaction window.', '原本的节奏与反应窗口。'],
    gazeDelay: .22, gazeRange: 1, gazeSpeed: 1, ghostSpeed: 1, ghostAlert: 1, hazardRecovery: 1
  }),
  hard: Object.freeze({
    label: ['Nightmare', '梦魇'], description: ['Enemies react and close in faster.', '敌人更敏锐，接近速度更快。'],
    gazeDelay: .13, gazeRange: 1.09, gazeSpeed: 1.14, ghostSpeed: 1.13, ghostAlert: 1.14, hazardRecovery: .78
  })
});

export function difficultyRules(id) {
  return Object.hasOwn(DIFFICULTIES, id) ? DIFFICULTIES[id] : DIFFICULTIES.normal;
}

const pair = (en, zh = en) => [en, zh];
const keyNames = {
  ArrowLeft: pair('←'), ArrowRight: pair('→'), ArrowUp: pair('↑'), ArrowDown: pair('↓'),
  MouseRight: pair('Right mouse', '鼠标右键'),
  Escape: pair('Esc'), Space: pair('Space', '空格'), Enter: pair('Enter', '回车'),
  ShiftLeft: pair('L Shift', '左 Shift'), ShiftRight: pair('R Shift', '右 Shift'),
  ControlLeft: pair('L Ctrl', '左 Ctrl'), ControlRight: pair('R Ctrl', '右 Ctrl'),
  PageUp: pair('Pg Up'), PageDown: pair('Pg Dn'), Delete: pair('Del'), Insert: pair('Ins'),
  Comma: pair(','), Period: pair('.'), Slash: pair('/'), Semicolon: pair(';'), Quote: pair("'"),
  BracketLeft: pair('['), BracketRight: pair(']'), Backslash: pair('\\'), Minus: pair('-'),
  Equal: pair('='), Backquote: pair('`'), NumpadEnter: pair('Num Enter'), NumpadAdd: pair('Num +'),
  NumpadSubtract: pair('Num −'), NumpadDivide: pair('Num /'), NumpadMultiply: pair('Num ×'),
  NumpadDecimal: pair('Num .')
};

export function keyLabel(code, language = 'en') {
  return keyNames[code]?.[Number(language === 'zh')] ??
    code?.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ') ?? '';
}

function usable(code, action) {
  return typeof code === 'string' && (code === MOUSE_RIGHT || GAME_CODES.test(code) || (action === 'pause' && code === 'Escape'));
}

function defaultMap(actions) {
  return new Map(actions.map(row => [
    row.id, Array.from({length: BINDING_SLOTS}, (_, slot) => row.defaults[slot] ?? null)
  ]));
}

function readBindings(actions, raw = {}) {
  const fallback = defaultMap(actions);
  if (!raw || typeof raw !== 'object') return fallback;
  const bindings = new Map();
  const assigned = new Set();
  for (const {id} of actions) {
    const codes = Object.hasOwn(raw, id) ? raw[id] : fallback.get(id);
    if (!Array.isArray(codes) || !codes.some(Boolean) || codes.length > BINDING_SLOTS) return fallback;
    const row = Array.from({length: BINDING_SLOTS}, (_, i) => codes[i] ?? null);
    for (const code of row) {
      if (code === null) continue;
      if (!usable(code, id) || assigned.has(code)) return fallback;
      assigned.add(code);
    }
    bindings.set(id, row);
  }
  return bindings;
}

function migrateDefaultShift(saved, is3d) {
  if (saved?.bindingsVersion || !Array.isArray(saved?.bindings?.shift)) return saved?.bindings;
  const priorDefault = is3d ? ['KeyX', null, null] : ['ShiftLeft', 'ShiftRight', 'KeyX'];
  const {shift} = saved.bindings;
  if (shift.length <= BINDING_SLOTS && priorDefault.every((code, index) => code === (shift[index] ?? null))) {
    const custom = {...saved.bindings};
    delete custom.shift;
    return custom;
  }
  return saved.bindings;
}

export function createPlayerSettings(edition, storage) {
  const is3d = edition === '3d';
  const key = 'last-light-' + edition + '-player-settings';
  const actions = options
    .map(([id, label, classic, firstPerson, group]) => ({id, label, defaults: is3d ? firstPerson : classic, group}))
    .filter(row => row.defaults);
  let saved;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    saved = JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    // The game stays usable when private browsing or an iframe denies storage.
  }
  let difficulty = Object.hasOwn(DIFFICULTIES, saved?.difficulty) ? saved.difficulty : 'normal';
  let raw = migrateDefaultShift(saved, is3d);
  if (is3d && raw && typeof raw === 'object' && !Object.hasOwn(raw, 'attack')) {
    // Introducing a default must not reset a player's existing F binding.
    const used = new Set(Object.values(raw).filter(Array.isArray).flat());
    const candidates = ['KeyF', 'KeyV',
      ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', letter => 'Key' + letter),
      ...Array.from('0123456789', number => 'Digit' + number),
      ...Array.from('0123456789', number => 'Numpad' + number),
      ...Object.keys(keyNames)];
    const available = candidates.find(code => usable(code, 'attack') && !used.has(code) &&
      !actions.some(row => row.id !== 'attack' && !Object.hasOwn(raw, row.id) && row.defaults.includes(code)));
    if (available) raw = { ...raw, attack: [available] };
  }
  let bindings = readBindings(actions, raw);
  let byCode = new Map();
  function indexCodes() {
    byCode = new Map();
    for (const [action, codes] of bindings) {
      codes.forEach((code, slot) => { if (code) byCode.set(code, {action, slot}); });
    }
  }
  function persist() {
    try {
      storage?.setItem(key, JSON.stringify({difficulty, bindingsVersion: BINDINGS_VERSION, bindings: Object.fromEntries(bindings)}));
    } catch {
      // Keep the current preferences for the rest of this session.
    }
  }
  function rebind(action, slot, code, swap = false) {
    const codes = bindings.get(action);
    if (!codes || !Number.isInteger(slot) || slot < 0 || slot >= BINDING_SLOTS ||
      (code !== null && !usable(code, action))) return {ok: false, reason: 'invalid'};
    const previous = codes[slot];
    if (code === previous) return {ok: true};
    const conflict = byCode.get(code);
    if (conflict && !swap) return {ok: false, reason: 'conflict', ...conflict};
    if (!code && codes.filter(Boolean).length === 1) return {ok: false, reason: 'required'};
    if (conflict) {
      const target = bindings.get(conflict.action);
      if (previous && !usable(previous, conflict.action)) return {ok: false, reason: 'invalid'};
      if (!previous && conflict.action !== action && target.filter(Boolean).length === 1)
        return {ok: false, reason: 'required'};
      target[conflict.slot] = previous;
    }
    codes[slot] = code;
    indexCodes();
    persist();
    return {ok: true};
  }
  indexCodes();

  return {
    actions,
    get difficulty() { return difficulty; },
    keys(action) { return bindings.get(action)?.slice() ?? []; },
    actionFor(code) { return byCode.get(code)?.action ?? null; },
    label(action, language, primary = false) {
      const codes = bindings.get(action)?.filter(Boolean) ?? [];
      return (primary ? codes.slice(0, 1) : codes).map(code => keyLabel(code, language)).join(' / ');
    },
    rebind,
    setDifficulty(id) {
      if (!Object.hasOwn(DIFFICULTIES, id) || difficulty === id) return false;
      difficulty = id;
      persist();
      return true;
    },
    resetBindings() {
      bindings = defaultMap(actions);
      indexCodes();
      persist();
    }
  };
}

export function bindRightMouse(surface, press, release) {
  let ownedGesture = false;
  window.addEventListener('mousedown', event => {
    if (event.button !== 2) return;
    ownedGesture = !event.defaultPrevented && surface.contains(event.target) &&
      !event.target.closest?.('button,a,input,select,textarea,[contenteditable],dialog') && press(MOUSE_RIGHT);
    if (ownedGesture) event.preventDefault();
  });
  window.addEventListener('mouseup', event => {
    if (event.button === 2) release(MOUSE_RIGHT);
  });
  window.addEventListener('contextmenu', event => {
    if (event.button !== 2 || !ownedGesture) return;
    ownedGesture = false;
    event.preventDefault();
  });
}
