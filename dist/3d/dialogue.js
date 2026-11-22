const LINES = {
  lost: {
    seconds: 1.81,
    speaker: ['Voice in the stairwell', '楼梯间的声音'],
    words: ['I don’t know where I am.', '我不知道我在哪儿。']
  },
  evacuate: {
    seconds: 1.08,
    speaker: ['Evacuation intercom', '疏散广播'],
    words: ['Get out of here!', '快离开这里！']
  },
  calling: {
    seconds: 2.64,
    speaker: ['Operator’s recording', '接线员的录音'],
    words: ['Sister? Are you there?', '姐姐？你在吗？']
  },
  trapped: {
    seconds: 2.60,
    speaker: ['Operator’s recording', '接线员的录音'],
    words: ['Sister, help me, please.', '姐姐，求你帮帮我。']
  }
};

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
  }

  preload() {
    for (const id of Object.keys(LINES)) {
      if (this.files.has(id)) continue;
      const url = new URL('./assets/dialogue/' + id + '.m4a', import.meta.url);
      this.files.set(id, fetch(url).then(response => response.ok ? response.arrayBuffer() : null).catch(() => null));
    }
  }

  setLanguage(language) {
    this.language = language === 'zh' ? 1 : 0;
    if (this.active?.shown) this.show(this.active.line);
  }

  show(line) {
    this.speaker.textContent = line.speaker[this.language];
    this.words.textContent = line.words[this.language];
    this.caption.hidden = false;
  }

  play(id) {
    if (!LINES[id] || this.heard.has(id) || this.active?.id === id || this.queue.includes(id)) return;
    this.queue.push(id);
    void this.next();
  }

  async next() {
    if (this.paused || this.active || !this.queue.length) return;
    this.preload();
    const id = this.queue.shift();
    const line = LINES[id];
    const entry = { id, line };
    this.active = entry;
    let buffer;
    const context = this.sound.context;
    if (context) {
      try {
        if (!this.decoded.has(id)) {
          this.decoded.set(id, this.files.get(id).then(bytes => bytes && context.decodeAudioData(bytes.slice(0))));
        }
        buffer = await this.decoded.get(id);
      } catch {
        this.decoded.delete(id);
      }
    }
    if (this.active !== entry) return;
    entry.source = buffer ? this.sound.playDialogue(buffer) : null;
    entry.source?.addEventListener('ended', () => {
      if (this.active !== entry) return;
      entry.source = null;
      this.heard.add(id);
    }, { once: true });
    entry.shown = true;
    this.show(line);
    const visibleFor = Math.max(2.15, (buffer?.duration ?? line.seconds) + .45);
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
    if (id && !this.heard.has(id)) this.queue.unshift(id);
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
      if (entry.source) this.sound.stopDialogue(entry.source);
    }
    this.caption.hidden = true;
  }

  stop() {
    this.queue.length = 0;
    this.clearActive();
  }

  reset() {
    this.stop();
    this.heard.clear();
  }
}
