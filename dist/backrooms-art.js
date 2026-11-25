import { ANNEX_WINGS, CHASE_DOOR, CHASE_LAMP, CHASE_OBSTACLES, CHASE_START, annexFloorAt, annexWingAt } from './backrooms.js';
import {drawChaseProp} from './chase-props.js';
import {drawApparition,drawPhaseRipple} from './actor-art.js';

const WALL_DAY=['#e1d194','#b5a265','#8e7b4f','#514f3b'];
const WALL_NIGHT=['#a7b399','#738474','#505f58','#303e41'];
const BRASS=['#f3d294','#c99a5a','#89663f','#4a4237'];
const STEEL=['#b1b8a4','#6f817a','#465b5d','#2b3b41'];
const BRICK=['#b58365','#825344','#583c37','#3e3034'];
const WALLS={
  intake:[WALL_DAY,WALL_NIGHT],
  pump:[['#a5b387','#788b76','#5b746c','#3b5855'],['#809790','#4b7071','#38595d','#273f48']],
  stacks:[['#a2a58b','#7a8173','#5b665e','#3b4b47'],['#828f9e','#576879','#3e5162','#2d3649']],
  mail:[['#c8bd8b','#938c67','#6e745e','#485247'],['#9eaaa4','#607779','#455f61','#314648']],
  stair:[['#bf9673','#946852','#6c4e46','#483a3b'],['#a7847d','#775659','#4c424e','#383442']]
};
const BAY_WIDTH={intake:156,pump:204,stacks:176,mail:196,stair:188};

function segment(a,points,color){
  a.c.fillStyle=color;
  a.c.beginPath();
  a.c.moveTo(points[0][0],points[0][1]);
  for (let i=1;i<points.length;i++) a.c.lineTo(points[i][0],points[i][1]);
  a.c.closePath();
  a.c.fill();
}
function tubeLamp(a,s,x,y,color,breath){
  a.rect(x-23,y-2,48,4,'#334544');
  drawChaseProp(a.c,'troffer',x-29,y+8,58,12,s.night);
  a.rect(x-19,y+1,39,3,color);
  const gain=s.reducedEffects ? .07 : breath;
  a.glow(x,y+13,46,22,color,gain);
  a.glow(x,y+52,74,65,color,gain*.46);
}


function roomBay(a,s,x,i,wall){
  const c=a.c,variant=((i%5)+5)%5,t=s.time,night=s.night;
  const wing=i%3;
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
    drawChaseProp(c,'door',x+31,185,47,122,night);
    a.box(x+39,83,26,11,BRASS);a.label(variant===1?'017':'017B',x+43,91,BRASS[3],6);
    a.rect(x+62,132,7,2,BRASS[0]);
  }else if(variant===2){
    drawChaseProp(c,'cabinet',x+88,186,41,74,night);
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
  tubeLamp(a,s,x+86,23,night?'#d4e4bc':'#f6e4a5',.20+.03*Math.sin(t*5+i));
  a.rect(x+8,182,145,5,wall[3]);a.line(x+8,182,145,wall[0]);
}

