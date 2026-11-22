import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameBudget } from '../dist/3d/frame-budget.js';

function measure(budget, fps, seconds, adapt = true) {
  for (let i = 0; i < fps * seconds; i++) budget.observe(1 / fps, adapt);
}

test('adaptive rendering steps down under sustained load and recovers with hysteresis', () => {
  const budget = new FrameBudget();
  measure(budget, 60, 2);
  budget.observe(.18, true);
  assert.equal(budget.scale, 1);
  budget.observe(2, true);
  measure(budget, 37, 3);
  assert.ok(Math.abs(budget.fps - 37) < .001);
  assert.ok(budget.scale >= .64 && budget.scale < .9);
  const lower = budget.scale;
  measure(budget, 60, 2);
  assert.equal(budget.scale, lower);
  measure(budget, 60, 3);
  assert.ok(budget.scale > lower);
  budget.observe(1 / 60, false);
  assert.equal(budget.scale, 1);
});
