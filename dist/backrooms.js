import {createPlayer, stepPlayer, SPEED} from './core.js';
import {commitShift} from './phase.js';
import {updateLife} from './player-state.js';

// The distance is physical. At the normal top speed (112 px/s), the full run
// takes over 44 seconds even when every obstacle is cleared at speed.
export const CARPET_Y = 204;
export const CHASE_START = 55;
export const CHASE_DOOR = 5040;
export const CHASE_LAMP = 2520;
const ENTERED = 'backrooms-entered', LAMP = 'backrooms-relit', ESCAPED = 'backrooms-escaped';
const REPLAY = 'backrooms-replay';
const entryLamp = 'annex/service-entry', halfwayLamp = 'annex/emergency-circuit';
const layout = [
  [292,'barrier',24,17], [540,'hole',48], [782,'cart',32,27],
  [1020,'night',139], [1230,'hole',54], [1418,'barrier',30,19],
  [1644,'day',144], [1870,'cart',38,26], [2024,'hole',53],
  [2258,'barrier',34,20], [2460,'hole',45],
  [2702,'cart',30,28], [2908,'night',140], [3110,'hole',56],
  [3322,'barrier',32,19], [3484,'cart',32,27], [3708,'day',143],
  [3922,'hole',60], [4080,'barrier',26,20], [4276,'night',132],
  [4484,'cart',36,25], [4642,'hole',56], [4828,'barrier',30,19]
];
export const CHASE_OBSTACLES = layout.map(([x,kind,w,h=0],index)=>({
  id:'annex-'+(index+1), x, kind, w, h,
  phase:kind==='day'||kind==='night'?kind:null
}));
const platforms = [];
let lastEnd = 0;
for (const o of CHASE_OBSTACLES.filter(o=>o.kind==='hole'||o.phase)) {
  platforms.push({id:'carpet-'+o.x,x:lastEnd,y:CARPET_Y,w:o.x-lastEnd,surface:'carpet'});
  if(o.phase)platforms.push({id:o.id,x:o.x,y:CARPET_Y,w:o.w,phase:o.phase,surface:'grate'});
  lastEnd=o.x+o.w;
}
platforms.push({id:'carpet-exit',x:lastEnd,y:CARPET_Y,w:CHASE_DOOR+220-lastEnd,surface:'carpet'});
for(const o of CHASE_OBSTACLES.filter(o=>o.h)){
  platforms.push({id:o.id,x:o.x,y:CARPET_Y-o.h,w:o.w,h:o.h,solid:true,surface:'grate'});
}

export function needsAnnex(world) {
  return world.floor===1 && (!world.expanded || world.sector===2) && !world.events.includes(ESCAPED);
}

export function restoreAnnex(world) {
  const archive=world.floor===1&&(!world.expanded||world.sector===2);
  if(archive && (world.events.includes(REPLAY)||needsAnnex(world)&&world.events.includes(ENTERED)))enterAnnex(world);
}

export function cancelAnnexReplay(world) {
  const index=world.events.indexOf(REPLAY);
  if(index>=0)world.events.splice(index,1);
}

export function replayAnnex(world) {
  if(!world.events.includes(REPLAY))world.events.push(REPLAY);
  enterAnnex(world,true);
}

function armRun(world) {
  const chase=world.backrooms;
  const halfway=world.checkpointId===halfwayLamp;
  chase.active=false;
  chase.elapsed=0;
  chase.ghostX=world.player.x-99;
  chase.danger=0;
  chase.next=CHASE_OBSTACLES.findIndex(o=>o.x+o.w>world.player.x);
  if(chase.next<0)chase.next=CHASE_OBSTACLES.length;
  // Both lamps sit on neutral carpet. The phase after a retry is always day.
  world.camera=Math.max(0,world.player.x-142);
  world.cameraY=0;
  if(!halfway)world.footDistance=0;
}

