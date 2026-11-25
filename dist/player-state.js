import {createPlayer} from './core.js';
import {clearOfficeGaze,resetMourningGaze,MOURNING_CAPTURE} from './mourning-clerk.js';
import {difficultyRules} from './player-settings.js';
export function kill(world,kind,ghost=null){
 const p=world.player;if(!['alive','hurt'].includes(p.lifeState))return false;
 p.hp=0;p.lifeState='dying';p.lifeTime=0;p.vx=0;p.vy=0;p.buffer=0;p.coyote=0;
 p.anim=kind==='ghost'?'ghostDeath':kind==='fall'?'fallDeath':'death';p.deathTime=0;
 world.death={kind,time:0,x:p.x,y:p.y,ghost:ghost?{x:ghost.xNow,y:ghost.yNow,kind:ghost.kind,id:ghost.id}:null};
 if(ghost?.kind==='mourner')world.death.duration=MOURNING_CAPTURE.duration;
 world.deaths++;
 return true;
}
export function damage(world,sourceX){
 const p=world.player;if(!['alive','hurt'].includes(p.lifeState)||p.invulnerable>0)return false;
 p.hp=Math.max(0,p.hp-1);p.invulnerable=.8*difficultyRules(world.difficulty).hazardRecovery;p.lifeState='hurt';p.lifeTime=0;p.anim='hurt';p.animTime=.22;
 p.vx=p.x<sourceX?-115:115;p.vy=-100;p.grounded=false;
 if(p.hp===0)kill(world,'hazard');return true;
}
export function beginRespawn(world){
 const cp=world.checkpoints.find(c=>c.id===world.checkpointId)||world.checkpoints[0];
 const captured=world.death?.ghost?.kind==='mourner';
 const duration=captured?MOURNING_CAPTURE.revival:.65;
 const p=createPlayer(cp.x);p.y=cp.y;p.prevY=cp.y;p.checkpoint=cp.x;p.lifeState='respawning';p.lifeTime=0;p.anim='revive';p.animTime=duration;p.invulnerable=.8;
 if(captured)p.mourningRevival=true;
 world.player=p;world.camera=Math.max(0,Math.min(world.worldWidth-480,cp.x-180));world.cameraY=world.expanded?Math.max(0,Math.min(world.worldHeight-246,cp.y-130)):Math.max(-220,Math.min(0,cp.y-145));world.death=null;world.night=false;world.phaseMix=0;world.shiftFx=0;world.shiftCooldown=0;world.noiseTime=0;world.particles=[];world.revive=duration;
 world.door={phase:'closed',progress:0};world.scene=null;if(world.pursuit)world.pursuit={warning:5,active:false,x:cp.x-235,y:1545};
 world.officeGaze=clearOfficeGaze();
 for(const g of world.ghosts){g.xNow=g.home.x;g.yNow=g.home.y;g.prevX=g.xNow;g.prevY=g.yNow;g.state='dormant';g.stateTime=0;g.target=null;g.cooldown=1;
  if(g.kind==='mourner'){resetMourningGaze(g);g.cryCooldown=0;}
 }
 return cp;
}
export function updateLife(world,dt){
 const p=world.player;p.lifeTime=(p.lifeTime||0)+dt;
 if(p.lifeState==='dying'){
  const death=world.death;
  if(death.ghost?.kind==='mourner'){
   const crossed=beat=>death.time<beat&&p.lifeTime>=beat;
   if(crossed(MOURNING_CAPTURE.recoil))world.emit('sound',{name:'mourning-release',position:death.ghost.x});
   if(crossed(MOURNING_CAPTURE.impact))world.emit('sound',{name:'mourning-impact',position:death.x});
  }
  p.deathTime=p.lifeTime;death.time=p.lifeTime;
  if(p.lifeTime>=(death.duration??.9)){beginRespawn(world);return 'respawn';}
  return 'locked';
 }
 if(p.lifeState==='respawning'){
  const duration=p.mourningRevival?MOURNING_CAPTURE.revival:.65;
  p.animTime=Math.max(0,duration-p.lifeTime);world.revive=p.animTime;
  if(p.lifeTime>=duration){p.lifeState='alive';p.anim='idle';p.lifeTime=0;delete p.mourningRevival;return 'alive';}
  return 'locked';
 }
 if(p.lifeState==='hurt'&&p.lifeTime>=.22){p.lifeState='alive';p.anim='idle';}
 return 'active';
}
