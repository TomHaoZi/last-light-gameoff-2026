import {createPlayer, stepPlayer} from './core.js';
import {commitShift} from './phase.js';
import {updateLife} from './player-state.js';

// Movement uses the normal fixed-step physics. The new track still takes
// about forty-five seconds to clear even at the faster chase pace.
export const CARPET_Y = 204;
export const CHASE_SPEED = 140;
export const CHASE_START = 55;
export const CHASE_DOOR = 6355;
export const CHASE_LAMP = 3205;
const ENTERED = 'backrooms-entered', LAMP = 'backrooms-relit', ESCAPED = 'backrooms-escaped';
const REPLAY = 'backrooms-replay';
const entryLamp = 'annex/service-entry', halfwayLamp = 'annex/emergency-circuit';

export const ANNEX_WINGS = [
  { start: 0, en: 'INTAKE OFFICES', zh: '档案收件处', name: 'intake' },
  { start: 1540, en: 'PUMP GALLERY', zh: '泵房长廊', name: 'pump' },
  { start: 2480, en: 'HIGH STACKS', zh: '高架档案库', name: 'stacks' },
  { start: 4300, en: 'MAIL SORTING', zh: '邮件分拣区', name: 'mail' },
  { start: 5540, en: 'FIRE STAIR', zh: '消防楼梯间', name: 'stair' }
];

export const annexWingAt = x => ANNEX_WINGS.findLast(wing => wing.start <= x) ?? ANNEX_WINGS[0];

// x, obstacle, width, object height, change in landing elevation
const layout = [
  [228, 'barrier', 29, 17], [355, 'cart', 36, 24], [492, 'hole', 52],
  [650, 'rise', 60, 0, -22], [819, 'night', 141], [1034, 'rack', 41, 29],
  [1162, 'hole', 58], [1317, 'day', 144],
  [1552, 'drop', 61, 0, 24], [1703, 'barrier', 24, 20], [1830, 'cart', 36, 25],
  [1970, 'hole', 59], [2140, 'night', 148], [2360, 'cart', 34, 25],
  [2503, 'rise', 59, 0, -25], [2668, 'rack', 42, 30], [2812, 'day', 142],
  [3052, 'hole', 57], [3331, 'night', 142], [3551, 'drop', 59, 0, 19],
  [3700, 'cart', 36, 26], [3830, 'rack', 38, 30], [3964, 'hole', 60],
  [4110, 'day', 143], [4342, 'barrier', 35, 22], [4468, 'hole', 55],
  [4604, 'rise', 58, 0, -22], [4760, 'night', 139], [4974, 'rack', 42, 29],
  [5100, 'cart', 30, 26], [5227, 'hole', 56], [5370, 'day', 142],
  [5562, 'drop', 58, 0, 26], [5712, 'cart', 36, 25], [5840, 'hole', 53],
  [5975, 'barrier', 32, 19], [6107, 'night', 133]
];

const platforms = [];
let lastEnd = 0;
let floorHeight = CARPET_Y;
export const CHASE_OBSTACLES = layout.map(([x,kind,w,h=0,elevation=0],index)=>{
  const id = 'annex-'+(index+1);
  const phase = kind === 'day' || kind === 'night' ? kind : null;
  const y = floorHeight;
  const landingY = y + elevation;
  if (h) {
    platforms.push({id,x,y:y-h,w,h,solid:true,surface:'grate'});
  } else {
    platforms.push({id:'annex-floor-'+x,x:lastEnd,y,w:x-lastEnd,surface:'carpet'});
    if (phase) platforms.push({id,x,y,w,phase,surface:'grate'});
    floorHeight = landingY;
    lastEnd = x + w;
  }
  return {id,x,kind,w,h,y,landingY,phase,launch: h ? 42 : 25,
    obstacleType:phase ? 'bridge' : !h ? 'gap' : kind === 'rack' ? 'rack' : 'hurdle'};
});
platforms.push({id:'annex-floor-exit',x:lastEnd,y:floorHeight,w:CHASE_DOOR+220-lastEnd,surface:'carpet'});

export function annexFloorAt(x) {
  let y = CARPET_Y;
  for (const obstacle of CHASE_OBSTACLES) {
    if (x < obstacle.x + obstacle.w) break;
    y = obstacle.landingY;
  }
  return y;
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
  chase.ghostY=annexFloorAt(world.player.x);
  chase.danger=0;
  chase.latched=false;
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
    {id:halfwayLamp,x:CHASE_LAMP,y:annexFloorAt(CHASE_LAMP)-28}
  ];
  const spawn=world.checkpoints[Number(halfway)];
  world.checkpointId=spawn.id;
  world.player=createPlayer(spawn.x);world.player.y=spawn.y;world.player.prevY=spawn.y;world.player.fallStart=spawn.y;
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
  const movement=stepPlayer(p,input,platforms,world.night,dt,{width:world.worldWidth,speed:CHASE_SPEED});
  if(movement.jump)world.emit('sound',{name:'jump'});
  if(movement.land)world.emit('sound',{name:'land',amount:movement.fall});
  if(p.grounded){
    world.footDistance+=Math.abs(p.x-p.prevX);
    if(world.footDistance>=17){world.footDistance%=17;world.emit('sound',{name:'step',surface:p.surface});}
  }
  // It never teleports to catch a runner. At full stride the player builds a
  // small lead, then the pursuer matches their pace between the office bays.
  const stride=CHASE_SPEED*(p.x-chase.ghostX>114?1.025:.93);
  chase.ghostX+=stride*dt;
  chase.ghostY+=(annexFloorAt(chase.ghostX)-chase.ghostY)*Math.min(1,dt*9);
  chase.danger=Math.max(0,Math.min(1,1-(p.x-chase.ghostX-12)/125));
  while(chase.next<CHASE_OBSTACLES.length&&p.x>CHASE_OBSTACLES[chase.next].x+CHASE_OBSTACLES[chase.next].w)chase.next++;
  world.camera=Math.max(0,Math.min(world.worldWidth-480,p.x-142));
  if(p.y>249)world.beginDeath('fall');
  else if(chase.ghostX+12>=p.x)world.beginDeath('ghost',{xNow:chase.ghostX+9,yNow:p.y+14});
  else if(p.x>=CHASE_DOOR){escapeAnnex(world);return;}
  else if(p.x>=CHASE_DOOR-60&&!chase.latched){
    chase.latched=true;
    world.emit('sound',{name:'handle'});
  }
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
  const imminent=next&&next.x-world.player.x<CHASE_SPEED ? next : null;
  return {progress:Math.max(0,(world.player.x-CHASE_START)/(CHASE_DOOR-CHASE_START)),
    danger:c.danger,elapsed:c.elapsed,obstacle:imminent?.id??null,obstacleType:imminent?.obstacleType??null};
}
