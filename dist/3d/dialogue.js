import { GUIDANCE_LINES, MOURNING_LINES, fileForVoice, mourningVoiceURL } from './mourning-audio.js';

const LINES = {
  mourningGuide: MOURNING_LINES.guide,
  mourningGlance: MOURNING_LINES.glance,
  boilerGuide: GUIDANCE_LINES.boiler3d,
  roofGuide: GUIDANCE_LINES.roof,
  lost: {
    channel: 'stairwell',
    seconds: 1.81,
    speaker: ['Voice in the stairwell', '楼梯间的声音'],
    words: ['I don’t know where I am.', '我不知道我在哪儿。']
  },
  evacuate: {
    channel: 'intercom',
    seconds: 1.08,
    speaker: ['Evacuation intercom', '疏散广播'],
    words: ['Get out of here!', '快离开这里！']
  },
  calling: {
    channel: 'archive',
    seconds: 2.64,
    speaker: ['Operator’s recording', '接线员的录音'],
    words: ['Sister? Are you there?', '姐姐？你在吗？']
  },
  trapped: {
    channel: 'archive',
    seconds: 2.60,
    speaker: ['Operator’s recording', '接线员的录音'],
    words: ['Sister, help me, please.', '姐姐，求你帮帮我。']
  },
  gap: {
    seconds: 1.71, channel: 'intercom',
    speaker: ['B2 / grating loudspeaker', '地下二层 · 格栅通道广播'],
    words: ['Please mind the gap.', '请留意脚下的缺口。']
  },
  doors: {
    seconds: 2.26, channel: 'intercom',
    speaker: ['Lift door interlock', '升降梯门联锁广播'],
    words: ['Please stand away from the doors.', '请远离梯门。']
  },
  register: {
    seconds: 3.30, channel: 'intercom',
    speaker: ['F4 / personnel terminal', '四楼 · 人事档案终端'],
    words: ['Scan complete.', '扫描结束。'],
    next: { at: 1.46, words: ['Anomaly detected.', '检测到异常。'] }
  },
  exchange: {
    seconds: 5.63, channel: 'archive',
    speaker: ['F4 / switchboard playback', '四楼 · 总机回放'],
    words: ['The number you have dialled has not been recognised.', '您拨打的号码无法识别。'],
    next: { at: 3.30, words: ['Please hang up and try again later.', '请挂断，稍后再拨。'] }
  },
  lunch: {
    seconds: 1.71, channel: 'stairwell',
    speaker: ['A voice behind Gary’s door', 'Gary 门后的声音'],
    words: ['Thanks so much.', '真的谢谢你。']
  },
  circuit: {
    seconds: 3.06, channel: 'intercom',
    speaker: ['Roof / emergency circuit', '屋顶 · 应急照明回路'],
    words: ['Initialising sequence.', '正在初始化。'],
    next: { at: 2.12, words: ['Connected.', '已接通。'] }
  },
  farewell: {
    seconds: 1.07, channel: 'intercom',
    speaker: ['Street exit speaker', '临街出口广播'],
    words: ['Goodbye.', '再见。']
  },
  recovered: {
    seconds: 1.98, channel: 'archive',
    speaker: ['Recovered tape / evacuee', '修复的录音 · 撤离者'],
    words: ['Thank you for saving us.', '谢谢你救了我们。']
  }
};

const CHAPTER_RECORDINGS = [
  ['gap', 'lost', 'evacuate', 'doors', 'boilerGuide'],
  ['calling', 'trapped', 'register', 'exchange', 'lunch', 'doors', 'mourningGuide', 'mourningGlance'],
  ['circuit', 'farewell', 'recovered', 'doors', 'roofGuide']
];

export class Dialogue {
  constructor(sound, caption) {
    this.sound = sound;
    this.caption = caption;
    this.speaker = caption.querySelector('strong');
    this.words = caption.querySelector('span');
    this.language = 0;
    this.paused = false;
    this.heard = new Set();
    this.queue = [];
    this.files = new Map();
    this.decoded = new Map();
    this.lastWarning = -Infinity;
    this.positions = new Map();
  }

  preload(ids = CHAPTER_RECORDINGS[0]) {
    for (const id of ids) {
      const line = LINES[id];
      const file = line?.stem ? fileForVoice(line) : id;
      if (this.files.has(file)) continue;
      const url = mourningVoiceURL(file);
      this.files.set(file, fetch(url).then(response => response.ok ? response.arrayBuffer() : null).catch(() => null));
    }
  }

  setLanguage(language) {
    this.language = language === 'zh' ? 1 : 0;
    if (this.active?.shown) this.show(this.active);
  }

  show(entry) {
    const { line } = entry;
    this.speaker.textContent = line.speaker[this.language];
    const words = entry.secondCaption ? line.next.words : line.words;
    this.words.textContent = words[this.language];
    this.caption.hidden = false;
  }

