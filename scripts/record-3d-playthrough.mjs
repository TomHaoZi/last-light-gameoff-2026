import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Recording-only CDP instrumentation. Gameplay continues to use normal input.
// Frames retain their compositor timestamps; the final mux is done offline.
export class PlaythroughRecording {
  constructor(folder, send) {
    this.folder = folder;
    this.send = send;
    this.frames = [];
    this.writes = new Set();
    this.errors = [];
    this.audioStarted = null;
    this.audioBytes = 0;
    this.active = false;
  }

  async install(entry) {
    await mkdir(join(this.folder, 'frames'), { recursive: true });
    await this.send('Runtime.addBinding', { name: '__lastLightRecordingAudio' });
    await this.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      if (location.pathname !== ${JSON.stringify(entry)}) return;
      const original = AudioNode.prototype.connect;
      const recorded = new WeakSet();
      AudioNode.prototype.connect = function(destination, ...rest) {
        const result = original.call(this, destination, ...rest);
        if (destination !== this.context.destination || recorded.has(this.context) ||
            typeof this.context.createMediaStreamDestination !== 'function' || typeof MediaRecorder !== 'function') return result;
        recorded.add(this.context);
        try {
          const sink = this.context.createMediaStreamDestination();
          original.call(this, sink);
          const recorder = new MediaRecorder(sink.stream, { mimeType:'audio/webm;codecs=opus', audioBitsPerSecond:160000 });
          let queue = Promise.resolve();
          const signal = data => window.__lastLightRecordingAudio(JSON.stringify(data));
          recorder.onstart = () => signal({ start: Date.now() / 1000 });
          recorder.ondataavailable = ({data}) => {
            if (!data.size) return;
            queue = queue.then(async () => {
              const bytes = new Uint8Array(await data.arrayBuffer());
              let payload = '';
              for (let at = 0; at < bytes.length; at += 8192) payload += String.fromCharCode(...bytes.subarray(at, at + 8192));
              signal({ opus: btoa(payload) });
            });
          };
          window.__stopLastLightRecordingAudio = () => new Promise(resolve => {
            if (recorder.state === 'inactive') return resolve();
            recorder.onstop = () => queue.then(resolve);
            recorder.stop();
          });
          recorder.start(850);
        } catch (error) { window.__lastLightRecordingAudio(JSON.stringify({ error: String(error) })); }
        return result;
      };
    })();` });
  }

  async start() {
    this.audio = createWriteStream(join(this.folder, 'game-audio.webm'));
    this.audio.on('error', error => this.errors.push(String(error)));
    this.active = true;
    this.startedAt = Date.now() / 1000;
    await this.send('Page.startScreencast', { format:'jpeg', quality:87, maxWidth:1280, maxHeight:720, everyNthFrame:2 });
  }

  handle(message) {
    if (message.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = message.params;
      void this.send('Page.screencastFrameAck', {sessionId}).catch(() => {});
      if (!this.active) return;
      if (this.frames.length >= 10000 || this.writes.size >= 80) {
        if (!this.errors.length) this.errors.push('Recording exceeded its bounded frame buffer.');
        return;
      }
      const timestamp = metadata.timestamp ?? Date.now()/1000;
      const previous = this.frames.at(-1)?.timestamp ?? 0;
      if (timestamp - previous < .021) return;
      const filename = `frames/${String(this.frames.length).padStart(6,'0')}.jpg`;
      this.frames.push({ filename, timestamp });
      const inFlight = writeFile(join(this.folder, filename), Buffer.from(data,'base64'))
        .catch(error => this.errors.push(String(error)))
        .finally(() => this.writes.delete(inFlight));
      this.writes.add(inFlight);
    } else if (this.active && message.method === 'Runtime.bindingCalled' && message.params.name === '__lastLightRecordingAudio') {
      const data = JSON.parse(message.params.payload);
      if (data.start) this.audioStarted = data.start;
      if (data.error) this.errors.push(data.error);
      if (data.opus) {
        const bytes = Buffer.from(data.opus,'base64');
        this.audioBytes += bytes.length;
        this.audio?.write(bytes);
      }
    }
  }

  async stop() {
    if (!this.active) return;
    this.endedAt = Date.now()/1000;
    // Finish its last Opus chunk before navigating to test save persistence.
    await this.send('Runtime.evaluate', { expression:'window.__stopLastLightRecordingAudio?.()', awaitPromise:true }).catch(() => {});
    await this.send('Page.stopScreencast').catch(() => {});
    this.active = false;
    await Promise.all(this.writes);
    await new Promise((resolve,reject) => {
      this.audio.once('error',reject);
      this.audio.end(resolve);
    });
    const frames = this.frames;
    const first = frames[0]?.timestamp ?? this.startedAt;
    const duration = this.endedAt - first;
    const concat = ['ffconcat version 1.0'];
    for (const [i, frame] of frames.entries()) {
      concat.push(`file '${frame.filename}'`, 'option framerate 1000',
        'duration ' + Math.max(.001,(frames[i+1]?.timestamp ?? this.endedAt) - frame.timestamp).toFixed(4));
    }
    if (frames.length) concat.push(`file '${frames.at(-1).filename}'`, 'option framerate 1000');
    const receipt = {
      frames: frames.length, duration, audioBytes: this.audioBytes, audioOffset: this.audioStarted === null ? null : this.audioStarted - first,
      longestFrameGap: Math.max(0,...frames.slice(1).map((frame,i) => frame.timestamp - frames[i].timestamp)), errors: this.errors
    };
    await Promise.all([
      writeFile(join(this.folder,'frames.ffconcat'),concat.join('\n')+'\n'),
      writeFile(join(this.folder,'recording.json'),JSON.stringify(receipt,null,2)+'\n')
    ]);
  }
}
