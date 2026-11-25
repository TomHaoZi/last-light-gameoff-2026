import {drawChaseProp} from './chase-props.js';
import {RAMPS} from './art.js';
import {phaseActive} from './phase.js';
import {sceneText} from './cinema.js';
const ACCENTS = ['#ddae70', '#b5c7a4', '#a9c5c6'];

function plate(a, x, y, text, accent) {
  const w = text.length * 4 + 18;
  a.box(x, y, w, 13, RAMPS.iron);
  a.rect(x + 3, y + 3, w - 6, 7, RAMPS.iron[3]);
  a.label(text, x + 7, y + 9, accent, 6);
  a.rect(x + w - 5, y + 5, 2, 2, RAMPS.iron[1]);
}

function canister(a, x, y, w, h, paint, label) {
  const metal = RAMPS.iron, rust = RAMPS.rust;
  a.rect(x + 7, y + h - 3, w - 12, 8, metal[3]);
  a.rect(x + 6, y + 4, w - 10, h - 6, paint[3]);
  a.rect(x + 9, y + 1, w - 22, h - 2, paint[2]);
  a.rect(x + 5, y + 8, w - 14, h - 17, paint[1]);
  a.rect(x + 8, y + 8, 5, h - 21, paint[0]);
  a.line(x + 13, y + 3, w - 30, paint[0]);
  a.rect(x + w - 18, y + 10, 7, h - 19, paint[2]);
  for (const yy of [y + 17, y + h - 22]) {
    a.rect(x + 3, yy, w - 4, 7, metal[3]);
    a.line(x + 3, yy, w - 5, metal[0]);
    a.rect(x + 3, yy + 1, w - 10, 3, metal[1]);
    for (const offset of [9, w - 16]) {
      a.rect(x + offset, yy + 3, 3, 3, rust[3]);
      a.line(x + offset, yy + 2, 2, rust[0]);
      a.rect(x + offset + 1, yy + 6, 2, 8, rust[2]);
      a.rect(x + offset + 1, yy + 13, 1, 5, rust[3]);
    }
  }
  plate(a, x + 13, y + 30, label, '#cad0a3');
  a.rect(x + 11, y + h - 12, w - 24, 2, paint[2]);
  a.rect(x + 8, y + h - 1, 9, 8, metal[3]);
  a.rect(x + w - 20, y + h - 1, 9, 8, metal[3]);
}

function crate(a, x, y, w, h, alternate) {
  const wood = RAMPS.rust;
  a.box(x, y, w, h, wood);
  for (let k = 1; k < 4; k++) a.line(x + 4, y + Math.floor(k * h / 4), w - 8, wood[3]);
  for (let k = 0; k < h - 6; k += 3) a.rect(x + 2 + Math.floor(k * (w - 6) / h), y + k + 3, 4, 3, wood[2]);
  a.rect(x + 8, y + 6, 15, 2, wood[0]);
  a.rect(x + 8, y + 8, 9, 2, wood[1]);
  if (alternate) plate(a, x + 8, y + h - 16, 'HOLD', wood[0]);
}

function filing(a, x, y, numbered) {
  const metal = RAMPS.iron, paint = RAMPS.teal;
  a.box(x, y, 47, 105, paint);
  a.rect(x + 41, y + 2, 3, 100, paint[2]);
  for (let i = 0; i < 5; i++) {
    const yy = y + 5 + i * 19;
    a.box(x + 4, yy, 37, 16, i === 3 ? metal : paint);
    a.rect(x + 17, yy + 3, 11, 3, RAMPS.cloth[0]);
    a.rect(x + 14, yy + 8, 17, 4, metal[3]);
    a.line(x + 15, yy + 8, 15, metal[0]);
    if (numbered && i !== 3) a.rect(x + 24, yy + 4, 3, 1, paint[2]);
  }
  a.line(x + 6, y + 2, 23, paint[0]);
}

