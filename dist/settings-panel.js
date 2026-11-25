import {BINDING_SLOTS, DIFFICULTIES, keyLabel} from './player-settings.js';

const copy = {
  game: ['Difficulty', '难度'],
  controls: ['Key bindings', '键位'],
  summary: ['Use any slot to change a key. One key per action is required.', '点选任意键位即可修改。每个动作至少保留一个按键。'],
  movement: ['Movement', '移动'],
  look: ['Keyboard camera', '键盘视角'],
  action: ['Actions', '动作'],
  menu: ['Game controls', '游戏菜单'],
  primary: ['Primary', '主键'],
  secondary: ['Secondary', '副键'],
  extra: ['Extra', '备用键'],
  press: ['Press a key', '按下新键'],
  clear: ['Clear slot', '清除键位'],
  cancel: ['Cancel', '取消'],
  change: ['Use another key', '换一个按键'],
  swap: ['Swap keys', '交换键位'],
  reset: ['Restore default keys', '恢复默认键位'],
  resetDone: ['Default keys restored.', '已恢复默认键位。'],
  required: ['This action needs at least one key.', '这个动作需要至少保留一个按键。'],
  invalid: ['Choose a game key. Esc cancels and Tab moves focus.', '请选择可绑定的按键。Esc 取消，Tab 移动焦点。'],
  added: ['Key binding saved.', '已保存键位。'],
  removed: ['Key slot cleared.', '已清除该键位。'],
  selected: ['Selected', '已选择'],
  changed: ['Difficulty saved.', '难度已保存。']
};