function pumpBay(a,s,x,i,wall){
  const water=s.night?'#80b6b8':'#acb89b';
  const center=x+105;
  a.box(x,24,204,179,wall);
  a.rect(x+14,63,172,111,wall[3]);
  a.rect(x+20,69,160,101,'#3c5859');
  for(let row=0;row<4;row++)for(let j=0;j<8;j++){
    const at=x+21+j*20+(row%2)*5,y=71+row*25;
    a.rect(at,y,17,23,wall[2]);
    a.line(at,y,17,wall[1]);
  }
  a.pipe(x+18,106,165,13,false,STEEL);
  a.pipe(x+45,36,11,147,true,STEEL);
  a.pipe(x+152,70,17,119,true,STEEL);
  a.valve(x+50,102,10);
  a.box(x+81,145,64,44,STEEL);
  a.fan(x+103,164,13);
  drawChaseProp(a.c,'steamtrap',x+132,197,52,41,s.night);
  a.rect(x+7,183,187,15,'#415650');
  for(let k=0;k<5;k++){
    const lane=x+31+k*33;
    a.rect(lane,189,23,2,water);
    if(!s.reducedEffects){
      const t=(s.time*.44+k*.39+i)%1;
      if(t<.7){a.rect(lane+12,121+t*91,1,4,water);a.glow(lane+12,189,15*t+2,4,water,.12*(1-t));}
    }
  }
  tubeLamp(a,s,center,34,s.night?'#9ddcea':'#f3dd9d',.25+.02*Math.sin(s.time*5+i));
  a.box(x,24,10,173,STEEL);
}
function stacksBay(a,s,x,i,wall){
  const floor=162+(i%3)*8;
  a.rect(x,24,176,174,wall[3]);
  a.box(x+12,39,152,152,wall);
  a.rect(x+22,49,131,141,'#35474b');
  a.box(x+25,55,119,129,STEEL);
  drawChaseProp(a.c,'rack',x+28,181,111,122,s.night);
  for(let tier=0;tier<4;tier++){
    const at=56+tier*34;
    a.rect(x+22,at+19,122,2,wall[3]);
    a.line(x+22,at+19,120,wall[0]);
    a.rect(x+142,at+7,8,9,BRASS[0]);
    a.label(String(i*4+tier+11),x+143,at+13,BRASS[3],4);
  }
  a.rect(x+12,floor,150,4,wall[3]);
  a.line(x+11,floor,151,wall[0]);
  a.box(x+3,38,11,158,STEEL);
  a.box(x+162,36,12,161,STEEL);
  const tube=i%2? '#d9c29b': '#c7dcd5';
  tubeLamp(a,s,x+87,27,tube,.25+.035*Math.sin(s.time*3+i*3));
}
function mailBay(a,s,x,i,wall){
  a.box(x,21,196,178,wall);
  a.box(x+12,42,171,121,wall);
  a.rect(x+22,51,148,103,wall[3]);
  for(let j=0;j<3;j++){
    const at=x+27+j*44;
    drawChaseProp(a.c,'ticketcase',at,148,39,94,s.night);
    a.rect(at+8,59,22,2,wall[0]);
  }
  a.pipe(x+8,33,176,5,false,STEEL);
  a.box(x+17,151,166,11,STEEL);
  for(let j=0;j<6;j++){
    const shift=s.reducedEffects?0:(s.time*12+i*5)%26;
    const at=x+23+j*25+shift;
    const w=Math.min(10,x+176-at);
    if(w>0){a.rect(at,150,w,2,wall[0]);a.rect(at,155,w,5,wall[3]);}
  }
  for(const at of [x+29,x+145])a.box(at,161,13,24,STEEL);
  const lamp=s.night?'#b0dbda':'#e8cb8b';
  tubeLamp(a,s,x+99,28,lamp,.23);
}
function stairBay(a,s,x,i,wall){
  a.box(x,17,188,187,wall);
  for(let row=0;row<8;row++){
    const y=38+row*20;
    a.line(x,y,188,wall[2]);
    for(let j=0;j<4;j++) a.rect(x+12+row%2*18+j*44,y,1,20,wall[2]);
  }
  a.box(x+29,51,130,135,BRICK);
  a.rect(x+35,58,117,123,wall[3]);
  // The silhouettes sit behind the runner's collision-free passage.
  const bars=s.night?'#9d858a':'#c29e80';
  for(let step=0;step<9;step++){
    const y=174-step*10, at=x+47+step*10;
    a.rect(at,y,30,5,'#53444a');
    a.line(at,y,30,bars);
    a.rect(at+4,y-28,2,28,bars);
    a.line(at,y-28,17,bars);
  }
  a.box(x,19,10,186,STEEL);
  a.rect(x+85,31,24,7,'#52363b');
  a.rect(x+88,32,18,3,'#f0ad81');
  a.glow(x+96,47,50,48,'#f09871',s.reducedEffects ? .14 : .34+.05*Math.sin(s.time*5+i));
}

const backgroundBays={intake:roomBay,pump:pumpBay,stacks:stacksBay,mail:mailBay,stair:stairBay};

function backdrop(a,s){
  for(const [index,wing] of ANNEX_WINGS.entries()){
    const left=wing.start-a.cam;
    const right=(ANNEX_WINGS[index+1]?.start??(CHASE_DOOR+480))-a.cam;
    if(right<0||left>480)continue;
    const c=a.c,width=BAY_WIDTH[wing.name],wall=WALLS[wing.name][+s.night];
    c.save();
    c.beginPath();
    c.rect(left,13,right-left,250);
    c.clip();
    a.rect(left,13,right-left,246,wall[3]);
    const parallax=left*.88;
    for(let i=Math.floor(-parallax/width)-1;i<=(480-parallax)/width+1;i++){
      backgroundBays[wing.name](a,s,Math.round(parallax+i*width),i,wall);
    }
    c.restore();
    if(index&&left>-28&&left<493){
      a.box(left-7,14,15,228,STEEL);
      a.line(left-6,53,18,STEEL[0]);
      a.box(left-22,37,46,16,BRASS);
      a.label(s.lang==='zh'?wing.zh:wing.en.split(' ')[0],left-19,47,'#423d30',6);
      a.rect(left-7,67,14,2,'#b8c6a3');
    }
  }
}