export function enterAnnex(world,fromEntry=false) {
  const halfway=!fromEntry&&(world.events.includes(REPLAY)?world.progress.checkpointId===halfwayLamp:world.events.includes(LAMP));
  if(!world.events.includes(ENTERED))world.events.push(ENTERED);
  world.backrooms={};
  world.platforms=platforms;world.checkpoints=[
    {id:entryLamp,x:CHASE_START,y:CARPET_Y-28},
    {id:halfwayLamp,x:CHASE_LAMP,y:CARPET_Y-28}
  ];
  const spawn=world.checkpoints[Number(halfway)];
  world.checkpointId=spawn.id;
  world.player=createPlayer(spawn.x);world.player.y=spawn.y;world.player.prevY=spawn.y;
  world.worldWidth=CHASE_DOOR+220;world.worldHeight=270;
  world.walls=[];world.doors=[];world.ghosts=[];world.hazards=[];
  world.pursuit=null;world.particles=[];world.scene=null;world.messageTimer=0;
  world.night=false;world.phaseMix=0;world.shiftFx=0;world.shiftCooldown=0;
  world.transition=0;world.completionTimer=0;world.door={phase:'closed',progress:0};
  world.death=null;world.revive=0;world.footDistance=0;
  armRun(world);
  world.emit('clear-input');world.emit('annex-entry');world.emit('save');
}

function escapeAnnex(world) {
  cancelAnnexReplay(world);
  if(!world.events.includes(ESCAPED))world.events.push(ESCAPED);
  world.backrooms=null;
  if(world.expanded){
    world.loadSector(1,3);world.emit('sector');
  }else{
    world.loadFloor(1);
    world.mode='between';
    if(!world.events.includes('chapter-1-complete'))world.events.push('chapter-1-complete');
    world.emit('between');
  }
  world.emit('clear-input');world.emit('sound',{name:'doorOpen'});world.emit('annex-escape');world.emit('save');
}

export function stepAnnex(world,input,dt) {
  const chase=world.backrooms;
  const status=updateLife(world,dt);
  if(status==='respawn'){
    armRun(world);world.emit('respawn');world.emit('clear-input');
    world.emit('sound',{name:'revive'});world.emit('save');
  }
  if(status==='locked'||status==='respawn')return;
  if(!chase.active){
    if(!input.right||input.left)return;
    chase.active=true;world.emit('annex-run');
  }
  chase.elapsed+=dt;
  if(input.shift){
    const result=commitShift(world);
    world.emit(result.ok?'shift':'shift-rejected',{reason:result.reason});
  }
  const p=world.player;
  const movement=stepPlayer(p,input,platforms,world.night,dt,{width:world.worldWidth});
  if(movement.jump)world.emit('sound',{name:'jump'});
  if(movement.land)world.emit('sound',{name:'land',amount:movement.fall});
  if(p.grounded){
    world.footDistance+=Math.abs(p.x-p.prevX);
    if(world.footDistance>=17){world.footDistance%=17;world.emit('sound',{name:'step',surface:p.surface});}
  }
  // It never teleports to catch a runner. At full stride the player builds a
  // small lead, then the pursuer matches their pace between the office bays.
  const stride=p.x-chase.ghostX>122?SPEED*1.025:SPEED*.91;
  chase.ghostX+=stride*dt;
  chase.danger=Math.max(0,Math.min(1,1-(p.x-chase.ghostX-12)/125));
  while(chase.next<CHASE_OBSTACLES.length&&p.x>CHASE_OBSTACLES[chase.next].x+CHASE_OBSTACLES[chase.next].w)chase.next++;
  world.camera=Math.max(0,Math.min(world.worldWidth-480,p.x-142));
  if(p.y>249)world.beginDeath('fall');
  else if(chase.ghostX+12>=p.x)world.beginDeath('ghost',{xNow:chase.ghostX+9,yNow:p.y+14});
  else if(p.x>=CHASE_DOOR){escapeAnnex(world);return;}
  else if(p.x>=CHASE_LAMP&&world.checkpointId!==halfwayLamp){
    if(!world.events.includes(LAMP))world.events.push(LAMP);
    world.checkpointId=halfwayLamp;
    world.emit('checkpoint',{id:halfwayLamp});world.emit('save');
  }
}

export function annexSnapshot(world) {
  const chase=world.backrooms;
  if(!chase)return null;
  return {...chase,exit:CHASE_DOOR,start:CHASE_START,checkpoint:world.checkpointId,
    nextObstacle:CHASE_OBSTACLES[chase.next]??null};
}

export function annexScore(world) {
  const c=world.backrooms;
  if(!c?.active||world.mode!=='playing'||world.player.lifeState!=='alive')return null;
  const next=CHASE_OBSTACLES[c.next];
  return {progress:Math.max(0,(world.player.x-CHASE_START)/(CHASE_DOOR-CHASE_START)),
    danger:c.danger,elapsed:c.elapsed,obstacle:next&&next.x-world.player.x<112?next.id:null};
}
