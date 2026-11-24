import {CARPET_Y, CHASE_DOOR, CHASE_LAMP, CHASE_OBSTACLES, CHASE_START} from './backrooms.js';
import {drawChaseProp} from './chase-props.js';
import {drawApparition,drawPhaseRipple} from './actor-art.js';

const WALL_DAY=['#e1d194','#b5a265','#8e7b4f','#514f3b'];
const WALL_NIGHT=['#a7b399','#738474','#505f58','#303e41'];
const BRASS=['#f3d294','#c99a5a','#89663f','#4a4237'];
const floorInk='#33372f';
const wings=[['DUPLICATING','复印室'],['DEAD LETTER','退件库'],['AFTER HOURS','夜班出口']];

function roomBay(a,s,x,i,wall){
  const c=a.c,variant=((i%5)+5)%5,t=s.time,night=s.night;
  const wing=Math.min(2,Math.max(0,Math.floor(i/7)));
  a.box(x,28,154,161,wall);
  // A broad lower dado, torn seams and repeating fleur-de-lis wallpaper.
  drawChaseProp(c,'wall',x,187,154,149);
  if(night){a.rect(x,28,153,158,'#152e345f');}
  for(let n=0;n<7;n++){
    const tx=x+11+n*21;
    for(let k=0;k<3;k++){
      const yy=49+(n%2)*7+k*25;
      a.rect(tx-2,yy,4,2,wall[2]);a.rect(tx-4,yy+2,2,3,wall[2]);a.rect(tx+2,yy+2,2,3,wall[2]);
      a.rect(tx-1,yy+4,2,3,wall[2]);
    }
  }
  a.rect(x,143,154,42,wall[2]);a.rect(x,143,154,2,wall[0]);a.rect(x,146,154,3,wall[3]);
  for(let n=0;n<3;n++){const xx=x+7+n*49;a.line(xx,153,39,wall[1]);a.rect(xx,153,2,26,wall[3]);a.line(xx,178,39,wall[1]);}
  if(variant===1||variant===4){
    a.rect(x+31,63,48,122,wall[3]);a.box(x+33,66,44,117,wall);
    drawChaseProp(c,'door',x+31,185,47,122);
    a.box(x+39,83,26,11,BRASS);a.label(variant===1?'017':'017B',x+43,91,BRASS[3],6);
    a.rect(x+62,132,7,2,BRASS[0]);
  }else if(variant===2){
    drawChaseProp(c,'cabinet',x+88,186,41,74);
    a.rect(x+19,75,37,29,wall[3]);a.rect(x+21,77,33,25,'#c1b385');a.line(x+27,84,19,'#777958');
    a.rect(x+28,88,2,6,'#8d5c48');a.line(x+28,93,15,'#8d5c48');
  }else if(variant===3){
    a.rect(x+20,116,33,6,wall[2]);a.rect(x+25,121,25,7,wall[2]);a.rect(x+29,127,4,12,wall[2]);
    drawChaseProp(c,'grille',x+89,76,40,27);
  }
  if(wing===1&&variant===0){
    // Unclaimed mail, thumb-tacked in overlapping rows on the cork board.
    a.box(x+9,68,70,42,BRASS);a.rect(x+12,71,64,36,'#856648');
    for(let n=0;n<6;n++){
      const xx=x+15+n%3*20,yy=76+Math.floor(n/3)*15+(n%2)*2;
      a.rect(xx+1,yy+2,16,10,'#655744');a.rect(xx,yy,16,10,n%2?'#c7bd92':'#d7ca9c');
      a.rect(xx+7,yy,2,2,'#87594d');a.line(xx+3,yy+6,8,'#91896e');
    }
  }else if(wing===2&&variant%2===0){
    drawChaseProp(c,'pipes',x+15,114,58,37);
    a.line(x+26,114,11,wall[2]);a.rect(x+31,115,3,18,wall[2]);
    a.rect(x+33,133,1,7,wall[3]);a.rect(x+17,166,44,11,'#38604f');
    a.label('STAIR  B  >',x+20,174,'#dbdda9',6);
  }
  a.box(x-3,22,9,164,wall);a.line(x+1,58,3,wall[2]);
  const lx=x+87,bright=s.reducedEffects ? .12 : .14+.025*Math.sin(t*5+i);
  a.rect(x+52,17,66,5,wall[3]);drawChaseProp(c,'troffer',x+45,30,79,17);
  a.rect(x+55,24,57,3,night?'#c3d9c1':'#fff1b8');a.glow(lx,41,57,49,night?'#9dc7b5':'#fbe8a6',bright);
  a.rect(x+8,182,145,5,wall[3]);a.line(x+8,182,145,wall[0]);
}

