import test from 'node:test';
import assert from 'node:assert/strict';
import { faceDetails, installWoundFinish, woundKind } from '../dist/3d/wound-finish.js';
import { drawContactDrops } from '../dist/actor-art.js';

test('only designated actor surfaces receive pose-independent wound masks', () => {
  const targets = [['Weathered skin',false,'worker'],['Teeth',false,'teeth'],['Aged layered face wraps',true,'wraps'],['Laundered ivory twill',true,'fabric']];
  assert.equal(woundKind('Eyes'),null);
  assert.equal(woundKind('Laundered ivory twill'),null);
  for (const [name, nurse, kind] of targets) {
    assert.equal(woundKind(name,nurse),kind);
    const mat={userData:{},onBeforeCompile(){}};
    const control=installWoundFinish(mat,kind,-1);
    const shader={uniforms:{},fragmentShader:'#include <roughnessmap_fragment>',vertexShader:'#include <begin_vertex>'};
    mat.onBeforeCompile(shader);
    assert.equal(mat.userData.woundFinish,kind);
    assert.ok(mat.customProgramCacheKey().endsWith(kind));
    control.value=.72;
    assert.deepEqual(shader.uniforms,{woundSide:{value:-1},woundWet:{value:.72}});
    assert.ok(shader.vertexShader.includes('restWound=position'));
    assert.match(shader.fragmentShader,/roughnessFactor = mix/);
  }
});

test('the mouth trembles asymmetrically until capture clamps the jaw and grip', () => {
  const frames=Array.from({length:20},(_,i)=>faceDetails(i*.03,2,.83,0));
  assert.ok(frames.some(f=>f.chatter>.05&&f.left!==f.right));
  const held=faceDetails(.46,2,.83,.95);
  assert.ok(held.wet>.9&&held.grip>.9&&held.chatter===0);
  const still=faceDetails(.46,2,.83,0,true);
  assert.equal(still.chatter,0);
  assert.deepEqual(still,faceDetails(.67,2,.83,0,true));
});

test('Classic contact ink is local, short-lived and hidden by reduced effects', () => {
  const dots=[];
  const a={c:{save(){},restore(){}},rect:(...args)=>dots.push(args)};
  for (const [t,reduced] of [[-.1,false],[.53,false],[.19,true]]) drawContactDrops(a,200,100,t,1,reduced);
  assert.equal(dots.length,0);
  drawContactDrops(a,200,100,.24,1);
  assert.equal(dots.length,14);
  assert.ok(dots.every(([x,y,w,h])=>Math.abs(x-200)<21&&Math.abs(y-100)<15&&w<=4&&h<=2));
});