function officeDoor(a, x, y, mark, burned) {
  const metal = RAMPS.iron, wood = RAMPS.rust;
  a.box(x, y, 53, 104, metal);
  a.box(x + 4, y + 3, 45, 101, wood);
  a.box(x + 10, y + 14, 33, 40, wood);
  a.rect(x + 13, y + 17, 27, 34, burned ? '#394952' : '#668180');
  a.rect(x + 14, y + 18, 1, 30, burned ? '#6e7c77' : '#a6ab8b');
  a.line(x + 14, y + 18, 25, burned ? '#6e7c77' : '#a6ab8b');
  if (burned) {
    a.rect(x + 17, y + 24, 9, 17, '#2c3c47');
    a.rect(x + 15, y + 40, 14, 9, '#2c3c47');
    a.line(x + 16, y + 40, 12, '#596761');
    a.rect(x + 28, y + 35, 4, 2, '#75827b');
  }
  a.box(x + 11, y + 69, 31, 23, wood);
  a.line(x + 16, y + 74, 19, wood[0]);
  a.rect(x + 38, y + 60, 8, 4, RAMPS.gold[2]);
  a.line(x + 39, y + 60, 6, RAMPS.gold[0]);
  plate(a, x + 10, y - 11, mark, '#e3cd9e');
}

function plant(a, x, y, grown, offset) {
  const leaves = RAMPS.cloth, pot = RAMPS.rust;
  const bend = Math.round(Math.sin(a.t * 1.3 + offset) * (grown ? 2 : 1));
  const height = grown ? 35 + offset % 4 * 3 : 12;
  a.rect(x + 12, y - height, 2, height, leaves[2]);
  for (let i = 0; i < (grown ? 5 : 2); i++) {
    const left = i % 2 === 0;
    const yy = y - 4 - i * (grown ? 7 : 4);
    const spread = grown ? 9 + (offset + i) % 4 : 5;
    const cx = x + (left ? 11 - spread : 14) + bend;
    a.rect(cx, yy - 2, spread, 3, leaves[1]);
    a.rect(cx + 2, yy - 4, spread - 3, 2, leaves[0]);
    a.rect(cx + 2, yy + 1, spread - 2, 2, leaves[2]);
  }
  a.box(x + 3, y + 1, 20, 14, pot);
  a.box(x, y - 2, 26, 6, pot);
  a.rect(x + 3, y, 19, 2, pot[3]);
  a.rect(x + 6, y + 4, 2, 7, pot[0]);
  a.rect(x + 17, y + 8, 3, 4, pot[2]);
}

function hose(a, x, y, w, h) {
  const c = a.c;
  c.save();
  c.strokeStyle = RAMPS.iron[3];
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(x, y);
  c.bezierCurveTo(x + Math.round(w * .07), y + h, x + Math.round(w * .73), y + h, x + w, y + 7);
  c.stroke();
  c.strokeStyle = RAMPS.iron[1];
  c.lineWidth = 1;
  c.translate(-1, -2);
  c.stroke();
  c.restore();
}