const sections = [['move', 'movement'], ['act', 'action'], ['look', 'look'], ['menu', 'menu']];
const slots = ['primary', 'secondary', 'extra'];

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function button(className, value, action) {
  const node = element('button', className, value);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

export function mountPlayerSettings(host, prefs, {onChange = () => {}} = {}) {
  let language, tab = 'game', capture = null, note = '', pending = null;
  const root = element('div', 'player-settings');
  host.replaceChildren(root);
  const t = (id) => copy[id][Number(language === 'zh')];
  const rowLabel = (row) => row.label[Number(language === 'zh')];
  const slotName = (slot) => t(slots[slot]);
  const tabSelector = id => '[data-player-tab="' + id + '"]';
  const focusTab = () => root.querySelector(tabSelector(tab))?.focus();
  const focusKey = ({action, slot}) =>
    root.querySelector('[data-bind-action="' + action + '"][data-bind-slot="' + slot + '"]')?.focus();

  function finish(message) {
    const selection = capture;
    capture = pending = null;
    note = message;
    draw();
    if (selection) focusKey(selection);
  }

  function apply(code, swap = false) {
    const result = prefs.rebind(capture.action, capture.slot, code, swap);
    if (result.ok) {
      finish(t(code ? 'added' : 'removed'));
      onChange();
      return;
    }
    if (result.reason === 'conflict') {
      pending = {code, action: result.action};
      note = '';
      draw();
      root.querySelector('[data-conflict-retry]')?.focus();
      return;
    }
    pending = null;
    note = t(result.reason === 'required' ? 'required' : 'invalid');
    draw();
    focusKey(capture);
  }

  // Capture before either game's keyboard handlers. Escape only cancels the
  // edit here, leaving the containing panel open.
  function captureKey(event) {
    if (!capture || !host.getClientRects().length) return;
    if (event.code === 'Tab') return;
    if (pending && event.code !== 'Escape') return;
    if ((event.code === 'Enter' || event.code === 'Space') &&
      event.target instanceof Element && event.target.closest('.player-binding-capture button')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.isComposing || event.repeat) return;
    if (event.code === 'Escape') {
      finish('');
      return;
    }
    if (event.metaKey || event.altKey || (event.ctrlKey && !event.code.startsWith('Control')) ||
      (event.shiftKey && !event.code.startsWith('Shift'))) {
      note = t('invalid');
      draw();
      focusKey(capture);
      return;
    }
    apply(event.code);
  }
  document.addEventListener('keydown', captureKey, true);

  function selectTab(id) {
    capture = pending = null;
    note = '';
    tab = id;
    draw();
    focusTab();
  }

  function gameContent(panel) {
    const group = element('div', 'player-difficulty');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t('game'));
    for (const [id, profile] of Object.entries(DIFFICULTIES)) {
      const choice = element('label', 'player-difficulty-card');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'last-light-difficulty';
      radio.value = id;
      radio.checked = prefs.difficulty === id;
      radio.addEventListener('change', () => {
        if (!prefs.setDifficulty(id)) return;
        note = t('changed');
        draw();
        root.querySelector('input:checked')?.focus();
        onChange();
      });
      const ownLabel = element('span', 'player-difficulty-title', rowLabel(profile));
      const detail = element('span', 'player-difficulty-description', profile.description[Number(language === 'zh')]);
      choice.append(radio, ownLabel, detail);
      group.append(choice);
    }
    panel.append(group);
  }

  function editSlot(row, slot) {
    capture = {action: row.id, slot};
    pending = null;
    note = '';
    draw();
    focusKey(capture);
  }

  function bindingContent(panel) {
    const intro = element('div', 'player-binding-intro');
    intro.append(element('p', '', t('summary')));
    intro.append(button('player-binding-reset', t('reset'), () => {
      prefs.resetBindings();
      finish(t('resetDone'));
      root.querySelector('.player-binding-reset')?.focus();
      onChange();
    }));
    panel.append(intro);
    const groups = element('div', 'player-binding-groups');
    for (const [group, title] of sections) {
      const rows = prefs.actions.filter(row => row.group === group);
      if (!rows.length) continue;
      const list = element('section', 'player-binding-list');
      list.append(element('h3', 'player-binding-group-title', t(title)));
      for (const row of rows) {
        const item = element('div', 'player-binding-row');
        item.append(element('span', 'player-binding-label', rowLabel(row)));
        const keys = element('div', 'player-binding-keys');
        const current = prefs.keys(row.id);
        for (let slot = 0; slot < BINDING_SLOTS; slot++) {
          const value = current[slot];
          const chosen = capture?.action === row.id && capture?.slot === slot;
          const key = button('player-keycap', chosen && !pending ? '…' : (keyLabel(value, language) || '+'),
            () => editSlot(row, slot));
          key.dataset.bindAction = row.id;
          key.dataset.bindSlot = slot;
          key.classList.toggle('player-keycap-empty', !value);
          key.classList.toggle('player-keycap-capture', chosen);
          key.setAttribute('aria-label', rowLabel(row) + ' · ' + slotName(slot) + (value ? ' · ' + keyLabel(value, language) : ''));
          keys.append(key);
        }
        item.append(keys);
        list.append(item);
        if (capture?.action === row.id) {
          const tools = element('div', 'player-binding-capture');
          const message = pending ?
            (language === 'zh'
              ? keyLabel(pending.code, language) + ' 已绑定「' + rowLabel(prefs.actions.find(other => other.id === pending.action)) + '」。'
              : keyLabel(pending.code, language) + ' is bound to ' + rowLabel(prefs.actions.find(other => other.id === pending.action)) + '.')
            : t('press') + ' · Esc';
          const text = element('div', 'player-binding-message', message);
          text.setAttribute('role', 'status');
          tools.append(text);
          if (pending) {
            const retry = button('', t('change'), () => editSlot(row, capture.slot));
            retry.dataset.conflictRetry = '';
            tools.append(retry, button('', t('swap'), () => apply(pending.code, true)));
          } else if (current[capture.slot]) tools.append(button('', t('clear'), () => apply(null)));
          tools.append(button('', t('cancel'), () => finish('')));
          list.append(tools);
        }
      }
      groups.append(list);
    }
    panel.append(groups);
  }

  function draw() {
    root.replaceChildren();
    const nav = element('div', 'player-settings-tabs');
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', language === 'zh' ? '游戏设置' : 'Game settings');
    for (const id of ['game', 'controls']) {
      const item = button('player-settings-tab', t(id), () => selectTab(id));
      item.dataset.playerTab = id;
      item.id = 'player-tab-' + id;
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', String(tab === id));
      item.setAttribute('aria-controls', 'player-panel-' + id);
      item.tabIndex = tab === id ? 0 : -1;
      item.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        selectTab(id === 'game' ? 'controls' : 'game');
      });
      nav.append(item);
    }
    const panel = element('div', 'player-settings-content');
    panel.id = 'player-panel-' + tab;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'player-tab-' + tab);
    if (tab === 'game') gameContent(panel);
    else bindingContent(panel);
    const status = element('p', 'player-settings-status', note);
    status.setAttribute('role', 'status');
    root.append(nav, panel, status);
  }

  return {
    update(lang) {
      if (language === lang && root.childElementCount) return;
      language = lang;
      capture = pending = null;
      note = '';
      draw();
    },
    cancelCapture() {
      if (!capture) return;
      capture = pending = null;
      note = '';
      draw();
    }
  };
}
