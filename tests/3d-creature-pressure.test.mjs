import test from 'node:test';
import assert from 'node:assert/strict';
import { creaturePressure } from '../dist/3d/creature-pressure.js';

test('a worker stills to listen, commits to pursuit, then braces at contact distance',()=>{
  const patrol=creaturePressure({threat:.03});
  const listening=creaturePressure({threat:.52,distance:4});
  const closing=creaturePressure({threat:.95,distance:4});
  const brace=creaturePressure({threat:.95,distance:1});
  assert.ok(patrol.settle>.95&&patrol.breathHold===0);
  assert.ok(listening.listen>.85&&listening.breathHold>.6&&listening.closing===0);
  assert.ok(closing.closing>.95&&closing.brace===0);
  assert.ok(brace.brace>.95&&brace.breathHold<listening.breathHold);
});

test('recoil and capture do not blend the pursuit pose into the final movement',()=>{
  const recoil=creaturePressure({threat:1,distance:1,stagger:.7});
  const grab=creaturePressure({threat:1,distance:1,attack:1,stagger:.7});
  assert.deepEqual([recoil.recoil,recoil.closing,recoil.brace],[1,0,0]);
  assert.deepEqual([grab.attack,grab.listen,grab.brace,grab.recoil],[1,0,0,0]);
});