function boilerRoom(a, s, p, x, y) {
  const r = RAMPS;
  if (s.sector === 0) {
    const duty = p.kind === 'O';
    a.box(x - 137, y - 67, 39, 96, r.teal);
    for (let k = 0; k < 5; k++) a.line(x - 130, y - 61 + k * 3, 20, r.iron[3]);
    a.rect(x - 108, y - 18, 4, 8, r.iron[3]);
    a.line(x - 108, y - 18, 3, r.gold[0]);
    if (duty) {
      a.desk(x + 25, y + 8, 0);
      officeDoor(a, x - 64, y - 73, 'DUTY', s.night);
      a.box(x + 101, y - 62, 36, 24, r.iron);
      a.rect(x + 105, y - 58, 27, 15, r.iron[3]);
      a.label(s.night ? '18:00' : '17:59', x + 107, y - 47, r.gold[0], 7);
    } else {
      canister(a, x - 35, y - 67, 76, 94, r.iron, 'SERVICE');
      a.pipe(x + 46, y - 54, 62, 8, false);
      a.pipe(x + 108, y - 58, 9, 83, true);
      a.valve(x + 113, y - 27, 8);
    }
  } else if (s.sector === 1) {
    crate(a, x - 147, y - 18, 67, 53, true);
    crate(a, x - 128, y - 53, 46, 35, false);
    a.box(x - 66, y - 62, 110, 98, r.iron);
    for (let j = 0; j < 12; j++) {
      a.line(x - 58, y - 57 + j * 7, 91, r.iron[3]);
      a.line(x - 58, y - 56 + j * 7, 91, r.iron[0]);
    }
    a.pipe(x + 86, y - 83, 11, 119, true);
    a.valve(x + 91, y + 5, 12);
  } else if (s.sector === 2 || s.sector === 5) {
    canister(a, x - 137, y - 57, 69, 90, r.iron, 'RETURN');
    canister(a, x - 67, y - 87, 99, 121, r.teal, s.sector === 2 ? 'STEAM' : 'MAIN LINE');
    a.valve(x - 23, y - 8, 12);
    a.pipe(x + 44, y - 102, 12, 136, true);
    a.pipe(x + 53, y - 50, 86, 8, false);
    a.box(x + 82, y - 70, 27, 17, r.iron);
    a.rect(x + 86, y - 66, 17, 9, r.iron[3]);
    a.label(s.station.done ? 'SAFE' : 'PSI', x + 87, y - 59, r.gold[0], 6);
    if (s.sector === 2 && !s.station.done && !s.night) {
      for (let i = 0; i < 3; i++) {
        const rise = (a.t * 13 + i * 14) % 39;
        a.c.save();
        a.c.globalAlpha = (1 - rise / 39) * .27;
        a.rect(x + 64 - i * 5, y - 52 - rise, 12 + i * 5, 3, '#dbd3ae');
        a.rect(x + 68 - i * 6, y - 54 - rise, 9 + i * 4, 2, '#d2d5b7');
        a.c.restore();
      }
    }
  } else if (s.sector === 3) {
    canister(a, x - 122, y - 91, 93, 122, r.iron, 'COOLANT');
    a.box(x - 94, y - 46, 22, 67, r.iron);
    a.rect(x - 89, y - 41, 12, 58, '#2e515f');
    a.rect(x - 88, y + (s.station.done ? -31 : -3), 10, s.station.done ? 46 : 18, '#78a4a4');
    a.line(x - 88, y + (s.station.done ? -31 : -3), 10, '#adc1af');
    for (let i = 0; i < 6; i++) a.line(x - 80, y - 37 + i * 9, 4, r.iron[0]);
    a.pipe(x + 23, y - 95, 10, 125, true);
    a.fan(x + 73, y - 16, 23);
  } else {
    a.pipe(x - 146, y - 74, 300, 10);
    hose(a, x - 87, y - 67, 152, 58);
    canister(a, x + 51, y - 36, 60, 67, r.teal, 'RETURN');
    a.box(x - 127, y - 19, 53, 51, r.iron);
    for (let i = 0; i < 4; i++) a.line(x - 121, y - 9 + i * 8, 37, r.iron[3]);
  }
}

