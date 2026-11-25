import {annexScore,replayAnnex,cancelAnnexReplay} from './backrooms.js';
import {Art} from './art.js';
import {Sound} from './audio.js';
import {Simulation,FIXED_DT} from './simulation.js';
import {loadSave,storeSave,restartSave,freshSave} from './save.js';
import {STORY} from './story.js';
import {CHAPTERS} from './chapters.js';
import {MOUSE_RIGHT,bindRightMouse,createPlayerSettings} from './player-settings.js';
import {mountPlayerSettings} from './settings-panel.js';
import {isMobilePlay} from './mobile-play.js';
const $=id=>document.getElementById(id),canvas=$('game'),art=new Art(canvas),sound=new Sound();
let storage;try{storage=window.localStorage;}catch{}
let loaded=storage?loadSave(storage):{data:freshSave(),warnings:['storage-unavailable'],readOnly:true};
const preferences=createPlayerSettings('2d',storage);
const heldInputs=new Map(),settingsDialog=$('settings');
let state=new Simulation(loaded.data),edges={},lastTime=null,accumulator=0,starting=false;
state.difficulty=preferences.difficulty;
const text=()=>STORY[state.lang];
const touchMode=matchMedia("(pointer: coarse)"),useTouchCue=isMobilePlay;
function clearInput(){heldInputs.clear();edges={};}
function held(action){
 for(const current of heldInputs.values())if(current===action)return true;
 return false;
}
function hint(action){return preferences.label(action,state.lang,true);}
function canvasHint(action){
 if(preferences.keys(action).find(Boolean)===MOUSE_RIGHT)return state.lang==='zh'?'右键':'RMB';
 return hint(action);
}
function instruction(copy){return copy.replace(/\{(\w+)\}/g,(_,action)=>hint(action));}
function storageNotice(){
 notify(state.lang==='zh'?'当前无法保存进度，原存档已保留。可在页面底部重开并备份原档。':'Progress cannot be saved. Your existing save is safe. Restart shift below to back it up and begin again.',6);
}
function persist(){
 state.persist();
 if(loaded.readOnly)return;
 try{
  if(!storeSave(storage,state.progress)){loaded.readOnly=true;storageNotice();}
 }catch{storageNotice();}
}
function syncPhase(){sound.setPhase(state.night);labels();}
function notify(message,seconds=5){state.message=message;state.messageTimer=seconds;$('status').textContent=message;}
function labels(){
 const t=text(),zh=state.lang==='zh',office=state.floor===1&&!state.backrooms;
 state.short=t.short[state.floor];
 state.shortZh=STORY.zh.short[state.floor];
 $('floor-label').textContent=state.backrooms?(zh?'档案附楼 / 后室':'RECORDS ANNEX / THE BACKROOMS'):`0${state.floor+1} / ${t.floors[state.floor]}${state.expanded?' · '+(state.sector+1)+'/6':''}`;
 $('phase-label').textContent=zh?(state.night?'夜 · 事故后 18:00':'日 · 事故前 17:59'):(state.night?'NIGHT · AFTER 18:00':'DAY · BEFORE 17:59');
 $('aside-copy').innerHTML=office?instruction(t.mourningHelp):state.expanded?instruction(t.relayHelp):(zh?'日：17:59 的记忆。夜：18:00 的废墟。':'Day: a memory. Night: what remained.');
 $('touch-lower-eyes').hidden=!office;
 $('office-gaze-control').hidden=!office;
 $('pause-button').disabled=state.mode!=='playing'&&state.mode!=='paused';
 $('sound').textContent=zh?(sound.muted?'声音关':'声音开'):(sound.muted?'SOUND OFF':'SOUND ON');
 $('sound').setAttribute('aria-pressed',String(sound.muted));
}
function controlLabels(){
 const t=text(),zh=state.lang==='zh';
 document.documentElement.lang=state.lang;
 document.title=t.title;
 state.controlKeys=useTouchCue()?{right:'→',jump:'↑',shift:'◐',interact:'↵'}:{right:canvasHint('right'),jump:canvasHint('jump'),shift:canvasHint('shift'),interact:canvasHint('interact')};
 $('language').textContent=zh?'EN':'中文';
 $('play-3d').textContent=zh?'玩 3D 版':'Play 3D';
 $('tagline').innerHTML=zh?'大楼没有下班。<br>给最后一个人留门。':'The shift never ended.<br>Leave a door for the last person.';
 $('under-title').textContent=zh?'不是杀光所有鬼，是让所有人离开。':'Not every shadow is your enemy.';
 $('under-copy').textContent=instruction(t.hint);
 $('aside-key').textContent=hint('shift');
 const controlNames=zh?{move:'移动',jump:'跳跃',shift:'切换昼夜',interact:'操作 / 阅读',walk:'低头',pause:'暂停'}:{move:'MOVE',jump:'JUMP',shift:'SWITCH DAY / NIGHT',interact:'DOOR / READ',walk:'LOWER EYES',pause:'PAUSE'};
 for(const label of document.querySelectorAll('[data-control-name]'))label.textContent=controlNames[label.dataset.controlName];
 for(const key of document.querySelectorAll('[data-binding]'))key.textContent=hint(key.dataset.binding);
 const touchNames=zh?{left:'向左移动',right:'向右移动',jump:'跳跃',walk:'低头',shift:'切换昼夜',interact:'互动'}:{left:'Move left',right:'Move right',jump:'Jump',walk:'Lower eyes',shift:'Switch day and night',interact:'Interact'};
 for(const button of document.querySelectorAll('.touch button'))button.setAttribute('aria-label',touchNames[button.dataset.action]);
 $('settings-open').textContent=zh?'设置':'Settings';
 $('settings-menu').textContent=zh?'设置':'Settings';
 $('settings-title').textContent=zh?'设置':'Settings';
 $('settings-close').textContent=zh?'完成':'Done';
 $('settings-audio-title').textContent=zh?'声音与效果':'Sound & effects';
 $('master-caption').textContent=zh?'总音量':'Master volume';
 $('music-caption').textContent=zh?'音乐':'Music';
 $('sfx-caption').textContent=zh?'音效':'Sound effects';
 $('flash-caption').textContent=zh?'减弱闪光':'Reduce flashes';
 $('journal').textContent=zh?`交班日志 [${hint('journal')}]`:`Journal [${hint('journal')}]`;
 $('sound').setAttribute('aria-label',zh?`静音 [${hint('mute')}]`:`Mute audio [${hint('mute')}]`);
 settingsPanel.update(state.lang);
 labels();
}
function card(title,body,button,hint=''){ $('overlay').classList.remove('hidden');$('card-title').innerHTML=title;$('card-copy').innerHTML=body;$('start').textContent=button;$('start-hint').textContent=hint;}
function showCard(){const t=text();if(state.mode==='menu')card(t.introTitle,t.introCopy,state.progress.checkpointId?t.resume:t.start,instruction(t.hint));else if(state.mode==='paused')card(t.pause,t.pauseCopy,t.resume);else if(state.mode==='between')card(t.floors[state.floor],t.between,t.next);else if(state.mode==='won')card(state.ending==='complete'?t.completeTitle:t.normalTitle,state.ending==='complete'?t.completeCopy:t.normalCopy,t.replay);}
function drain(){for(const event of state.drain()){
 if(event.type==='sound'){if(event.position!=null)sound.effectAt(event.name,event.position,state.player.x,event.amount??1,event.surface??'concrete');else sound.effect(event.name,event.amount??1,event.surface??'concrete');}
 else if(event.type==='save')persist();
 else if(event.type==='annex-entry'||event.type==='annex-escape'){sound.stopOfficeVoice?.();syncPhase();}
 else if(event.type==='clear-input')clearInput();
 else if(event.type==='shift'){syncPhase();sound.effect('shift');}
 else if(event.type==='respawn')syncPhase();
 else if(event.type==='shift-rejected'&&event.reason!=='locked')notify(text().shiftRejected,1.2);
 else if(event.type==='death'){
  clearInput();sound.stopOfficeVoice?.();
  const t=text();
  if(event.cause)notify(event.cause==='eye-contact'?t.mourningDeath:t.mourningContact,4);
  else {sound.effect(event.kind==='ghost'?'ghost':event.kind==='fall'?'fallDeath':'death');notify(event.kind==='ghost'?t.ghost:t.death,3);}
 }
 else if(event.type==='mourning-guide'){
  const t=text();notify(t.mourningGuide+' '+(useTouchCue()?t.mourningTouch:instruction(t.mourningLower)),8);
  sound.warnMourning?.('guide',state.lang);
 }
 else if(event.type==='mourning-glance'){
  const t=text();notify(useTouchCue()?t.mourningWarningTouch:instruction(t.mourningWarning),1.35);
  if(event.voice)sound.warnMourning?.('glance',state.lang);
 }
 else if(event.type==='checkpoint'){sound.effect('checkpoint');notify(text().lamp,2.5);}
 else if(event.type==='task'){sound.effect(state.floor===0?'valve':'collect');notify(state.floor===2?text().roofTasks[event.index]:text().task[state.floor][event.index],7);}
 else if(event.type==='evidence'){sound.effect('evidence');notify(text().evidence[event.id],8);}
 else if(event.type==='tutorial'){notify(instruction(text().tutorial),7);if(state.floor===0)sound.playGuidance?.('boiler',state.lang);}
 else if(event.type==='scene-beat'){if(event.id==='phone'){if(event.beat===0)sound.effect('phone');else sound.stopPhone();}else if(['fire-door','lunchbox'].includes(event.id))sound.effect(event.beat===0?'handle':'doorOpen');else if(['reservoir','plants','coolant'].includes(event.id))sound.effect('water');else if(event.beat===0)sound.effect('knock');}
 else if(event.type==='pursuit-warning'){sound.effect('warningBell');notify(state.lang==='zh'?'预警：出口在右侧。留门，不要留在走廊。':'Warning: exit to the right. Leave the door, not yourself in the corridor.',5);}
 else if(event.type==='need-work')notify(state.lang==='zh'?'先完成本区交接，门闩才会放行。':'Complete this section’s work to release its door.',3);
 else if(event.type==='work')sound.effect('checkpoint');
 else if(event.type==='sector'){sound.stopOfficeVoice?.();sound.setFloor(state.floor);syncPhase();notify(state.lang==='zh'?state.sectorData.spec.zh:state.sectorData.spec.en,3);}
 else if(event.type==='route-hint')notify(text().upperRoute,7);
 else if(event.type==='light'){sound.effect('checkpoint');notify(text().light,4);}
 else if(event.type==='need')notify(text().need,3);
 else if(event.type==='floor'){sound.stopOfficeVoice?.();sound.setFloor(state.floor);syncPhase();notify(text().story[state.floor],8);if(state.floor===2)sound.playGuidance?.('roof',state.lang);}
 else if(['between','ending'].includes(event.type)){sound.menu=true;clearInput();showCard();}
 }}