function board(a,x,y,heading,sub,night){
  const ramp=night?['#c0d9c3','#6e9489','#48675f','#283d3e']:BRASS;
  a.box(x,y,65,21,ramp);a.rect(x+2,y+2,60,17,'#35443d');
  a.label(heading,x+5,y+10,ramp[0],6);a.label(sub,x+5,y+17,'#e1dbb6',6);
}

function crossing(a,s,o){
  const x=Math.round(o.x-a.cam),w=o.w,night=s.night;
  if(o.h){
    a.rect(x+2,o.y-1,w+1,2,'#3b3c31');
    const success=drawChaseProp(a.c,o.kind,x,o.y,w,o.h+2,night);
    if(!success)a.box(x,o.y-o.h,w,o.h,BRASS);
    // Reflective tape remains legible against both color states.
    a.rect(x+2,o.y-o.h+1,w-4,3,'#d5ad65');
    for(let k=3;k<w-5;k+=8)a.rect(x+k,o.y-o.h+1,4,3,'#544b39');
    return;
  }
  const phased=Boolean(o.phase), zh=s.lang==='zh';
  const y=o.y, entrance=x-4, landing=x+w;
  a.rect(x,Math.min(y,o.landingY),w,253-Math.min(y,o.landingY),'#263234');
  const heading=phased?(zh?'相位桥':'PHASE RELAY'):(zh?'跳过断口':o.landingY<y?'STEP UP':o.landingY>y?'DROP':'FLOOR OPEN');
  board(a,x-79,Math.min(113,y-69),heading,phased?(o.phase==='night'?(zh?'X / 夜':'X / NIGHT'):(zh?'X / 日':'X / DAY')):(zh?'空格 跳':'SPACE / JUMP'),night);
  a.rect(entrance-4,y-2,7,3,'#e3c78e');
  a.rect(landing,o.landingY-2,7,3,'#daca99');
  if(phased&&o.phase!==(night?'night':'day'))return;
  if(!phased){
    segment(a,[[x,y],[x+5,y+5],[x+13,y+35],[x,y+44]],'#324241');
    segment(a,[[landing,o.landingY],[landing-6,o.landingY+9],[landing-11,o.landingY+35],[landing,o.landingY+45]],'#26363b');
    return;
  }
  const ramp=night?['#bbdfe5','#79a6b8','#4b6f85','#314958']:BRASS;
  a.box(x,y,w,12,ramp);
  for(let k=4;k<w-5;k+=9)a.rect(x+k,y+3,5,6,ramp[3]);
  a.glow(x+w/2,y+3,w*.56,13,ramp[0],.12);
}

function lamp(a,s,x,door){
  const sx=x-a.cam;
  if(sx < -100 || sx>500)return;
  const zh=s.lang==='zh';
  if(door){
    const floor=annexFloorAt(x);
    a.rect(sx-6,64,58,floor-63,'#3b493e');
    const open=Math.max(0,Math.min(1,(s.player.x-(x-60))/56));
    a.rect(sx-1,70,48,133,'#263638');
    a.rect(sx+2,73,43,125,'#304645');a.rect(sx+8,186,31,8,'#637361');
    const doorWidth=Math.max(5,Math.round(52*Math.cos(open*1.43)));
    drawChaseProp(a.c,'door',sx-3,floor,doorWidth,134,s.night);
    drawChaseProp(a.c,'exit',sx-1,74,50,14);
    if(open>0){
      segment(a,[[sx+2,70],[sx+47,70],[sx+60,219],[sx+7,219]],'#8a9f8040');
      a.glow(sx+23,161,28+open*25,62,'#ced8a6',.12*open);
    }
    const barWidth=Math.max(2,doorWidth-8);
    a.rect(sx+1,128,barWidth,6,'#9dbaa1');a.line(sx+1,128,barWidth,'#e2e8bf');
  }
  board(a,sx-8,door?37:54, door?'FIRE STAIR >':'02 / HALF LANDING',door?(zh?'防火门':'PUSH TO EXIT'):(zh?'应急灯':'RETRY LAMP'),true);
  a.rect(sx+13,78,13,4,'#d9edb5');a.glow(sx+20,83,27,30,'#c7e5ac',.26);
}

