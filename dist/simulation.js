import {needsAnnex,restoreAnnex,enterAnnex,stepAnnex,annexSnapshot} from './backrooms.js';
import {level,worldWidth,exitX,createPlayer,stepPlayer,intersects,updateMovingPlatforms} from './core.js';
import {FLOOR_ITEMS,FLOOR_HAZARDS,FLOOR_GHOSTS,CHECKPOINTS,EVIDENCE,inspectionAlcove} from './level-data.js';
import {createGhost,updateGhost} from './enemies.js';
import {clearOfficeGaze} from './mourning-clerk.js';
import {commitShift} from './phase.js';
import {damage,kill,updateLife} from './player-state.js';
import {createDoor,useDoor,updateDoor,doorColliders} from './doors.js';
import {freshSave} from './save.js';
import {buildSector,applyWork} from './world.js';
import {CollisionIndex} from './spatial.js';
import {beginScene,updateScene,sceneText} from './cinema.js';
export const FIXED_DT=1/120;
export class Simulation{
 constructor(progress=freshSave()){
  this.progress=progress;this.expanded=progress.worldRevision===2;this.sector=progress.sector||0;this.floor=progress.floor;this.lang=progress.lang;this.mode='menu';this.time=0;this.deaths=0;this.shifts=0;this.log=[];this.pending=[];
  this.short='';this.shortZh='';this.message='';this.messageTimer=0;this.muted=false;this.soundFlash=0;this.reducedEffects=progress.settings.reducedEffects;this.loadFloor(this.floor,true);if(progress.finished)this.ending=progress.ending||'normal';
  if(progress.resumeMode==='between')this.mode='between';
  else if(progress.finished&&progress.resumeMode!=='revisit')this.mode='won';
 }
 emit(type,data={}){const e={tick:Math.round(this.time/FIXED_DT),type,...data};this.pending.push(e);this.log.push(e);if(this.log.length>100)this.log.shift();}
 drain(){return this.pending.splice(0);}
 loadFloor(floor,restore=false){
  this.backrooms=null;
  if(this.expanded){this.loadSector(floor,restore?this.progress.sector:0,restore);return;}
  this.officeGaze=clearOfficeGaze();
  this.officeGuide=floor===1?{x:102,y:213}:null;
  if(floor!==1)this.mourningGuidePlayed=false;
  this.floor=floor;this.progress.floor=floor;const alcove=inspectionAlcove(floor);
  this.platforms=[...level(floor),...alcove.platforms];this.walls=alcove.walls;this.doors=alcove.doors.map(createDoor);for(const d of this.doors)if(this.progress.openedDoors.includes(d.id)){d.phase='open';d.openness=1;}
  this.items=FLOOR_ITEMS[floor].map((i,k)=>({...i,got:!!this.progress.chapterProgress[floor]?.[k]}));this.hazards=FLOOR_HAZARDS[floor].map(h=>({...h}));this.ghosts=FLOOR_GHOSTS[floor].map(createGhost);
  this.checkpoints=CHECKPOINTS[floor].map(c=>({...c}));this.checkpointId=restore&&this.checkpoints.some(c=>c.id===this.progress.checkpointId)?this.progress.checkpointId:this.checkpoints[0].id;
  const cp=this.checkpoints.find(c=>c.id===this.checkpointId);this.player=createPlayer(cp.x);this.player.y=cp.y;this.player.prevY=cp.y;if(restore)this.player.hp=this.progress.hp;
  this.evidence=EVIDENCE[floor].map(e=>({...e,got:this.progress.evidence.includes(e.id)}));
  this.events=this.progress.events;this.camera=Math.max(0,cp.x-180);this.cameraY=Math.max(-220,Math.min(0,cp.y-145));this.night=false;this.phaseMix=0;this.shiftFx=0;this.shiftRejected=0;this.shiftCooldown=0;this.particles=[];this.death=null;this.revive=0;this.flash=0;this.redFlash=0;this.transition=0;this.exitX=exitX(floor);this.worldWidth=worldWidth(floor);this.door={phase:'closed',progress:0};this.completionTimer=0;this.interaction=null;this.footDistance=0;this.room=`chapter-${floor+1}`;this.noiseTime=0;this.noiseLevel=0;this.lampCooldown=0;
  if(restore)restoreAnnex(this);
 }
 loadSector(floor,sector,restore=false,atExit=false){
  this.backrooms=null;
  this.officeGaze=clearOfficeGaze();
  this.officeGuide=floor===1&&sector===0?{x:102,y:213}:null;
  if(floor!==1)this.mourningGuidePlayed=false;
  this.floor=floor;this.sector=sector;this.progress.floor=floor;this.progress.sector=sector;
  const data=buildSector(floor,sector,this.progress.mechanisms);this.sectorData=data;this.platforms=data.platforms;this.walls=data.walls;this.hazards=data.hazards;this.props=data.props;this.station=data.station;
  this.checkpoints=data.checkpoints;this.checkpointId=restore&&this.checkpoints.some(c=>c.id===this.progress.checkpointId)?this.progress.checkpointId:this.checkpoints[0].id;
  const cp=this.checkpoints.find(c=>c.id===this.checkpointId);this.player=createPlayer(atExit?1740:cp.x);this.player.y=atExit?1550:cp.y;this.player.prevY=this.player.y;if(restore)this.player.hp=this.progress.hp;
  this.doors=data.doors.map(createDoor);for(const d of this.doors)if(this.progress.openedDoors.includes(d.id)){d.phase='open';d.openness=1;}
  this.ghosts=data.ghosts.map(createGhost);this.evidence=data.evidence.map(e=>({...e,got:this.progress.evidence.includes(e.id)}));
  this.items=FLOOR_ITEMS[floor].map((i,k)=>({...i,present:false,got:!!this.progress.chapterProgress[floor]?.[k]}));
  this.events=this.progress.events;this.worldWidth=data.width;this.worldHeight=data.height;this.exitX=data.exit.x;this.exitY=data.exit.y;
  this.camera=Math.max(0,Math.min(data.width-480,this.player.x-180));this.cameraY=Math.max(0,Math.min(data.height-246,this.player.y-130));
  this.room=data.id;this.night=false;this.phaseMix=0;this.shiftFx=0;this.shiftRejected=0;this.shiftCooldown=0;this.particles=[];this.death=null;this.revive=0;this.flash=0;this.redFlash=0;this.transition=0;this.door={phase:'closed',progress:0};this.completionTimer=0;this.interaction=null;this.scene=null;this.footDistance=0;this.noiseTime=0;this.noiseLevel=0;this.lampCooldown=0;this.pursuit=null;
  this.echoes=[{x:1220,y:450,kind:'paper',phase:'day'},{x:715,y:1260,kind:'waiting',phase:'night'}];
  this.collisionIndex=new CollisionIndex(this.platforms);if(!this.progress.visitedSectors.includes(data.id))this.progress.visitedSectors.push(data.id);
  if(restore)restoreAnnex(this);
 }
 finishScene(scene){
  if(scene.purpose==='ending'){this.mode='won';this.progress.finished=true;this.emit('ending',{ending:this.ending});this.emit('save');return;}
  if(scene.purpose==='intro'){this.events.push('arrival-seen');this.emit('save');return;}
  applyWork(this);if(this.floor===1&&this.sector===2&&!this.events.includes('record-corrected'))this.events.push('record-corrected');
  if(this.sector%2===1){const index=Math.floor(this.sector/2);this.items[index].got=true;this.progress.chapterProgress[this.floor][index]=true;this.emit('task',{index});}
  if(this.floor===2&&this.sector===5){this.pursuit={warning:5,active:false,x:this.player.x-235,y:1545};this.emit('pursuit-warning');}
  this.noiseTime=.8;this.noiseLevel=1;this.emit('work',{id:this.station.id});this.emit('save');
 }
 beginTransfer(back=false){this.door={phase:'opening',progress:0,target:back?'back':this.sector<5?'next':'chapter'};this.player.anim='door';this.player.lifeState='entering';this.emit('clear-input');this.emit('sound',{name:'doorOpen'});}
 start(){if(this.mode==='between'){this.loadFloor(this.floor+1);this.emit('floor');}this.mode='playing';if(this.expanded&&this.floor===0&&this.sector===0&&!this.events.includes('arrival-seen'))beginScene(this,'clock','intro');this.emit('save');}
 pause(){if(this.mode==='playing'){this.mode='paused';this.emit('save');return true;}return false;}
 resume(){if(this.mode==='paused')this.mode='playing';}
 persist(){const p=this.progress;p.floor=this.floor;p.lang=this.lang;if(this.expanded)p.sector=this.sector;p.hp=this.player.hp>0?this.player.hp:3;p.chapterProgress[this.floor]=this.items.map(i=>i.got);p.checkpointId=this.checkpointId;p.resumeMode=this.mode==='between'?'between':p.finished&&this.mode!=='won'?'revisit':'menu';p.ending=this.ending||null;return p;}
 beginDeath(kind,ghost=null){
  if(!kill(this,kind,ghost))return;
  const cause=ghost?.kind==='mourner'?(ghost.charging?'eye-contact':'mourning-contact'):undefined;
  this.emit('death',{kind,cause});this.emit('clear-input');this.emit('save');
 }
 interact(){
  if(this.mode!=='playing'||!['alive','hurt'].includes(this.player.lifeState)||this.door.phase!=='closed'||this.interaction)return;
  const p=this.player;
  if(this.officeGuide&&!this.backrooms&&Math.hypot(p.x+7-this.officeGuide.x,p.y+14-this.officeGuide.y)<27){
   this.mourningVoiceAfter=this.time+3.7;
   this.emit('mourning-guide',{manual:true});
   return;
  }
  if(this.expanded&&this.sector>0&&p.x<30&&p.grounded&&Math.abs(p.y-200)<12){this.beginTransfer(true);return;}
  if(this.expanded&&this.station&&!this.station.done&&Math.hypot(p.x+7-this.station.x,p.y+14-this.station.y)<35){beginScene(this,this.station.scene);return;}
  const lamp=this.checkpoints.find(c=>p.grounded&&Math.hypot(p.x-c.x,p.y-c.y)<28);
  if(lamp&&p.hp<p.maxHp&&this.lampCooldown<=0){p.hp=p.maxHp;this.lampCooldown=.5;this.emit('checkpoint',{id:lamp.id});this.emit('save');return;}
  const door=this.doors.find(d=>Math.abs(p.x-d.x)<40&&Math.abs(p.y-d.y)<65);
  if(door&&useDoor(door)){this.emit('sound',{name:'handle'});if(!this.progress.openedDoors.includes(door.id))this.progress.openedDoors.push(door.id);this.emit('save');return;}
  const evidence=this.evidence.find(e=>!e.got&&intersects(p,e.x,e.y,20));
  if(evidence){evidence.got=true;this.progress.evidence.push(evidence.id);this.emit('evidence',{id:evidence.id});this.emit('save');return;}
  const item=this.items.find(i=>i.present!==false&&!i.got&&intersects(p,i.x,i.y,18));
  if(item){this.interaction={item,index:this.items.indexOf(item),time:0};p.anim='interact';p.lifeState='interacting';p.vx=0;this.emit('clear-input');return;}
  if(this.floor===2&&Math.abs(p.x-(this.exitX-100))<38&&(!this.expanded||this.sector===5&&Math.abs(p.y-this.exitY)<36)){if(!this.events.includes('emergency-light')){this.events.push('emergency-light');this.emit('light');this.emit('save');}return;}
  if(this.expanded){if(p.x>this.exitX-30&&p.grounded&&Math.abs(p.y-this.exitY)<12){if(this.station.done)this.beginTransfer();else this.emit('need-work');}return;}
  if(p.x>this.exitX-40&&p.grounded){if(this.items.every(i=>i.got)){this.door.phase='opening';this.door.progress=0;p.anim='door';p.lifeState='entering';this.emit('clear-input');this.emit('sound',{name:'doorOpen'});}else this.emit('need');}
 }
 step(input={},dt=FIXED_DT){
  if(this.mode!=='playing')return;
  this.time+=dt;for(const key of ['flash','redFlash','soundFlash','messageTimer','shiftFx','shiftRejected','shiftCooldown','revive','noiseTime','lampCooldown'])this[key]=Math.max(0,this[key]-dt*(key==='redFlash'?3:key==='flash'?4:1));
  this.phaseMix+=(Number(this.night)-this.phaseMix)*Math.min(1,dt*20);
  if(this.backrooms){stepAnnex(this,input,dt);return;}
  if(this.scene){const scene=this.scene;if(updateScene(this,input,dt))this.finishScene(scene);return;}
  if(this.completionTimer>0){this.completionTimer-=dt;this.transition=1-this.completionTimer/.65;if(this.completionTimer<=0){this.transition=0;if(needsAnnex(this)&&(!this.expanded||this.door.target==='next')){enterAnnex(this);return;}if(this.expanded&&['next','back'].includes(this.door.target)){const back=this.door.target==='back';this.loadSector(this.floor,this.sector+(back?-1:1),false,back);this.emit('sector');this.emit('save');return;}
   if(this.expanded&&this.floor===2){this.ending=this.progress.evidence.length===6&&this.events.includes('record-corrected')&&this.events.includes('emergency-light')?'complete':'normal';beginScene(this,`ending-${this.ending}`,'ending');return;}
   if(this.floor===2){this.mode='won';this.ending=this.progress.evidence.length===6&&this.events.includes('record-corrected')&&this.events.includes('emergency-light')?'complete':'normal';this.progress.finished=true;this.emit('ending',{ending:this.ending});}else{this.mode='between';if(!this.events.includes(`chapter-${this.floor}-complete`))this.events.push(`chapter-${this.floor}-complete`);this.emit('between');}this.emit('save');}return;}
  if(this.door.phase!=='closed'){this.updateLift(dt);return;}
  if(this.interaction){this.interaction.time+=dt;if(this.interaction.time>=.55){const {item,index}=this.interaction;item.got=true;this.player.anim='idle';this.player.lifeState='alive';this.interaction=null;const eventId=`task-${this.floor}-${index}`;if(!this.events.includes(eventId))this.events.push(eventId);if(this.floor===1&&index===1&&!this.events.includes('record-corrected'))this.events.push('record-corrected');this.noiseTime=.8;this.noiseLevel=1;this.emit('task',{index});this.emit('save');}return;}
  const life=updateLife(this,dt);if(life==='respawn'){this.emit('respawn');this.emit('clear-input');this.emit('sound',{name:'revive'});this.emit('save');}if(life==='locked'||life==='respawn')return;
  if(this.floor===1&&!this.mourningGuidePlayed){
   this.mourningGuidePlayed=true;
   this.mourningVoiceAfter=this.time+3.7;
   this.emit('mourning-guide');
  }
  if(input.shift){const result=commitShift(this);this.emit(result.ok?'shift':'shift-rejected',{reason:result.reason});}
  if(input.interact){this.interact();if(this.interaction||this.scene||this.door.phase!=='closed')return;}
  for(const d of this.doors)updateDoor(d,this.player,dt);
  updateMovingPlatforms(this.platforms,this.time,dt);
  const p=this.player,near=this.collisionIndex?this.collisionIndex.query(p.x-40,p.y-20,p.x+60,p.y+65):this.platforms;
  const solids=[...this.walls,...doorColliders(this.doors)];
  p.eyesDown=this.floor===1&&Boolean(input.walk);
  const out=stepPlayer(p,input,near,this.night,dt,{width:this.worldWidth,solids});
  if(out.jump)this.emit('sound',{name:'jump'});if(out.land)this.emit('sound',{name:'land',amount:out.fall});
  if(p.grounded&&Math.abs(p.vx)>12){this.footDistance+=Math.abs(p.vx)*dt;if(this.footDistance>17){this.footDistance=0;this.emit('sound',{name:'step',surface:p.surface});}}
  this.updateCheckpoint();
  if(p.x>500&&!this.events.includes('tutorial')){this.events.push('tutorial');this.emit('tutorial');}
  if(p.y>(this.expanded?this.worldHeight+90:330))this.beginDeath('fall');
  for(const h of this.hazards){const phase=h.day?!this.night:this.night,cycle=(this.time+(h.offset||0))%(h.period||1),enabled=!h.disabled&&phase&&(!h.period||cycle>h.warning&&cycle<h.warning+1.4);if(enabled&&p.x+12>h.x&&p.x<h.x+h.w&&p.y+28>(h.y??210)&&p.y<(h.y??210)+(h.h??18)){if(damage(this,h.x+h.w/2)){this.redFlash=.5;this.emit('sound',{name:'hurt'});if(p.lifeState==='dying'){this.emit('death',{kind:'hazard'});this.emit('clear-input');}this.emit('save');}}}
  const noise=Math.max(Math.abs(p.vx)>75?.7:0,out.land?1:0,this.noiseTime>0?this.noiseLevel:0);
  this.gazeBlockers=solids;
  this.officeGaze=clearOfficeGaze();
  this.officeGaze.eyesDown=p.eyesDown;
  for(const g of this.ghosts){
   const before=g.state, hit=updateGhost(g,this,dt,noise);
   if(g.kind==='mourner'){
    if(g.gaze>this.officeGaze.amount)Object.assign(this.officeGaze,{amount:g.gaze,looking:g.looking,charging:g.charging,ghostId:g.id});
    if(hit&&['alive','hurt'].includes(p.lifeState)){
     this.emit('sound',{name:'mourning-strike',position:g.xNow});
     this.beginDeath('ghost',g);
    }
   }else{
    if(hit)this.beginDeath('ghost',g);
    else if(g.state!==before && ['alert','chase','search'].includes(g.state)){
     const name={alert:'ghostAlert',chase:'ghostPursuit',search:'ghostSearch'}[g.state];
     this.emit('sound',{name,position:g.xNow,surface:g.kind});
    } else if((g.state==='patrol'||g.state==='return') && Math.abs(p.x+7-g.xNow)<142 && Math.abs(p.y+14-g.yNow)<62 && this.time>=(g.nextRustle??0)){
     this.emit('sound',{name:'ghostPass',position:g.xNow,surface:g.kind});
     g.nextRustle=this.time+2.1+g.seed%1.2;
    }
   }
  }
  if(this.expanded&&this.pursuit){const chase=this.pursuit;chase.warning=Math.max(0,chase.warning-dt);if(!chase.warning){chase.active=true;chase.x+=92*dt;if(Math.abs(p.x+7-chase.x)<15&&Math.abs(p.y+14-chase.y)<23)this.beginDeath('ghost',{xNow:chase.x,yNow:chase.y});}}
  if(!this.expanded)this.room=this.floor===1&&p.x>3480&&p.x<4135?(p.y<165?'archive-mezzanine':'fire-corridor'):`chapter-${this.floor+1}`;
  if(!this.expanded&&this.floor===1&&p.x>3500&&!this.events.includes('office-upper-route')){this.events.push('office-upper-route');this.emit('route-hint');this.emit('save');}
  const tx=Math.max(0,Math.min(this.worldWidth-480,p.x-180+p.dir*15));this.camera+=(tx-this.camera)*Math.min(1,dt*6);
  const ty=this.expanded?Math.max(0,Math.min(this.worldHeight-246,p.y-130)):Math.max(-220,Math.min(0,p.y-145));this.cameraY+=(ty-this.cameraY)*Math.min(1,dt*4);
  for(const q of this.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;}this.particles=this.particles.filter(q=>q.life>0);
 }
 updateCheckpoint(){
  const p=this.player;
  if(!p.grounded)return;
  let nearest=null,bestDistance=21*21;
  for(const lamp of this.checkpoints){
   const distance=(p.x-lamp.x)**2+(p.y-lamp.y)**2;
   if(distance>=21*21)continue;
   // Some arrival and corridor lamps overlap. Keep an active lamp until we leave its range.
   if(lamp.id===this.checkpointId)return;
   if(distance<bestDistance){nearest=lamp;bestDistance=distance;}
  }
  if(!nearest)return;
  this.checkpointId=nearest.id;p.checkpoint=nearest.x;p.hp=p.maxHp;
  this.emit('checkpoint',{id:nearest.id});this.emit('save');
 }
 updateLift(dt){const d=this.door;d.progress+=dt;if(d.phase==='opening'&&d.progress>=.4){d.phase='entering';d.progress=0;}else if(d.phase==='entering'){this.player.x+=((this.door.target==='back'?8:this.exitX)+7-this.player.x)*Math.min(1,dt*7);if(d.progress>=.45){d.phase='closing';d.progress=0;this.emit('sound',{name:'door'});}}else if(d.phase==='closing'&&d.progress>=.4){d.phase='done';this.completionTimer=.65;}}
 snapshot(){return {time:this.time,officeGaze:this.backrooms?clearOfficeGaze():{...this.officeGaze},backrooms:annexSnapshot(this),worldRevision:this.expanded?2:1,sector:this.sector,world:{width:this.worldWidth,height:this.worldHeight||270},station:this.station?{...this.station}:null,mechanisms:this.progress.mechanisms?.slice(),scene:this.scene?{...this.scene,text:sceneText(this)}:null,pursuit:this.pursuit?{...this.pursuit}:null,floor:this.floor,phase:this.night?'night':'day',mode:this.mode,player:{...this.player},items:this.items.map(i=>({...i})),ghosts:this.ghosts.map(g=>({id:g.id,kind:g.kind,state:g.state,x:g.xNow,y:g.yNow,phase:g.phase,spawned:g.spawned,facing:g.facing,stateTime:g.stateTime,pathIndex:g.pathIndex,cooldown:g.cooldown,gaze:g.gaze||0,lockTime:g.lockTime||0,looking:!!g.looking,charging:!!g.charging,target:g.target?{...g.target}:null,collisionShape:{...g.collisionShape}})),doors:this.doors.map(d=>({...d})),lift:{...this.door},camera:{x:this.camera,y:this.cameraY},checkpoint:this.checkpointId,room:this.room,evidence:this.progress.evidence.slice(),events:this.events.slice(),deaths:this.deaths,shifts:this.shifts,death:this.death?{...this.death}:null,ending:this.ending,log:this.log.slice(-20)};}
}