function focusPlayfield(){
 canvas.focus({preventScroll:true});
 const frame=canvas.getBoundingClientRect();
 if(frame.top<0||frame.bottom>window.innerHeight){
  window.scrollBy(0,Math.round(frame.top+(frame.height-window.innerHeight)/2));
 }
}
async function activate(){
 if(starting)return;starting=true;
 try{await sound.start();}catch(e){notify(state.lang==='zh'?'音频暂不可用，仍可继续游戏。':'Audio unavailable; play can continue.',3);}
 try{
  if(state.mode==='won'){showVisits();return;}
  const from=state.mode;if(from==='paused')state.resume();else state.start();clearInput();accumulator=0;lastTime=null;sound.menu=false;sound.setPhase(state.night);sound.setFloor(state.floor);sound.setVolumes(state.progress.settings);$('overlay').classList.add('hidden');focusPlayfield();labels();if(from==='menu'){if(loaded.readOnly)storageNotice();else notify(text().story[state.floor],9);}drain();
 }finally{starting=false;}
}
function pause(){clearInput();if(state.pause()){sound.stopOfficeVoice?.();accumulator=0;persist();labels();showCard();}}
function toggleMute(){sound.mute();state.muted=sound.muted;state.soundFlash=1;labels();}
function togglePause(){if(state.mode==='paused')activate();else pause();}
function openSettings(){pause();if(!settingsDialog.open)settingsDialog.showModal();}
const settingsPanel=mountPlayerSettings($('gameplay-settings'),preferences,{onChange:()=>{
 clearInput();
 state.difficulty=preferences.difficulty;
 controlLabels();
 showCard();
}});
$('start').onclick=activate;
$('sound').onclick=toggleMute;
$('settings-open').onclick=openSettings;
$('settings-menu').onclick=openSettings;
$('settings-close').onclick=()=>{settingsPanel.cancelCapture();settingsDialog.close();};
settingsDialog.addEventListener('close',()=>settingsPanel.cancelCapture());
$('pause-button').onclick=togglePause;
$('language').onclick=()=>{state.lang=state.lang==='en'?'zh':'en';controlLabels();persist();showCard();};
$('restart').onclick=()=>{
 const next=new Simulation(freshSave());
 try{
  if(storage){restartSave(storage,next.persist());loaded={data:next.progress,warnings:[],readOnly:false};}
 }catch{notify(state.lang==='zh'?'备份或写入失败，未重开。':'Could not back up or write the save. Restart cancelled.',5);return;}
 state=next;
 state.difficulty=preferences.difficulty;
 clearInput();
 sound.setPhase(false);
 syncAudioSettings();
 controlLabels();
 showCard();
};
$('shift-button').onclick=()=>{if(state.mode==='playing')edges.shift=true;canvas.focus({preventScroll:true});};
function journal(){pause();const t=text();$('journal-title').textContent=t.journal;const list=$('journal-entries');list.replaceChildren();for(const id of state.progress.evidence){const p=document.createElement('p');p.textContent=t.evidence[id]||id;list.append(p);}for(const event of state.progress.events.filter(x=>x==='record-corrected')){const p=document.createElement('p');p.textContent=t.task[1][1];list.append(p);}for(let f=0;f<3;f++)for(let i=0;i<3;i++)if(state.progress.chapterProgress[f]?.[i]){const p=document.createElement('p');p.textContent=`${t.floors[f]} · ${f===2?t.roofTasks[i]:t.task[f][i]}`;list.append(p);}if(state.floor>=1){const clue=document.createElement('p');clue.textContent=instruction(t.mourningHelp);list.append(clue);}if(!list.childNodes.length)list.textContent=t.noEntries;$('journal-dialog').showModal();}
$('journal').onclick=journal;$('journal-close').onclick=()=>{$('journal-dialog').close();};
function visitSection(floor,sector,annex=false){
 sound.stopOfficeVoice?.();
 cancelAnnexReplay(state);
 if(sector==null)state.loadFloor(floor);else state.loadSector(floor,sector);
 if(annex)replayAnnex(state);
 state.mode='playing';
 $('visit-dialog').close();
 $('overlay').classList.add('hidden');
 clearInput();
 sound.menu=false;
 sound.setFloor(floor);
 syncPhase();
 persist();
 focusPlayfield();
}
function showVisits(){
 const list=$('visit-entries');
 list.replaceChildren();
 const unlocked=Math.max(state.floor,state.events.includes('chapter-1-complete')?2:state.events.includes('chapter-0-complete')?1:0);
 function add(label,floor,sector,annex=false){
  const button=document.createElement('button');
  button.textContent=label;
  button.onclick=()=>visitSection(floor,sector,annex);
  list.append(button);
 }
 for(let floor=0;floor<3;floor++){
  if(floor>unlocked&&!state.progress.finished)continue;
  add(`${floor+1} · ${text().floors[floor]}`,floor);
  if(state.expanded)for(const [sector,spec] of CHAPTERS[floor].entries()){
   if(state.progress.visitedSectors.includes(`${floor}/${spec.id}`))add(`↳ ${sector+1} · ${state.lang==='zh'?spec.zh:spec.en}`,floor,sector);
  }
 }
 const pastAnnex=state.floor===2||state.expanded&&(state.floor===1&&state.sector>2||state.progress.visitedSectors.includes('1/pantry'));
 if(pastAnnex||state.progress.finished||state.events.includes('backrooms-escaped')||state.events.includes('chapter-1-complete'))add(state.lang==='zh'?'↳ 后室 · 档案附楼':'↳ The Backrooms · Records Annex',1,state.expanded?2:undefined,true);
 $('visit-dialog').showModal();
}
$('chapters').onclick=()=>{pause();showVisits();};$('visit-close').onclick=()=>{$('visit-dialog').close();};
const volumeKeys=['master','music','sfx'];
function syncAudioSettings(){
 for(const key of volumeKeys)$(`volume-${key}`).value=state.progress.settings[key];
 $('reduced-effects').checked=state.reducedEffects;
 sound.setVolumes(state.progress.settings);
}
for(const key of volumeKeys){const slider=$(`volume-${key}`);slider.oninput=()=>{state.progress.settings[key]=Number(slider.value);sound.setVolumes(state.progress.settings);persist();};}
$('reduced-effects').onchange=e=>{state.reducedEffects=e.target.checked;state.progress.settings.reducedEffects=state.reducedEffects;persist();};
function inputDown(source,action,repeat=false){
 if(action==='mute'){if(!repeat)toggleMute();return;}
 if(action==='journal'){if(!repeat)journal();return;}
 if(action==='pause'){if(!repeat)togglePause();return;}
 if(state.mode!=='playing'||repeat)return;
 if(state.player.lifeState==='dying'){
  if((action==='jump'||action==='interact')&&state.deaths>1){
   const end=state.death?.duration;
   if(!end||state.player.lifeTime>end-.29)state.player.lifeTime=Math.max(state.player.lifeTime,end?end-.09:.85);
  }
  return;
 }
 if(state.scene){if(action==='interact'||action==='jump')edges.interact=true;return;}
 if(state.player.lifeState!=='alive'&&state.player.lifeState!=='hurt')return;
 if(heldInputs.has(source))return;
 const alreadyHeld=held(action);
 heldInputs.set(source,action);
 if(!alreadyHeld&&(action==='jump'||action==='shift'||action==='interact'))edges[action]=true;
}
function inputUp(source){
 const action=heldInputs.get(source);
 heldInputs.delete(source);
 if(action==='jump'&&!held(action))edges.release=true;
}
function pressBinding(code,repeat=false,mouse=false){
 if(document.querySelector('dialog[open]'))return false;
 const action=preferences.actionFor(code);
 if(!action)return false;
 if(action!=='pause'&&action!=='mute'&&action!=='journal'){
  if(state.mode!=='playing')return false;
  if(mouse)canvas.focus({preventScroll:true});
  if(document.activeElement!==canvas)return false;
 }
 inputDown(code,action,repeat);
 return true;
}
window.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.isComposing||event.metaKey||(event.ctrlKey&&event.code!=='ControlLeft'&&event.code!=='ControlRight')||event.altKey)return;
 if(event.target.closest?.('input,select,textarea,[contenteditable]'))return;
 if((event.code==='Space'||event.code==='Enter')&&event.target.closest?.('button,a'))return;
 if(pressBinding(event.code,event.repeat))event.preventDefault();
});
window.addEventListener('keyup',event=>inputUp(event.code));
bindRightMouse(canvas.parentElement,code=>pressBinding(code,false,true),inputUp);
canvas.addEventListener('blur',clearInput);
for(const button of document.querySelectorAll('[data-action]')){
 const release=event=>{event.preventDefault();inputUp(`touch-${event.pointerId}`);};
 button.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();
  button.setPointerCapture(event.pointerId);
  inputDown(`touch-${event.pointerId}`,button.dataset.action);
 });
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
}
window.addEventListener('blur',()=>{pause();sound.setFocus(false);lastTime=null;accumulator=0;});window.addEventListener('focus',()=>sound.setFocus(!document.hidden));document.addEventListener('visibilitychange',()=>{sound.setFocus(!document.hidden);if(document.hidden)pause();lastTime=null;accumulator=0;});
function frame(timestamp){const elapsed=lastTime==null?0:Math.min(.1,(timestamp-lastTime)/1000);lastTime=timestamp;
 if(state.mode==='playing'){accumulator+=elapsed;let ticks=0;while(accumulator>=FIXED_DT&&ticks++<12){const input={left:held('left'),right:held('right'),walk:held('walk'),...edges};edges={};state.step(input);drain();accumulator-=FIXED_DT;}}else accumulator=0;
 if(state.officeGuide)state.officeGuide.playing=state.mode==='playing'&&!state.backrooms&&Boolean(sound.isMourningPlaying?.('guide'));
 sound.setChase?.(annexScore(state));
 sound.setNarrative?.({sector:state.sector||0,scene:state.scene?.id||'',pursuit:!!state.pursuit?.active,resolution:state.scene?.id==='ending-complete'||state.mode==='won'&&state.ending==='complete'});sound.setTension(state.pursuit?.active||state.ghosts.some(g=>g.state==='chase')?1:state.backrooms?0:state.officeGaze.amount);art.render(state,elapsed);requestAnimationFrame(frame);
}
touchMode.addEventListener('change',controlLabels);
window.addEventListener('lastlightmobileplay',controlLabels);
syncAudioSettings();controlLabels();showCard();requestAnimationFrame(frame);
window.lastLight={snapshot:()=>({...state.snapshot(),difficulty:preferences.difficulty,warnings:loaded.warnings.slice(),audio:sound.ctx?{state:sound.ctx.state,muted:sound.muted,focus:sound.focus,phase:sound.night?'night':'day',voices:sound.voices,recentEffects:sound.audit.slice(-15)}:null})};
