import { GUIDANCE_LINES, MOURNING_LINES, SOB_FILES, decodeOfficeRecording, fileForVoice, mourningCryURL,
  mourningVoiceURL } from './3d/mourning-audio.js';
import { ChaseScore, softPeakCeiling } from './3d/chase-score.js';

// Most effects and music are synthesized locally. Spoken guidance and the office sobs are bundled recordings.
export const SFX_GAIN = Object.freeze({
  footstepConcrete:.12, // soft sole, beneath the melody
  footstepGrate:.18, // a thin resonant plate needs more presence
  footstepCarpet:.075, // intentionally muffled
  jump:.16, land:.23, hurt:.24, death:.22, ghost:.28, revive:.18, shift:.30, collect:.18, door:.32, drip:.08, knock:.11, phone:.075
});
const MELODY=[0,4,7,11,7,4,2,4,7,9,7,4,0,2,4,7,5,9,12,9,7,5,4,2,0,4,7,4,2,0,-1,2];
const midi=n=>440*2**((n-69)/12);
export class Sound {
  constructor(){this.ctx=null;this.muted=false;this.focus=true;this.night=false;this.floor=0;this.menu=true;this.notes=0;this.next=0;this.phoneRang=false;this.micro=0;this.audit=[];this.volumes={master:.8,music:.7,sfx:.85};this.voices=0;this.voiceEnds=[];this.maxVoices=48;this.tension=0;this.sector=0;this.sceneId='';this.resolution=false;this.narrativeKey='';this.lastEffect=new Map();
    this.guidanceReady = new Map();
    this.guidanceAudio = new Map();
    this.sobs = [];
    this.sobVoices = new Set();
    this.guidanceSeq = 0;
    this.officeVoice = null;
    this.lastWarning = -Infinity;
  }
  async start(){
    if(this.ctx){await this.ctx.resume();return;}
    const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;
    this.ctx=new C();const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=.72;
    const compressor=c.createDynamicsCompressor();compressor.threshold.value=-20;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.005;compressor.release.value=.18;
    const limiter=c.createDynamicsCompressor();limiter.threshold.value=-5;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.06;
    const output = c.createGain();
    output.gain.value = .80; // Retain the same attack and makeup headroom as the first-person mixer.
    this.master.connect(compressor).connect(limiter).connect(output).connect(softPeakCeiling(c)).connect(c.destination);
    this.sfxVolume=c.createGain();this.sfxVolume.connect(this.master);this.sfx=c.createGain();this.sfx.connect(this.sfxVolume);
    this.musicVolume=c.createGain();this.storyVolume=c.createGain();this.guidanceMusic=c.createGain();
    this.musicVolume.connect(this.storyVolume).connect(this.guidanceMusic).connect(this.master);this.music=c.createGain();this.roomMusicGate=c.createGain();this.music.connect(this.roomMusicGate).connect(this.musicVolume);this.day=c.createGain();this.nite=c.createGain();this.day.connect(this.music);this.nite.connect(this.music);
    this.ambDay=c.createGain();this.ambNight=c.createGain();this.guidanceRoom=c.createGain();
    this.ambDay.connect(this.guidanceRoom);this.ambNight.connect(this.guidanceRoom);this.guidanceRoom.connect(this.master);
    this.noiseBuffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate);const data=this.noiseBuffer.getChannelData(0);let seed=8137;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/2147483647)*2-1;}
    // Keep the running strings and synthetic throat audible beside the floor's
    // contactor and footsteps at the classic edition's default master level.
    const chaseMusic = c.createGain(), chaseEffects = c.createGain();
    chaseMusic.gain.value = 1.78; chaseEffects.gain.value = 1.36;
    chaseMusic.connect(this.musicVolume); chaseEffects.connect(this.sfxVolume);
    this.chaseScore = new ChaseScore(c, { music: chaseMusic, effects: chaseEffects, noise: this.noiseBuffer });
    this.preloadGuidance();
    this.room();this.setPhase(this.night,true);this.next=c.currentTime+.07;this.timer=setInterval(()=>this.schedule(),40);this.setVolumes(this.volumes);await c.resume();
  }
  preloadGuidance() {
    for (const line of [GUIDANCE_LINES.boiler, GUIDANCE_LINES.roof, ...Object.values(MOURNING_LINES)]) {
      for (const language of ['en', 'zh']) this.loadGuidance(fileForVoice(line, language));
    }
    void Promise.all(SOB_FILES.map(file => decodeOfficeRecording(this.ctx, mourningCryURL(file))))
      .then(buffers => { this.sobs = buffers.filter(Boolean); });
  }

  loadGuidance(file) {
    if (!this.guidanceReady.has(file)) {
      const ready = decodeOfficeRecording(this.ctx, mourningVoiceURL(file)).then(buffer => {
        if (buffer) this.guidanceAudio.set(file, buffer);
        return buffer;
      });
      this.guidanceReady.set(file, ready);
    }
    return this.guidanceReady.get(file);
  }

  playGuidance(cue, language) {
    return this.playVoice(cue, GUIDANCE_LINES[cue], language);
  }

  warnMourning(cue, language) {
    if (!this.ctx || this.floor !== 1) return;
    const now = this.ctx.currentTime;
    if (cue === 'glance') {
      if (now - this.lastWarning < 6) return;
      this.lastWarning = now;
    }
    return this.playVoice(cue, MOURNING_LINES[cue], language);
  }

  isMourningPlaying(cue = 'guide') {
    return Boolean(this.officeVoice && this.officeVoice.cue === cue && !this.muted && this.focus);
  }

  async playVoice(cue, line, language) {
    const context = this.ctx;
    if (!context || !line || this.menu || this.muted || !this.focus || this.officeVoice?.cue === cue) return;
    this.stopOfficeVoice();
    const generation = this.guidanceSeq;
    const floor = this.floor;
    const file = fileForVoice(line, language);
    const buffer = this.guidanceAudio.get(file) ?? await this.loadGuidance(file);
    if (!buffer || generation !== this.guidanceSeq || this.floor !== floor || this.menu || this.muted || !this.focus) return;
    const at = context.currentTime + .006;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = line.channel === 'warning' ? 94 : 145;
    const voice = context.createGain();
    voice.gain.value = .88;
    source.connect(filter).connect(voice).connect(this.master);
    this.officeVoice = { cue, source };
    const duckDuration = buffer.duration;
    for (const [node, level] of [[this.guidanceMusic,.27],[this.guidanceRoom,.38]]) {
      node.gain.cancelScheduledValues(at);
      node.gain.setValueAtTime(node.gain.value,at);
      node.gain.linearRampToValueAtTime(level,at+.045);
      node.gain.setValueAtTime(level,at+duckDuration);
      node.gain.linearRampToValueAtTime(1,at+duckDuration+.29);
    }
    if (line.channel !== 'warning') this.noise(at,.040,.022,1600,this.sfx,1.2);
    source.onended = () => {
      if (this.officeVoice?.source === source) this.officeVoice = null;
      source.disconnect();
      filter.disconnect();
      voice.disconnect();
    };
    this.audit.push('voice-'+cue);
    if (this.audit.length > 80) this.audit.shift();
    source.start(at);
  }

  stopOfficeVoice() {
    this.guidanceSeq++;
    if (!this.officeVoice) return;
    const { source } = this.officeVoice;
    this.officeVoice = null;
    source.stop();
    const at = this.ctx.currentTime;
    for (const node of [this.guidanceMusic,this.guidanceRoom]) {
      node.gain.cancelScheduledValues(at);
      node.gain.setValueAtTime(node.gain.value,at);
      node.gain.linearRampToValueAtTime(1,at+.15);
    }
  }

  stopSobs() {
    for (const slot of this.sobVoices) {
      const at = this.ctx.currentTime;
      slot.gain.gain.setTargetAtTime(.0001, at, .02);
      slot.source.stop(at + .08);
    }
    this.sobVoices.clear();
  }

  playSob(at, attack) {
    if (!this.focus || this.muted || !this.sobs.length) return false;
    const speed = attack ? .81 : .97 + Math.random() * .08;
    const buffer = this.sobs[Math.floor(Math.random() * this.sobs.length)];
    const duration = attack ? Math.min(1.3, buffer.duration) : buffer.duration;
    if (!this.reserveVoice(at,duration/speed)) return false;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = speed;
    gain.gain.value = attack ? .52 : .67;
    source.connect(gain).connect(this.sfx);
    const slot = { source, gain };
    this.sobVoices.add(slot);
    source.onended = () => {
      this.sobVoices.delete(slot);
      source.disconnect();
      gain.disconnect();
    };
    source.start(at,0,duration);
    return true;
  }
  gain(bus,t,g,d,a=.008){const n=this.ctx.createGain();n.gain.setValueAtTime(.00001,t);n.gain.exponentialRampToValueAtTime(Math.max(.0001,g),t+a);n.gain.exponentialRampToValueAtTime(.00001,t+d);n.connect(bus);return n;}
  reserveVoice(t,d){this.voiceEnds=this.voiceEnds.filter(end=>end>t);if(this.voiceEnds.length>=this.maxVoices)return false;this.voiceEnds.push(t+d+.03);return true;}
  tone(f,end,t,d,g=.1,type='sine',bus=this.sfx){if(!this.ctx||!this.reserveVoice(t,d))return;const o=this.ctx.createOscillator(),envelope=this.gain(bus,t,g,d);o.type=type;o.frequency.setValueAtTime(Math.max(15,f),t);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+d);o.connect(envelope);this.voices++;o.onended=()=>{o.disconnect();envelope.disconnect();this.voices--;};o.start(t);o.stop(t+d+.01);}
  noise(t,d,g,frequency=1500,bus=this.sfx,q=.8){if(!this.ctx||!this.reserveVoice(t,d))return;const s=this.ctx.createBufferSource(),envelope=this.gain(bus,t,g,d,.004);s.buffer=this.noiseBuffer;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=frequency;f.Q.value=q;s.connect(f).connect(envelope);this.voices++;s.onended=()=>{s.disconnect();f.disconnect();envelope.disconnect();this.voices--;};s.start(t,Math.random()*1.5);s.stop(t+d+.02);}
  // Tiny synth kit: all composed effects below use 2–3 different sources.
  kick(t,g,d=.18){this.tone(100,36,t,d,g);}
  tick(t,g){this.noise(t,.035,g,4800);this.tone(1800,900,t,.018,g*.3,'square');}
  clunk(t,g){this.kick(t,g,.24);this.noise(t,.15,g*.7,700);this.tone(220,95,t,.16,g*.3,'triangle');}
  whirr(t,g,up=false){this.tone(up?70:380,up?380:45,t,.8,g,'sawtooth');this.noise(t,.7,g*.6,260);}
  buzz(t,g){this.tone(118,63,t,.35,g*.6,'sawtooth');this.noise(t,.3,g*.5,1600);}
  slurp(t,g){this.noise(t,.18,g,1100);this.tone(530,210,t,.19,g*.6);}
  room(){const c=this.ctx;this.roomNodes=[];const hum=(frequency,g,bus,type='sine')=>{const o=c.createOscillator(),v=c.createGain();o.frequency.value=frequency;o.type=type;v.gain.value=g;o.connect(v).connect(bus);o.start();this.roomNodes.push(o);return v;};
    this.hum=hum(48,.035,this.ambDay);hum(96,.009,this.ambDay,'triangle');const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.16;lg.gain.value=.012;lfo.connect(lg).connect(this.hum.gain);lfo.start();this.roomNodes.push(lfo);
    const n=c.createBufferSource();n.buffer=this.noiseBuffer;n.loop=true;this.wind=c.createBiquadFilter();this.wind.type='lowpass';this.wind.frequency.value=260;const v=c.createGain();v.gain.value=.06;n.connect(this.wind).connect(v).connect(this.ambNight);n.start();this.roomNodes.push(n);
    this.micro=c.currentTime+3;
  }
  setPhase(n,immediate=false){if(n!==this.night)this.stopSobs();this.night=n;if(!this.ctx)return;const t=this.ctx.currentTime,d=immediate?0:.18;for(const [node,val] of [[this.day,n?0:.24],[this.nite,n?.29:0],[this.ambDay,n?.08:1],[this.ambNight,n?1:.06]]){node.gain.cancelScheduledValues(t);if(immediate){node.gain.setValueAtTime(val,t);}else{node.gain.setValueAtTime(node.gain.value,t);node.gain.linearRampToValueAtTime(val,t+d);}}}
  setFloor(f){if(f!==this.floor){this.stopOfficeVoice();this.stopSobs();}this.floor=f;this.phoneRang=false;if(this.ctx){const t=this.ctx.currentTime;this.hum.gain.cancelScheduledValues(t);this.hum.gain.setValueAtTime(this.hum.gain.value,t);this.hum.gain.linearRampToValueAtTime([.035,.018,.009][f],t+.5);this.wind.frequency.setValueAtTime(this.wind.frequency.value,t);this.wind.frequency.linearRampToValueAtTime(f===2?900:260,t+.4);}}
  duck(d=.8){if(!this.ctx)return;const t=this.ctx.currentTime,b=this.music;b.gain.cancelScheduledValues(t);b.gain.setValueAtTime(.70794578,t);b.gain.setValueAtTime(.70794578,t+d);b.gain.linearRampToValueAtTime(1,t+d+.18);}
  nearSilence(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(this.master.gain.value,t);this.master.gain.linearRampToValueAtTime(.018,t+.008);this.master.gain.setValueAtTime(.018,t+.295);this.master.gain.linearRampToValueAtTime(this.muted||!this.focus?0:.72*this.volumes.master,t+.305);}
  effect(name,amount=1,surface='concrete'){
    if(!this.ctx)return;const t=this.ctx.currentTime;if(t-(this.lastEffect.get(name)??-10)<.05)return;this.lastEffect.set(name,t);this.audit.push(name);if(this.audit.length>80)this.audit.shift();
    if(name==='step'){const variation=(.92+Math.random()*.16),gain=(.9+Math.random()*.2);const g=SFX_GAIN[{concrete:'footstepConcrete',grate:'footstepGrate',carpet:'footstepCarpet'}[surface]]*gain;this.noise(t,surface==='carpet'?.07:.045,g,surface==='carpet'?450:surface==='grate'?2500:1000);this.tone((surface==='grate'?330:115)*variation,70*variation,t,.065,g*.6,'triangle');if(surface==='grate')this.tone(890*variation,850*variation,t,.12,g*.18);}
    if(name==='jump'){this.noise(t,.13,SFX_GAIN.jump*.6,1000);this.tone(190,360,t,.18,SFX_GAIN.jump*.45);}
    if(name==='land'){const g=SFX_GAIN.land*Math.min(1,Math.max(.2,amount));this.kick(t,g);this.noise(t,.13,g*.55,650);}
    if(name==='hurt'){this.clunk(t,SFX_GAIN.hurt);this.tone(180,72,t,.3,.08,'sawtooth');this.noise(t,.18,.07,900);}
    if(name==='valve'){this.noise(t,.6,.075,2200);this.clunk(t+.15,.14);this.tone(88,48,t,.55,.05,'triangle');}
    if(name==='mourning-cry'&&!this.playSob(t,false)){
      for(const offset of [0,.29,.66]){this.noise(t+offset,.34,.078,710,this.sfx,2.05);this.tone(334,173,t+offset+.05,.22,.026,'triangle');}
    }
    if(name==='mourning-lock'){this.noise(t,.14,.085,1390,this.sfx,1.55);this.tone(82,43,t+.09,.20,.075,'sine');}
    if(name==='mourning-strike'){this.stopSobs();this.playSob(t,true);this.noise(t,.23,.15,1520,this.sfx,1.1);this.duck(.62);}
    if(name==='ghostAlert'){this.tone(320,220,t,.48,.035,'sine');this.noise(t,.5,.025,950);this.duck(.35);}
    if(name==='handle'){this.tick(t,.065);this.clunk(t+.12,.07);}
    if(name==='evidence'){[0,7,12].forEach((v,i)=>this.tone(midi(65+v),midi(65+v),t+i*.1,.5,.04,'sine'));}
    if(name==='checkpoint'){[0,4,7,12].forEach((v,i)=>this.tone(midi(60+v),midi(60+v),t+i*.13,.65,.04,'triangle'));}
    if(name==='fallDeath'){this.tone(320,38,t,.65,.09,'triangle');this.noise(t+.1,.4,.06,450);}
    if(name==='death'){this.buzz(t,.14);this.tone(440,58,t,.6,.08,'triangle');this.tick(t+.18,.08);this.tick(t+.37,.04);}
    if(name==='ghost'){this.noise(t,1.15,SFX_GAIN.ghost,520,this.sfx,2.4);this.tone(92,38,t,1.2,.16,'sawtooth');this.tone(730,190,t+.15,.85,.045,'triangle');this.duck(1.05);}
    if(name==='revive'){[0,3,7,12].forEach((v,i)=>this.tone(midi(48+v),midi(48+v),t+i*.08,.55,SFX_GAIN.revive/(i+1),'sine'));}
    if(name==='shift'){this.tick(t,.11);this.tick(t+.045,.09);this.clunk(t+.09,SFX_GAIN.shift);this.whirr(t+.13,.035,!this.night);this.noise(t,.25,.05,2800);if(this.night){this.tone(680,540,t+.3,.2,.02);this.tone(540,480,t+.48,.2,.016);}this.duck(.55);}
    if(name==='collect'){this.slurp(t,.045);[0,4,7].forEach((v,i)=>this.tone(midi(72+v),midi(72+v),t+i*.06,.35,.08,'triangle'));}
    if(name==='doorOpen'){this.clunk(t,.2);this.whirr(t+.05,.045,true);this.noise(t+.08,.45,.08,380);}
    if(name==='door'){this.clunk(t,SFX_GAIN.door);this.whirr(t+.1,.025,true);this.tick(t+.6,.05);this.duck(.65);}
    if(name==='drip'){this.tone(1450,700,t,.11,.045);this.noise(t,.06,.025,3200);[.16,.29,.43].forEach((delay,i)=>this.tone(950,700,t+delay,.2,.016/(i+1)));}
    if(name==='knock'){this.clunk(t,.06);this.kick(t+.13,.035);}
    if(name==='warningBell'){[0,.65,1.3].forEach(delay=>{this.tone(622,620,t+delay,.48,.055,'sine');this.tone(934,930,t+delay,.35,.025,'sine');});this.duck(1.6);}
    if(name==='water'){for(let i=0;i<5;i++){this.tone(690+i*113,380+i*57,t+i*.18,.3,.022,'sine');this.noise(t+i*.18,.12,.014,1800);}}
    if(name==='phone'&&!this.phoneNear){this.tone(740,738,t,.35,.035,'triangle');this.tone(940,945,t+.08,.35,.022);}
  }
  stopPhone(){// The one-off ring never repeats, approaching cuts its short tail.
    if(this.ctx&&this.floor===1&&this.phoneRang){this.sfx.gain.cancelScheduledValues(this.ctx.currentTime);this.sfx.gain.setTargetAtTime(.1,this.ctx.currentTime,.02);this.sfx.gain.setTargetAtTime(1,this.ctx.currentTime+.25,.04);}}
  setChase(state) {
    if (!this.chaseScore) return;
    const wasActive = Boolean(this.chaseScore.live);
    this.chaseScore.update(this.focus && !this.muted ? state : null);
    const active = Boolean(this.chaseScore.live);
    if (active === wasActive) return;
    const now = this.ctx.currentTime;
    this.roomMusicGate.gain.setTargetAtTime(active ? 0 : 1, now, .04);
    this.next = now + .07;
  }
  schedule(){if(!this.ctx||this.chaseScore?.live)return;const c=this.ctx;while(this.next<c.currentTime+.14){const bar=Math.floor((this.notes%512)/32),i=this.notes%32;const phrase=[0,0,5,2,7,5,2,0,0,-2,5,7,2,5,7,0][bar],variation=bar%3===1?MELODY[(31-i)]:MELODY[(i+(this.sector%3)*8)%32],raw=variation+phrase+(this.floor===1?-5:this.floor===2?7:0)+(this.resolution?0:this.sector===4?-2:0);const minor=v=>{const octave=Math.floor(v/12),pc=((v%12)+12)%12;return octave*12+({4:3,9:8,11:10}[pc]??pc);};
      if(!(bar===3||bar===6)||i%4===0)this.tone(midi(60+raw),midi(60+raw),this.next,this.floor===1?.42:.26,.09,this.floor===2?'sine':'triangle',this.day);
      if(this.tension>.1&&i%4===0){this.tone(49,38,this.next,.18,.055*this.tension,'triangle',this.music);this.noise(this.next,.09,.015*this.tension,1700,this.music);}
      this.tone(midi(36+[0,0,5,7][Math.floor(i/8)]),midi(36+[0,0,5,7][Math.floor(i/8)]),this.next,.16,.085,'triangle',this.day);
      if(i%2===0){let hz=midi(72+(this.resolution?raw:minor(raw)));this.tone(hz,hz*.997,this.next,.65,.085,'sine',this.nite);this.tone(hz*2.003,hz*2,this.next,.22,.02,'sine',this.nite);}
      if(this.sector%2===1&&i%8===4)this.tone(midi(55+raw%12),midi(55+raw%12),this.next,.7,.018,'sine',this.music);
      if(i%8===0)this.tone(midi(36+[0,0,5,7][Math.floor(i/8)]),midi(36+[0,0,5,7][Math.floor(i/8)]),this.next,1.4,.05,'sine',this.nite);
      this.next+=.235;this.notes++;}
    if(c.currentTime>this.micro){if(this.floor===0)this.effect(this.notes%3?'drip':'knock');else if(this.floor===1&&!this.phoneRang&&!this.menu){this.effect('phone');this.phoneRang=true;}else if(this.floor===2){this.noise(c.currentTime,1.7,.03,600,this.ambNight);}this.micro=c.currentTime+6.8+(this.notes%4)*.3;}
    if(this.night&&this.notes%16===0&&this.cricket!==this.notes){this.cricket=this.notes;for(let i=0;i<3;i++)this.tone(4100,4000,c.currentTime+i*.09,.045,.008,'sine',this.ambNight);}
  }
  effectAt(name,worldX,listenerX,amount=1,surface='concrete'){if(!this.ctx)return;const delta=worldX-listenerX,distance=Math.abs(delta);if(distance>650)return;const c=this.ctx,bus=c.createGain();bus.gain.value=1/(1+distance/240);const pan=c.createStereoPanner();pan.pan.value=Math.max(-.85,Math.min(.85,delta/320));const original=this.sfx;bus.connect(pan).connect(original);this.sfx=bus;try{this.effect(name,amount,surface);}finally{this.sfx=original;}const cleanup=c.createOscillator(),silent=c.createGain();silent.gain.value=0;cleanup.connect(silent).connect(this.master);cleanup.onended=()=>{cleanup.disconnect();silent.disconnect();bus.disconnect();pan.disconnect();};cleanup.start();cleanup.stop(c.currentTime+(name==='mourning-cry'?3.6:2.6));}
  setVolumes(v){this.volumes={...this.volumes,...v};if(this.ctx){this.applyVolume();const t=this.ctx.currentTime;for(const [node,value] of [[this.musicVolume,this.volumes.music],[this.sfxVolume,this.volumes.sfx]]){node.gain.cancelScheduledValues(t);node.gain.setValueAtTime(node.gain.value,t);node.gain.linearRampToValueAtTime(value,t+.04);}}}
  setNarrative({sector=0,scene='',pursuit=false,resolution=false}){this.sector=sector;this.sceneId=scene;this.resolution=resolution;const key=`${sector}:${scene}:${pursuit}:${resolution}`;if(!this.ctx||key===this.narrativeKey)return;this.narrativeKey=key;const t=this.ctx.currentTime;this.storyVolume.gain.cancelScheduledValues(t);this.storyVolume.gain.setValueAtTime(this.storyVolume.gain.value,t);this.storyVolume.gain.linearRampToValueAtTime(scene?.62:pursuit?.83:1,t+.7);}
  setTension(value){this.tension=value;}
  mute(value=!this.muted){this.muted=value;if(value){this.setChase(null);this.stopOfficeVoice();this.stopSobs();}this.applyVolume();return value;}
  setFocus(v){this.focus=v;if(!v){this.setChase(null);this.stopOfficeVoice();this.stopSobs();}this.applyVolume();}
  applyVolume(){if(this.ctx){const t=this.ctx.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setValueAtTime(this.master.gain.value,t);this.master.gain.linearRampToValueAtTime(this.muted||!this.focus?0:.72*this.volumes.master,t+.025);}}
}