export function drawBackrooms(a,s){
  const c=a.c,chase=s.backrooms,p=s.player,zh=s.lang==='zh',night=s.night;
  const wing=annexWingAt(p.x);
  const wall=WALLS[wing.name][+night];
  a.rect(0,0,480,270,'#242f31');
  backdrop(a,s);
  a.rect(0,0,480,18,wall[3]);a.line(0,15,480,wall[0]);
  for(let i=Math.floor(a.cam*.74/96);i<=Math.floor((a.cam*.74+500)/96);i++){
    const x=i*96-a.cam*.74;
    a.rect(x,13,3,8,wall[2]);a.line(x+5,16,74,wall[1]);
  }
  // The void is drawn behind every solid platform and never inherits its phase.
  a.rect(0,223,480,30,'#263234');
  for(const surface of s.platforms){
    if(surface.phase||surface.solid)continue;
    const x=Math.max(-1,Math.floor(surface.x-a.cam)),end=Math.min(481,Math.ceil(surface.x+surface.w-a.cam));
    if(end<=x)continue;
    const y=surface.y,w=end-x;
    const style=WALLS[annexWingAt((x+end)/2+a.cam).name][+night];
    a.rect(x,y,w,253-y,style[2]);
    a.line(x,y,w,style[0]);
    a.rect(x,y+15,w,3,style[3]);
    a.line(x,y+24,w,style[1]);
    for(let k=Math.ceil((x+a.cam)/18)*18;k<end+a.cam-4;k+=18){
      const cx=k-a.cam;
      a.rect(cx,y+6+(Math.floor(k/18)%3)*3,4,1,style[1]);
      a.rect(cx+1,y+7+(Math.floor(k/18)%3)*3,2,1,style[3]);
    }
  }
  for(const o of CHASE_OBSTACLES)if(o.x-a.cam<560&&o.x+o.w-a.cam>-8)crossing(a,s,o);
  lamp(a,s,CHASE_LAMP,false);lamp(a,s,CHASE_DOOR,true);
  const gx=chase.ghostX-a.cam, stride=Math.sin(s.time*15);
  c.save();c.translate(Math.round(gx),Math.round(chase.ghostY)-37);c.scale(1.39,1.62);
  drawApparition(a,{kind:'clerk',state:'chase',facing:1,seed:7},0,-2+stride*1.4);
  // Bent reaching arm and fingers extend from the service clerk's sleeve.
  a.rect(4,-5,9,5,'#28383b');a.rect(11,-6,8,4,'#485954');a.rect(18,-7,6,3,'#929a82');
  a.rect(23,-8,3,1,'#b7b696');a.rect(24,-6,3,1,'#9d9e84');c.restore();
  a.player(p);
  if(!s.reducedEffects&&chase.active){
    const lamp=wing.name==='stair'?'#e5ad89':night?'#b7d9d9':'#e1d5a3';
    for(let i=0;i<14;i++){
      const seed=i*31.17;
      const x=((seed+s.time*(4+i%3)*2-a.cam*.42)%480+480)%480;
      const y=42+((seed*4.19+s.time*(i%3+2))%116)+5*Math.sin(s.time*1.3+seed);
      const bright=Math.sin(s.time*1.2+seed)*.5+.5;
      c.globalAlpha=bright*.38;
      a.rect(x,y,i%4===0?2:1,1,lamp);
    }
    c.globalAlpha=1;
    if(p.grounded&&Math.abs(p.vx)>90){
      for(let i=0;i<4;i++){
        const k=(s.time*4.1+i/4)%1;
        c.globalAlpha=(1-k)*.7;
        a.rect(p.x-a.cam-14*k,p.y+28-6*Math.sin(k*Math.PI),3-k,1,lamp);
      }
      c.globalAlpha=1;
    }
  }
  if(!s.reducedEffects&&s.shiftFx>0)drawPhaseRipple(a,s);
  a.rect(0,0,480,13,'#283b3b');a.label('017 / '+(zh?wing.zh:wing.en),8,9,'#e0d3a4',7);
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
    a.label(zh?'跨过推车与高低断口，按墙牌时钟切换昼夜。':'Vault the carts and broken levels. Match the clocks on signs.',29,74,'#c3cbaa',7);
  }else if(p.lifeState==='dying'||p.lifeState==='respawning'){
    a.rect(125,75,230,25,'#293b39e8');
    a.label(p.lifeState==='respawning'?(zh?'回到应急灯':'BACK AT THE EMERGENCY LAMP'):(s.death?.kind==='ghost'?(zh?'它追上你了':'IT CAUGHT UP'):(zh?'地板消失了':'THE FLOOR GAVE WAY')),140,91,'#efd6a2',9);
  }
}
