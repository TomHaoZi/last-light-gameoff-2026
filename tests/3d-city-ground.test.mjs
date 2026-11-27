import test from 'node:test';
import assert from 'node:assert/strict';
import { BOULEVARD_RADIUS, CITY_GRADE, planCityGround } from '../dist/3d/city-ground-layout.js';

const sites=[{x:64,z:12,width:5,depth:6,turn:Math.PI},{x:72,z:16,width:5,depth:5,turn:.14,far:true}];
const eps=1e-8;
const near=(a,b)=>Math.abs(a-b)<eps;

test('city kit keeps the established tower coordinates and all modules far under the roof',()=>{
  const plan=planCityGround(12,12,sites);
  assert.equal(plan.size,12);
  assert.deepEqual(plan.get('CityBoulevard'),[[12,CITY_GRADE,12,0,1,1,1]]);
  assert.deepEqual(plan.get('CityTowerFoot'),[[64,-22.02,12,Math.PI,5.64,1,6.64],[72,-22.02,16,.14,5.46,.68,5.46]]);
  assert.ok([...plan.values()].flat().every(([,y])=>y<-20));
  assert.ok(plan.get('CityAccessLane').length>=8);
});

test('each grid road has a crossing at both endpoints and each yard has one paved lot',()=>{
  const plan=planCityGround(0,0,[]);
  const crossings=plan.get('CityCrossing');
  const road=plan.get('CityRoad');
  for(const [x,,z,yaw] of road) for(const n of [-6,6]) {
    const ex=x+n*Math.sin(yaw),ez=z+n*Math.cos(yaw);
    assert.ok(crossings.some(([a,,b])=>near(a,ex)&&near(b,ez)),`${ex}, ${ez}`);
  }
  assert.equal(new Set(road.map(([x,,z,yaw])=>`${x}/${z}/${yaw}`)).size,road.length);
  const blocks=plan.get('CityPavedBlock');
  assert.ok(blocks.every(([x,,z])=>Math.hypot(Math.abs(x)+4.18,Math.abs(z)+4.18)<BOULEVARD_RADIUS-2.05));
  const lots=['CityPublicSquare','CityServiceYard','CityLowRise'].flatMap(n=>plan.get(n));
  assert.equal(lots.length,blocks.length);
  assert.ok(blocks.every(([x,,z])=>lots.filter(([a,,b])=>a===x&&b===z).length===1));
});