function officeRoom(a, s, p, x, y) {
  const r = RAMPS;
  if (s.sector === 0 || s.sector === 1) {
    a.desk(x - 129, y + 7, 0);
    a.desk(x + 50, y + 15, 1);
    if (p.kind === 'O') officeDoor(a, x - 36, y - 75, 'STAFF', s.night);
    else {
      filing(a, x - 36, y - 72, true);
      a.box(x + 17, y - 57, 31, 23, r.rust);
      a.rect(x + 22, y - 54, 21, 14, r.cloth[0]);
      a.line(x + 26, y - 48, 12, r.iron[2]);
      a.line(x + 26, y - 45, 9, r.iron[2]);
    }
  } else if (s.sector === 2) {
    for (let i = 0; i < 4; i++) filing(a, x - 146 + i * 76, y - 72 - i % 2 * 6, true);
    a.box(x - 151, y + 32, 292, 5, r.iron);
    plate(a, x - 104, y - 95, '2014 / RECORDS', '#c9d1aa');
    if (p.kind === 'B') a.desk(x + 67, y + 20, 0);
  } else if (s.sector === 3) {
    a.box(x - 147, y - 15, 128, 45, r.cloth);
    a.box(x - 151, y - 22, 137, 8, r.rust);
    a.box(x - 135, y - 8, 44, 30, r.cloth);
    a.box(x - 80, y - 8, 52, 30, r.cloth);
    a.line(x - 122, y - 2, 17, r.iron[2]);
    a.line(x - 68, y - 2, 19, r.iron[2]);
    a.box(x - 59, y - 35, 20, 14, r.blue);
    a.box(x - 57, y - 38, 17, 4, r.rust);
    officeDoor(a, x + 47, y - 73, 'PANTRY', s.night);
    a.box(x + 12, y - 7, 22, 38, r.iron);
    a.line(x + 14, y - 4, 17, r.iron[0]);
  } else if (s.sector === 4) {
    officeDoor(a, x - 116, y - 71, 'STAIR', s.night);
    a.box(x + 43, y - 62, 70, 95, r.rust);
    a.rect(x + 49, y - 55, 55, 79, r.iron[3]);
    a.rect(x + 61, y - 17, 7, 31, r.iron[2]);
    a.box(x + 56, y - 20, 26, 7, r.gold);
    plate(a, x + 52, y - 53, 'RELEASE', '#e8b980');
    if (s.night) {
      a.rect(x - 45, y - 50, 12, 57, '#465253');
      a.rect(x - 35, y - 63, 18, 28, '#465253');
      a.rect(x - 34, y - 70, 9, 10, '#465253');
    }
  } else {
    a.desk(x - 130, y + 6, 0);
    filing(a, x - 49, y - 75, false);
    officeDoor(a, x + 56, y - 73, 'GARY', s.night);
    a.box(x + 24, y - 68, 22, 33, r.iron);
    a.rect(x + 28, y - 64, 13, 23, r.cloth[1]);
    a.rect(x + 32, y - 50, 7, 6, r.blue[2]);
    a.rect(x + 34, y - 56, 3, 7, r.cloth[3]);
  }
}