function board(a,x,y,heading,sub,night){
  const ramp=night?['#c0d9c3','#6e9489','#48675f','#283d3e']:BRASS;
  a.box(x,y,65,21,ramp);a.rect(x+2,y+2,60,17,'#35443d');
  a.label(heading,x+5,y+10,ramp[0],6);a.label(sub,x+5,y+17,'#e1dbb6',6);
}

function crossing(a,s,o){
  const x=Math.round(o.x-a.cam),w=o.w,night=s.night;
  if(o.h){
    a.rect(x+2,CARPET_Y-1,w+1,2,'#3b3c31');
    const success=drawChaseProp(a.c,o.kind,x,CARPET_Y,w,o.h+2);
    if(!success)a.box(x,CARPET_Y-o.h,w,o.h,BRASS);
    // Reflective tape remains legible against both color states.
    a.rect(x+2,CARPET_Y-o.h+1,w-4,3,'#d5ad65');
    for(let k=3;k<w-5;k+=8)a.rect(x+k,CARPET_Y-o.h+1,4,3,'#544b39');
    return;
  }
  const phased=Boolean(o.phase);
  board(a,x-78,104,phased?(s.lang==='zh'?'相位桥':'PHASE RELAY'):(s.lang==='zh'?'地面断口':'FLOOR OPEN'),
    phased?(o.phase==='night'?(s.lang==='zh'?'X / 夜':'X / NIGHT'):(s.lang==='zh'?'X / 日':'X / DAY')):(s.lang==='zh'?'空格 跳':'SPACE / JUMP'),night);
  if(phased && o.phase!==(night?'night':'day'))return;
  if(!phased)return;
  const ramp=night?['#badbe1','#77a7ba','#48687c','#2e454d']:BRASS;
  a.box(x,CARPET_Y,w,12,ramp);
  for(let k=4;k<w-5;k+=9)a.rect(x+k,CARPET_Y+3,5,6,ramp[3]);
}

function lamp(a,s,x,door){
  const sx=x-a.cam;
  if(sx < -100 || sx>500)return;
  const zh=s.lang==='zh';
  if(door){
    a.rect(sx-6,64,58,141,'#3b493e');
    const open=Math.max(0,Math.min(1,(s.player.x-(x-60))/56));
    a.rect(sx-1,70,48,133,'#263638');
    a.rect(sx+2,73,43,125,'#304645');a.rect(sx+8,186,31,8,'#637361');
    const doorWidth=Math.max(5,Math.round(52*Math.cos(open*1.43)));
    drawChaseProp(a.c,'door',sx-3,CARPET_Y,doorWidth,134);
    drawChaseProp(a.c,'exit',sx-1,74,50,14);
    const barWidth=Math.max(2,doorWidth-8);
    a.rect(sx+1,128,barWidth,6,'#9dbaa1');a.line(sx+1,128,barWidth,'#e2e8bf');
  }
  board(a,sx-8,door?37:54, door?'FIRE STAIR >':'02 / HALF LANDING',door?(zh?'防火门':'PUSH TO EXIT'):(zh?'应急灯':'RETRY LAMP'),true);
  a.rect(sx+13,78,13,4,'#d9edb5');a.glow(sx+20,83,27,30,'#c7e5ac',.26);
}

