import {annexScore,replayAnnex,cancelAnnexReplay} from './backrooms.js';
import {Art} from './art.js';
import {Sound} from './audio.js';
import {Simulation,FIXED_DT} from './simulation.js';
import {loadSave,storeSave,restartSave,freshSave} from './save.js';
import {STORY} from './story.js';
import {CHAPTERS} from './chapters.js';
const $=id=>document.getElementById(id),canvas=$('game'),art=new Art(canvas),sound=new Sound();
let storage;try{storage=window.localStorage;}catch{}
let loaded=storage?loadSave(storage):{data:freshSave(),warnings:['storage-unavailable'],readOnly:true};
let state=new Simulation(loaded.data),keys=new Set(),edges={},lastTime=null,accumulator=0,starting=false;
const text=()=>STORY[state.lang];
function clearInput(){keys.clear();edges={};}
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
function labels(){const t=text();document.documentElement.lang=state.lang;document.title=t.title;state.short=t.short[state.floor];state.shortZh=STORY.zh.short[state.floor];$('floor-label').textContent=`0${state.floor+1} / ${t.floors[state.floor]}${state.expanded?' · '+(state.sector+1)+'/6':''}`;if(state.backrooms)$('floor-label').textContent=state.lang==='zh'?'档案附楼 / 后室':'RECORDS ANNEX / THE BACKROOMS';$('phase-label').textContent=state.lang==='zh'?(state.night?'夜 · 事故后 18:00':'日 · 事故前 17:59'):(state.night?'NIGHT · AFTER 18:00':'DAY · BEFORE 17:59');$('language').textContent=state.lang==='en'?'中文':'EN';$('play-3d').textContent=state.lang==='zh'?'玩 3D 版':'Play 3D';$('tagline').innerHTML=state.lang==='en'?'The shift never ended.<br>Leave a door for the last person.':'大楼没有下班。<br>给最后一个人留门。';$('under-title').textContent=state.lang==='zh'?'不是杀光所有鬼，是让所有人离开。':'Not every shadow is your enemy.';$('under-copy').textContent=t.hint;const routeHint=$('aside-copy');routeHint.innerHTML=state.expanded?t.relayHelp:(state.lang==='zh'?'日：17:59 的记忆。夜：18:00 的废墟。':'Day: a memory. Night: what remained.');$('sound').textContent=sound.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(sound.muted));}
function card(title,body,button,hint=''){ $('overlay').classList.remove('hidden');$('card-title').innerHTML=title;$('card-copy').innerHTML=body;$('start').textContent=button;$('start-hint').textContent=hint;}
function showCard(){const t=text();if(state.mode==='menu')card(t.introTitle,t.introCopy,state.progress.checkpointId?t.resume:t.start,t.hint);else if(state.mode==='paused')card(t.pause,t.pauseCopy,t.resume);else if(state.mode==='between')card(t.floors[state.floor],t.between,t.next);else if(state.mode==='won')card(state.ending==='complete'?t.completeTitle:t.normalTitle,state.ending==='complete'?t.completeCopy:t.normalCopy,t.replay);}
function drain(){for(const event of state.drain()){
 if(event.type==='sound'){if(event.position!=null)sound.effectAt(event.name,event.position,state.player.x,event.amount??1,event.surface??'concrete');else sound.effect(event.name,event.amount??1,event.surface??'concrete');}
 else if(event.type==='save')persist();
 else if(event.type==='annex-entry'||event.type==='annex-escape')syncPhase();
 else if(event.type==='clear-input')clearInput();
 else if(event.type==='shift'){syncPhase();sound.effect('shift');}
 else if(event.type==='respawn')syncPhase();
 else if(event.type==='shift-rejected'&&event.reason!=='locked')notify(text().shiftRejected,1.2);
 else if(event.type==='death'){clearInput();sound.effect(event.kind==='ghost'?'ghost':event.kind==='fall'?'fallDeath':'death');notify(event.kind==='ghost'?text().ghost:text().death,3);}
 else if(event.type==='checkpoint'){sound.effect('checkpoint');notify(text().lamp,2.5);}
 else if(event.type==='task'){sound.effect(state.floor===0?'valve':'collect');notify(state.floor===2?text().roofTasks[event.index]:text().task[state.floor][event.index],7);}
 else if(event.type==='evidence'){sound.effect('evidence');notify(text().evidence[event.id],8);}
 else if(event.type==='tutorial')notify(text().tutorial,7);
 else if(event.type==='scene-beat'){if(event.id==='phone'){if(event.beat===0)sound.effect('phone');else sound.stopPhone();}else if(['fire-door','lunchbox'].includes(event.id))sound.effect(event.beat===0?'handle':'doorOpen');else if(['reservoir','plants','coolant'].includes(event.id))sound.effect('water');else if(event.beat===0)sound.effect('knock');}
 else if(event.type==='pursuit-warning'){sound.effect('warningBell');notify(state.lang==='zh'?'预警：出口在右侧。留门，不要留在走廊。':'Warning: exit to the right. Leave the door, not yourself in the corridor.',5);}
 else if(event.type==='need-work')notify(state.lang==='zh'?'先完成本区交接，门闩才会放行。':'Complete this section’s work to release its door.',3);
 else if(event.type==='work')sound.effect('checkpoint');
 else if(event.type==='sector'){sound.setFloor(state.floor);syncPhase();notify(state.lang==='zh'?state.sectorData.spec.zh:state.sectorData.spec.en,3);}
 else if(event.type==='route-hint')notify(text().upperRoute,7);
 else if(event.type==='light'){sound.effect('checkpoint');notify(text().light,4);}
 else if(event.type==='need')notify(text().need,3);
 else if(event.type==='floor'){sound.setFloor(state.floor);syncPhase();notify(text().story[state.floor],8);}
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
function pause(){clearInput();if(state.pause()){accumulator=0;persist();showCard();}}
function toggleMute(){sound.mute();state.muted=sound.muted;state.soundFlash=1;labels();}
$('start').onclick=activate;$('sound').onclick=toggleMute;$('settings').ontoggle=()=>{if($('settings').open)pause();};
$('language').onclick=()=>{state.lang=state.lang==='en'?'zh':'en';labels();persist();showCard();};
$('restart').onclick=()=>{
 const next=new Simulation(freshSave());
 try{
  if(storage){restartSave(storage,next.persist());loaded={data:next.progress,warnings:[],readOnly:false};}
 }catch{notify(state.lang==='zh'?'备份或写入失败，未重开。':'Could not back up or write the save. Restart cancelled.',5);return;}
 state=next;
 clearInput();
 sound.setPhase(false);
 labels();
 showCard();
};
$('shift-button').onclick=()=>{if(state.mode==='playing')edges.shift=true;canvas.focus({preventScroll:true});};
function journal(){pause();const t=text();$('journal-title').textContent=t.journal;const list=$('journal-entries');list.replaceChildren();for(const id of state.progress.evidence){const p=document.createElement('p');p.textContent=t.evidence[id]||id;list.append(p);}for(const event of state.progress.events.filter(x=>x==='record-corrected')){const p=document.createElement('p');p.textContent=t.task[1][1];list.append(p);}for(let f=0;f<3;f++)for(let i=0;i<3;i++)if(state.progress.chapterProgress[f]?.[i]){const p=document.createElement('p');p.textContent=`${t.floors[f]} · ${f===2?t.roofTasks[i]:t.task[f][i]}`;list.append(p);}if(!list.childNodes.length)list.textContent=t.noEntries;$('journal-dialog').showModal();}
$('journal').onclick=journal;$('journal-close').onclick=()=>{$('journal-dialog').close();};
function visitSection(floor,sector,annex=false){
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
for(const key of ['master','music','sfx']){const slider=$(`volume-${key}`);slider.value=state.progress.settings[key];slider.oninput=()=>{state.progress.settings[key]=Number(slider.value);sound.setVolumes(state.progress.settings);persist();};}
$('reduced-effects').checked=state.reducedEffects;$('reduced-effects').onchange=e=>{state.reducedEffects=e.target.checked;state.progress.settings.reducedEffects=state.reducedEffects;persist();};
function inputDown(code,repeat=false){
 if(code==='KeyM'&&!repeat)toggleMute();if(code==='KeyJ'&&!repeat){journal();return;}
 if(code==='Escape'&&!repeat){if(state.mode==='paused')activate();else pause();return;}
 if(state.mode!=='playing')return;
 if(state.player.lifeState==='dying'){if(['Space','KeyE'].includes(code)&&state.deaths>1)state.player.lifeTime=Math.max(state.player.lifeTime,.85);return;}
 if(state.scene){if(['KeyE','ArrowDown','Space'].includes(code)&&!repeat)edges.interact=true;return;}
 if(!['alive','hurt'].includes(state.player.lifeState))return;
 keys.add(code);if(!repeat){if(['Space','ArrowUp','KeyW'].includes(code))edges.jump=true;if(['ShiftLeft','ShiftRight','KeyX'].includes(code))edges.shift=true;if(['KeyE','ArrowDown'].includes(code))edges.interact=true;}
}
window.addEventListener('keydown',e=>{if(e.target.closest?.('dialog,input,select,textarea,details'))return;if(document.activeElement!==canvas&&state.mode!=='playing'&&!['Escape','KeyM','KeyJ'].includes(e.code))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();inputDown(e.code,e.repeat);});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(['Space','ArrowUp','KeyW'].includes(e.code))edges.release=true;});
for(const b of document.querySelectorAll('[data-key]')){const up=e=>{e.preventDefault();keys.delete(b.dataset.key);if(b.dataset.key==='Space')edges.release=true;};b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);inputDown(b.dataset.key);});b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);}
window.addEventListener('blur',()=>{pause();sound.setFocus(false);lastTime=null;accumulator=0;});window.addEventListener('focus',()=>sound.setFocus(!document.hidden));document.addEventListener('visibilitychange',()=>{sound.setFocus(!document.hidden);if(document.hidden)pause();lastTime=null;accumulator=0;});
function frame(timestamp){const elapsed=lastTime==null?0:Math.min(.1,(timestamp-lastTime)/1000);lastTime=timestamp;
 if(state.mode==='playing'){accumulator+=elapsed;let ticks=0;while(accumulator>=FIXED_DT&&ticks++<12){const input={left:keys.has('ArrowLeft')||keys.has('KeyA'),right:keys.has('ArrowRight')||keys.has('KeyD'),walk:keys.has('KeyC'),...edges};edges={};state.step(input);drain();accumulator-=FIXED_DT;}}else accumulator=0;
 sound.setChase?.(annexScore(state));
 sound.setNarrative?.({sector:state.sector||0,scene:state.scene?.id||'',pursuit:!!state.pursuit?.active,resolution:state.scene?.id==='ending-complete'||state.mode==='won'&&state.ending==='complete'});sound.setTension(state.pursuit?.active||state.ghosts.some(g=>g.state==='chase')?1:0);art.render(state,elapsed);requestAnimationFrame(frame);
}
labels();showCard();requestAnimationFrame(frame);
window.lastLight={snapshot:()=>({...state.snapshot(),warnings:loaded.warnings.slice(),audio:sound.ctx?{state:sound.ctx.state,muted:sound.muted,focus:sound.focus,phase:sound.night?'night':'day',voices:sound.voices,recentEffects:sound.audit.slice(-15)}:null})};