  onGameEvent(event, state) {
    const floor = state.levelIndex;
    if (event.type === 'mourning-guide') {
      this.play('mourningGuide', { repeat: Boolean(event.manual), position: event.position });
    } else if (event.type === 'mourning-glance') {
      const now = state.time ?? performance.now() / 1000;
      if (now < this.lastWarning || now - this.lastWarning >= 7) {
        this.lastWarning = now;
        this.play('mourningGlance', { repeat: true, urgent: true });
      }
    } else if (event.type === 'chapter') {
      this.preload(CHAPTER_RECORDINGS[floor]);
      if (floor === 2 && state.mode === 'playing' && state.completed.size === 0) this.play('roofGuide');
    } else if (event.type === 'sound') {
      if (floor === 0 && state.night && event.name === 'shift') this.play('lost');
      if (event.name === 'ending') {
        this.stop();
        this.play(state.ending === 'complete' ? 'recovered' : 'farewell');
      }
    } else if (event.type === 'notice') {
      if (event.id === 'locked') this.play('doors');
      if (event.id === 'lamp' && floor === 0 && state.completed.size === 0 && !state.night) this.play('gap');
      if (event.id === 'power' && floor === 2) this.play('circuit');
    } else if (event.type === 'story') {
      if (floor === 0 && event.station === 'A') {
        const hatch = state.map.stations.find(tile => tile.kind === 'A');
        this.sound.cue('hatch', hatch);
      }
      if (floor === 0 && event.station === 'C') this.play('evacuate');
      if (floor === 1 && event.clue) this.play(event.clue === '1' ? 'calling' : 'trapped');
      if (floor === 1 && event.station === 'A') this.play(state.night ? 'exchange' : 'register');
      if (floor === 1 && event.station === 'C') this.play('lunch');
    }
  }

  play(id, { repeat = false, urgent = false, position } = {}) {
    if (!LINES[id] || this.active?.id === id || this.queue.includes(id) || (!repeat && this.heard.has(id))) return;
    if (repeat) this.heard.delete(id);
    if (position) this.positions.set(id, position);
    if (urgent) {
      // A warning must stay current. An initial manual recording can be
      // replayed from its prop, and an old combat warning should never queue.
      this.clearActive();
      this.queue.unshift(id);
    } else {
      this.queue.push(id);
    }
    void this.next();
  }

  async next() {
    if (this.paused || this.active || !this.queue.length) return;
    const id = this.queue.shift();
    this.preload([id]);
    const line = LINES[id];
    const entry = { id, line, position: this.positions.get(id) };
    this.active = entry;
    const file = line.stem ? fileForVoice(line) : id;
    const context = this.sound.context;
    let buffer;
    if (context) {
      try {
        if (!this.decoded.has(file)) {
          this.decoded.set(file, this.files.get(file).then(bytes => bytes && context.decodeAudioData(bytes.slice(0))));
        }
        buffer = await this.decoded.get(file);
      } catch {
        this.decoded.delete(file);
      }
    }
    if (this.active !== entry) return;
    entry.source = buffer ? this.sound.playDialogue(buffer, line.channel, entry.position) : null;
    entry.source?.addEventListener('ended', () => {
      if (this.active !== entry) return;
      entry.source = null;
      this.heard.add(id);
    }, { once: true });
    entry.shown = true;
    this.show(entry);
    if (line.next) {
      entry.captionTimer = setTimeout(() => {
        if (this.active !== entry) return;
        entry.secondCaption = true;
        this.show(entry);
      }, line.next.at * 1000);
    }
    const visibleFor = line.channel === 'warning' ? 1.20 : Math.max(2.15, (buffer?.duration ?? line.seconds) + .45);
    entry.timer = setTimeout(() => {
      if (this.active !== entry) return;
      this.heard.add(id);
      this.active = null;
      this.caption.hidden = true;
      void this.next();
    }, visibleFor * 1000);
  }

  pause() {
    this.paused = true;
    const id = this.active?.id;
    if (id && id !== 'mourningGlance' && !this.heard.has(id)) this.queue.unshift(id);
    this.clearActive();
  }

  resume() {
    this.paused = false;
    void this.next();
  }

  clearActive() {
    const entry = this.active;
    this.active = null;
    if (entry) {
      clearTimeout(entry.timer);
      clearTimeout(entry.captionTimer);
      if (entry.source) this.sound.stopDialogue(entry.source);
    }
    this.caption.hidden = true;
  }

  stop() {
    this.queue.length = 0;
    this.positions.clear();
    this.clearActive();
  }

  reset() {
    this.stop();
    this.heard.clear();
    this.lastWarning = -Infinity;
  }
}