function roofRoom(a, s, p, x, y) {
  const r = RAMPS;
  if (s.sector === 0) {
    a.box(x - 131, y - 63, 111, 96, r.iron);
    a.rect(x - 124, y - 56, 97, 81, r.iron[3]);
    a.fan(x - 74, y - 18, 27);
    a.pipe(x + 0, y - 97, 13, 126, true);
    for (let k = 0; k < 5; k++) a.box(x + 46, y - 32 + k * 11, 78, 7, r.iron);
  } else if (s.sector === 1) {
    canister(a, x - 116, y - 101, 117, 131, r.iron, 'RESERVOIR');
    a.box(x - 70, y - 51, 22, 74, r.iron);
    a.rect(x - 65, y - 46, 12, 64, '#2d505e');
    const high = s.station.done ? 50 : 13;
    a.rect(x - 63, y + 16 - high, 8, high, '#81aaa1');
    a.line(x - 63, y + 16 - high, 8, '#b8c3a9');
    a.pipe(x + 50, y - 87, 10, 117, true);
    a.valve(x + 55, y - 13, 12);
  } else if (s.sector === 2) {
    a.box(x - 147, y + 15, 286, 19, r.rust);
    a.line(x - 141, y + 18, 275, r.rust[0]);
    a.rect(x - 141, y + 27, 275, 4, r.rust[3]);
    for (let i = 0; i < 5; i++) plant(a, x - 130 + i * 53, y + 1, s.station.done, i + s.sector);
    a.pipe(x + 122, y - 95, 7, 110, true);
  } else if (s.sector === 3) {
    a.pipe(x - 136, y - 85, 9, 117, true);
    a.pipe(x + 104, y - 83, 9, 113, true);
    hose(a, x - 128, y - 83, 232, 35);
    plate(a, x - 55, y - 45, 'FIRE STAIRS >', r.cloth[0]);
    a.box(x - 63, y + 7, 124, 21, r.iron);
    for (let i = 0; i < 6; i++) a.line(x - 58 + i * 19, y + 16, 11, r.iron[3]);
  } else if (s.sector === 4) {
    const mast = x + 27;
    a.box(mast, y - 109, 8, 141, r.iron);
    for (let k = 0; k < 5; k++) {
      const w = 129 - k * 17, cy = y - 28 - k * 18;
      a.box(mast - Math.floor(w / 2), cy, w, 5, r.iron);
      a.rect(mast - Math.floor(w / 2), cy + 5, 2, 7, r.rust[2]);
    }
    a.box(x - 118, y - 49, 53, 78, r.iron);
    a.box(x - 112, y - 42, 39, 27, r.blue);
    a.rect(x - 107, y - 37, 29, 13, r.iron[3]);
    a.label('LINK', x - 103, y - 28, r.gold[0], 6);
  } else {
    officeDoor(a, x - 93, y - 73, 'HOME', false);
    a.pipe(x + 76, y - 74, 9, 108, true);
    a.box(x + 61, y - 88, 39, 22, r.iron);
    const lit = s.events.includes('emergency-light');
    a.rect(x + 66, y - 84, 28, 10, lit ? r.gold[0] : r.gold[2]);
    if (lit) a.glow(x + 81, y - 62, 89, 75, '#e7c78d', .26);
  }
  if (s.sector >= 3 && p.kind === 'O') a.box(x - 149, y + 32, 292, 5, r.iron);
}

function roomColors(night) {
  const hues = new Map();
  const weight = night ? .29 : .11, indirect = night ? [31, 43, 56] : [69, 72, 57];
  for (const ramp of Object.values(RAMPS)) for (const color of ramp) {
    const rgb = Number.parseInt(color.slice(1), 16);
    const tone = indirect.map((target, i) => {
      const channel = (rgb >> ((2 - i) * 8)) & 255;
      return Math.round(channel * (1 - weight) + target * weight).toString(16).padStart(2, '0');
    });
    hues.set(color, '#' + tone.join(''));
  }
  return hues;
}
let ambientColors;

