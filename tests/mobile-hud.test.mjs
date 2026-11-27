import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, HUD_CONTROLS, sanitizeLayout, fitLayout, editLayoutPoint } from '../dist/3d/mobile-hud.js';

test('mobile layouts supply independent bounded defaults and preserve profiles',()=>{
  const portrait=defaults(390,844),landscape=defaults(844,390);
  assert.deepEqual(Object.keys(portrait),HUD_CONTROLS);
  assert.notDeepEqual(portrait,landscape);
  assert.deepEqual(sanitizeLayout(landscape,portrait),landscape);
  assert.ok(portrait.attack.x>.75&&portrait.move.x<.25&&portrait.jump.size>portrait.shift.size);
});

test('untrusted or older layout data cannot make controls microscopic or nonfinite',()=>{
  const base=defaults(320,800);
  const result=sanitizeLayout({move:{x:-.1,y:NaN,size:0},jump:{x:2,y:'1',size:999},ignored:{}},base);
  assert.deepEqual(result.move,{x:0,y:base.move.y,size:72});
  assert.deepEqual(result.jump,{x:1,y:base.jump.y,size:112});
  assert.deepEqual(result.attack,base.attack);
  assert.equal(result.ignored,undefined);
});

test('legacy overlap and protected header/phase areas are repaired in both orientations',()=>{
  for(const [w,h] of [[378,832],[832,378],[308,308]]){
    const zones=[{left:0,top:0,right:w,bottom:52},
      {left:w-112,top:53,right:w,bottom:122},{left:w-81,top:h-52,right:w,bottom:h}];
    const legacy=Object.fromEntries(HUD_CONTROLS.map(key=>[key,{x:.25,y:.01,size:key==='move'?160:112}]));
    const result=fitLayout(legacy,w,h,zones);
    for(const [key,a] of Object.entries(result)){
      const radius=a.size/2, x=a.x*w, y=a.y*h;
      assert.ok(x-radius>=-.01&&x+radius<=w+.01&&y-radius>=-.01&&y+radius<=h+.01,key);
      for(const box of zones){
        const xx=Math.max(box.left,Math.min(box.right,x)),yy=Math.max(box.top,Math.min(box.bottom,y));
        assert.ok(Math.hypot(x-xx,y-yy)>=radius+3.99,key+' intersects protected UI');
      }
      for(const [other,b] of Object.entries(result))if(other!==key){
        assert.ok(Math.hypot((a.x-b.x)*w,(a.y-b.y)*h)>=(a.size+b.size)/2+3.99,key+' intersects '+other);
      }
    }
  }
});

test('an edit keeps the prior usable location if a drag or resize would cover another control',()=>{
  const width=378,height=832,zones=[{left:0,top:0,right:378,bottom:64}];
  const layout=fitLayout(null,width,height,zones);
  const old=layout.jump;
  assert.equal(editLayoutPoint(layout,'jump',{...old,y:.03},width,height,zones),old);
  assert.equal(editLayoutPoint(layout,'jump',{...layout.move,size:112},width,height,zones),old);
  const moved=editLayoutPoint(layout,'jump',{...old,x:.45,y:.42},width,height,zones);
  assert.deepEqual(moved,{...old,x:.45,y:.42});
});
