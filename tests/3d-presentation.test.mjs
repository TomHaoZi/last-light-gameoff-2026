import assert from 'node:assert/strict';
import test from 'node:test';
import { dressingBounds, dressingOccluded, opaqueWallSpans } from '../dist/3d/dressing-visibility.js';
import { ordinaryLifeShot, SHIFT_SHOTS, shiftShot } from '../dist/3d/shift-cinematics.js';

function mapOf(points) {
  const walls = points.map(([col,row]) => ({col,row,kind:'#'}));
  return {walls, get:(col,row) => walls.find(tile => tile.col === col && tile.row === row)};
}

test('an opaque wall can cull fully hidden props while doorways and shadow silhouettes stay', () => {
  const solid = opaqueWallSpans(mapOf([[2,0],[2,1],[2,2]]));
  const broken = opaqueWallSpans(mapOf([[2,0],[2,2]]));
  const point = {x:8, y:.1, z:3.5, yaw:Math.PI / 2};
  const bounds = dressingBounds([point], [4,1.23,.8]);
  const eye = {x:3, y:1.66, z:3.5};
  assert.equal(dressingOccluded(solid, bounds, eye, {...eye, z:3.75}), true);
  assert.equal(dressingOccluded(broken, bounds, eye, {...eye, z:3.75}), false);
  assert.equal(dressingOccluded(solid, bounds, eye, {...eye, x:7.5}), false);
  assert.equal(dressingOccluded(solid, bounds, {...eye,y:3.45}, eye), false);
  const crossing = dressingBounds([point, {...point, z:16}], [4,1.23,.8]);
  assert.equal(dressingOccluded(solid, crossing, eye, eye), false);
});

test('the opening and completion settle to legible and motion-free endpoints', () => {
  assert.ok(shiftShot('arrival', 0).black > .7);
  assert.ok(shiftShot('arrival', 1).wrist > .8);
  assert.equal(shiftShot('arrival', SHIFT_SHOTS.arrival).black, 0);
  assert.equal(shiftShot('arrival', SHIFT_SHOTS.arrival).wrist, 0);
  assert.equal(shiftShot('success', 0).caption, 0);
  assert.equal(shiftShot('success', SHIFT_SHOTS.success).caption, 1);
  assert.equal(shiftShot('arrival', 1, true).wrist, 0);
  assert.equal(shiftShot('success', 1, true).forward, 0);
});

test('falls and catches black out before the checkpoint reappears', () => {
  for (const cause of ['fall', 'ghost', 'machinery']) {
    assert.equal(ordinaryLifeShot('dying',cause,1.11).black, 1);
    assert.equal(ordinaryLifeShot('respawning',cause,0).black, 1);
    assert.equal(ordinaryLifeShot('respawning',cause,.67).black, 0);
    assert.equal(ordinaryLifeShot('respawning',cause,.67).descent, 0);
    assert.equal(ordinaryLifeShot('dying',cause,.8,true).roll, 0);
  }
});