export function sectorDecor(a, s) {
  const c = a.c, accent = ACCENTS[s.floor];
  ambientColors ??= [roomColors(false), roomColors(true)];
  for (const p of s.props) {
    const x = p.x - a.cam, y = p.y;
    if (x < -180 || x > 660 || y < a.viewTop - 50 || y > a.viewBottom + 110) continue;
    c.save();
    a.ambientColors = ambientColors[+s.night];
    const painter = [boilerRoom, officeRoom, roofRoom][s.floor];
    painter(a, s, p, x, y + 45);
    if (p.kind === 'O') {
      const [name, width, height, bottom] = [
        ['steamtrap', 44, 33, 39], ['ticketcase', 36, 43, -4], ['rainhead', 36, 46, 36]
      ][s.floor];
      drawChaseProp(c, name, x + 72, y + bottom, width, height, s.night);
    }
    if (p.kind === 'O') plate(a, x - 140, y - 105, `${s.sector + 1} / ${s.sectorData.spec.en.toUpperCase()}`, accent);
    a.ambientColors = null;
    c.restore();
    if (s.floor !== 2 || s.sector < 3) {
      const lamp = x + 111;
      a.rect(lamp, y - 117, 2, 13, RAMPS.iron[3]);
      a.box(lamp - 8, y - 105, 19, 5, RAMPS.iron);
      a.line(lamp - 5, y - 100, 13, s.night ? '#eed59e' : '#b5af94');
      if (a.n > .02) {
        a.glow(lamp, y - 89, 35, 23, '#e6c08c', .17 * a.n);
        a.glow(lamp, y - 53, 61, 58, '#d7ae78', (.095 + Math.sin(a.t * 1.6 + p.x) * .008) * a.n);
      }
    }
  }
}
export function memoryPerson(a,p){
 const x=p.x-a.cam,y=p.y,walk=Math.sin(a.t*9+p.x*.03)*2,col=p.shade==='gary'?RAMPS.cloth:RAMPS.blue;
 a.c.save();a.c.globalAlpha=p.shade==='gary'?.8:.47;
 a.box(x+2,y+4,9,8,RAMPS.skin);a.box(x+1,y+12,12,11,col);a.rect(x+2+walk,y+23,4,5,col[3]);a.rect(x+9-walk,y+23,4,5,col[3]);a.rect(x-2,y+(p.pose==='hold'?7:15),4,p.pose==='hold'?14:9,col[1]);a.rect(x+12,y+15,3,9,col[1]);
 if(p.shade==='gary'){a.box(x+1,y+1,12,4,RAMPS.cloth);a.line(x+2,y+1,8,RAMPS.gold[0]);}if(p.lunch)a.box(x+14,y+18,11,8,RAMPS.gold);a.c.restore();
}
export function sectorActors(a,s){
 const station=s.station,x=station.x-a.cam,y=station.y;
 if(station.kind==='water'||station.kind==='growth'){a.box(x-8,y-5,16,18,RAMPS.blue);a.pipe(x+8,y-4,10,4);}
 else if(station.scene==='phone'){a.box(x-13,y-3,26,11,RAMPS.iron);a.rect(x-15,y-9,30,5,RAMPS.rust[station.done?2:0]);}
 else if(['archive','handover'].includes(station.kind)){a.box(x-10,y-8,20,23,RAMPS.cloth);a.label(station.done?'OK':'?',x-4,y+6,RAMPS.cloth[3],7);}
 else a.valve(x,y,10);
 a.label(station.done?'DONE':`[${s.controlKeys?.interact??'E'}]`,x-10,y-18,station.done?'#adc7a7':'#f2d397',6);
 for(const p of s.echoes||[])if(phaseActive(p,s.night)&&Math.abs(p.y-s.player.y)<280)memoryPerson(a,{...p,shade:'echo',pose:'waiting'});
 if(s.pursuit?.active)a.ghost({xNow:s.pursuit.x,yNow:s.pursuit.y,spawned:true,kind:'watcher',state:'chase',seed:0,facing:1},true);
 if(s.scene){for(const p of s.scene.actors)memoryPerson(a,p);const k=Math.min(1,s.scene.time/2);
  if(s.scene.id==='lunchbox'){const px=s.scene.origin.x-a.cam+17+(s.scene.beat>1?68:s.scene.beat===1?68*k:0);a.box(px,s.scene.origin.y+20,13,8,RAMPS.gold);}
  if(s.scene.id==='fire-door'){const p=s.scene.origin;a.swingDoor({x:p.x+88,y:p.y-13,w:29,h:42,openness:s.scene.beat>1?1:s.scene.beat===1?k:0});}
 }
}
export function cinemaOverlay(a,s){
 if(!s.scene)return;a.rect(0,0,480,14,'#182c33');a.label('17:59 / 18:00  ·  A MEMORY, NOT A CURSE',13,10,'#b9bba4',6);
 const lines=a.wrap(sceneText(s),442,8),h=Math.max(35,lines.length*12+13),top=244-h;a.rect(8,top,464,h,'#152b32f2');a.line(8,top,464,'#ad9b72');lines.forEach((line,i)=>a.label(line,18,top+14+i*12,'#e7dfbb',8));
}