export function drawBackrooms(a,s){
  const c=a.c,chase=s.backrooms,p=s.player,zh=s.lang==='zh',night=s.night;
  const wall=night?WALL_NIGHT:WALL_DAY;
  a.rect(0,0,480,270,night?'#35423e':'#7e775b');
  const drift=a.cam*.62;
  for(let i=Math.floor(drift/154)-1;i<=Math.floor((drift+480)/154)+1;i++)roomBay(a,s,Math.round(i*154-drift),i,wall);
  a.rect(0,0,480,12,wall[3]);a.line(0,13,480,wall[0]);
  for(let i=Math.floor(a.cam*.74/96);i<=Math.floor((a.cam*.74+500)/96);i++){
    const x=i*96-a.cam*.74;a.rect(x,1,2,22,wall[2]);a.line(x+5,8,74,wall[1]);
  }
  a.rect(0,187,480,16,night?'#5d6656':'#8d865d');
  a.rect(0,CARPET_Y,480,43,'#242f31');
  for(const surface of s.platforms){
    if(surface.phase||surface.solid)continue;
    const x=Math.max(-1,Math.floor(surface.x-a.cam)),end=Math.min(481,Math.ceil(surface.x+surface.w-a.cam));
    if(end<=x)continue;
    const w=end-x;
    a.rect(x,CARPET_Y,w,42,night?'#59635b':'#81795f');a.line(x,CARPET_Y,w,night?'#a5ac88':'#d7c38b');
    a.rect(x,CARPET_Y+27,w,5,night?'#49554d':'#706954');
    a.line(x,CARPET_Y+32,w,night?'#727c65':'#998d6a');
    for(let k=Math.ceil((x+a.cam)/18)*18;k<end+a.cam-4;k+=18){
      const cx=k-a.cam;
      a.rect(cx,210+(Math.floor(k/18)%3)*3,4,1,night?'#737c68':'#a29573');
      a.rect(cx+1,211+(Math.floor(k/18)%3)*3,2,1,night?'#616d5c':'#91866a');
    }
  }
  for(const o of CHASE_OBSTACLES)if(o.x-a.cam<560&&o.x+o.w-a.cam>-8)crossing(a,s,o);
  lamp(a,s,CHASE_LAMP,false);lamp(a,s,CHASE_DOOR,true);
  const gx=chase.ghostX-a.cam, stride=Math.sin(s.time*15);
  c.save();c.translate(Math.round(gx),CARPET_Y-36);c.scale(1.35,1.56);
  drawApparition(a,{kind:'clerk',state:'chase',facing:1,seed:7},0,-2+stride*1.4);
  // Bent reaching arm and fingers extend from the service clerk's sleeve.
  a.rect(4,-5,9,5,'#28383b');a.rect(11,-6,8,4,'#485954');a.rect(18,-7,6,3,'#929a82');
  a.rect(23,-8,3,1,'#b7b696');a.rect(24,-6,3,1,'#9d9e84');c.restore();
  a.player(p);
  if(!s.reducedEffects&&chase.active&&p.grounded&&Math.abs(p.vx)>70){
    for(let i=0;i<3;i++){const k=(s.time*3.2+i/3)%1;a.rect(p.x-a.cam-10*k,p.y+28-5*Math.sin(k*Math.PI),3-k,1,'#b1a27a');}
  }
  if(!s.reducedEffects&&s.shiftFx>0)drawPhaseRipple(a,s);
  const wing=Math.min(2,Math.floor(p.x/(CHASE_DOOR/3)));
  a.rect(0,0,480,13,'#283b3b');a.label('017 / '+wings[wing][zh?1:0],8,9,'#e0d3a4',7);
  const progress=Math.max(0,Math.min(1,(p.x-CHASE_START)/(CHASE_DOOR-CHASE_START)));
  a.label('HP',243,9,'#c7c9ad',7);
  for(let k=0;k<p.maxHp;k++){const x=256+k*10,col=k<p.hp?'#dca184':'#5c625a';
    a.rect(x,4,2,2,col);a.rect(x+4,4,2,2,col);a.rect(x,6,6,2,col);a.rect(x+2,8,2,1,col);}
  a.rect(343,5,124,3,'#5b685c');a.rect(343,5,124*progress,3,'#dcbb79');
  a.rect(0,246,480,24,'#203236');a.line(0,246,480,'#aa9866');
  a.label(zh?'后室 · 一直向右跑':'THE BACKROOMS / KEEP RUNNING',9,260,'#f1d18e',8);
  a.label(zh?'空格 跳  ·  X 换相':'SPACE jump   X shift',214,260,'#d6dbc1',8);
  a.label(zh?'出口 →':'EXIT →',433,260,'#e1c787',8);
  if(!chase.active&&p.lifeState==='alive'){
    a.rect(21,36,288,46,'#253735f4');a.rect(21,36,3,46,'#ddbc73');
    a.label(zh?'档案附楼 / 失踪楼层':'RECORDS ANNEX / THE MISSING FLOOR',29,50,'#f2dba3',9);
    a.label(zh?'它认得你的脚步。按住 → 或 D，一直跑。':'It knows your footsteps. Hold → or D and keep running.',29,62,'#e5e0c1',7);
    a.label(zh?'跳过推车和断口，按墙牌时间切换昼夜。':'Vault the carts and gaps. Match the clocks on the relay signs.',29,74,'#c3cbaa',7);
  }else if(p.lifeState==='dying'||p.lifeState==='respawning'){
    a.rect(125,75,230,25,'#293b39e8');
    a.label(p.lifeState==='respawning'?(zh?'回到应急灯':'BACK AT THE EMERGENCY LAMP'):(s.death?.kind==='ghost'?(zh?'它追上你了':'IT CAUGHT UP'):(zh?'地板消失了':'THE FLOOR GAVE WAY')),140,91,'#efd6a2',9);
  }
}
