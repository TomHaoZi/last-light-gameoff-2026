import test from 'node:test';
import assert from 'node:assert/strict';
import { hazardBeat, hazardDischarging, hazardInPhase, hazardPressure, liftMotion, rotorStep,
  stationAge, stationPose } from '../dist/3d/machinery-motion.js';

test('boiler valves and rooftop flow settle without restarting a saved mechanism', () => {
  const valve = {};
  assert.equal(stationAge(valve, true, 23), Infinity);
  assert.equal(stationPose(0, stationAge(valve, true, 24)).discharge, 0);
  const valveLive = {};
  assert.equal(stationAge(valveLive, false, 3), -1);
  assert.equal(stationPose(0, stationAge(valveLive, true, 4)).discharge, 1);
  const turning = stationPose(0, stationAge(valveLive, true, 4.21));
  assert.ok(turning.action > 1 && turning.meter < .3, 'The dial lags the moving valve');
  assert.equal(stationPose(0, stationAge(valveLive, true, 6)).action, 2.08);

  assert.equal(stationPose(2, 0).discharge, 0);
  assert.ok(stationPose(2, .5).discharge > .95);
  assert.equal(stationPose(2, 1.5).discharge, 0);
});

test('office press retracts and the same door leaf rests after its spring motion', () => {
  assert.ok(stationPose(1, .18).meter > .94);
  assert.ok(stationPose(1, .52).leaf > .4);
  assert.equal(stationPose(1, 1.3).leaf, 0);
  assert.notEqual(stationPose(1, .85).leaf, stationPose(1, .85, true).leaf);
  assert.equal(stationPose(1, Infinity).leaf, 0);
});

test('hazard steam builds around the exact collision window and belongs to its phase', () => {
  const vent = { col: 1, row: 2, kind: '~' };
  assert.equal(hazardInPhase(vent, false), true);
  assert.equal(hazardInPhase(vent, true), false);
  const testAt = (time, open) => assert.equal(hazardDischarging(hazardBeat(vent, time)), open);
  testAt(.55, false);
  testAt(.59, false);
  testAt(.60, true);
  testAt(1.86, true);
  testAt(1.9, false);
  assert.ok(hazardPressure(1.2) > 0);
  assert.equal(hazardPressure(1.85), 1);
  assert.equal(hazardPressure(2.8), 0);
});

test('fans integrate coast consistently and the exit latch clears before the link turns', () => {
  const once = { speed: 6 };
  const many = { speed: 6 };
  rotorStep(once, .1, false);
  rotorStep(many, .1, false);
  const position = rotorStep(once, .6, true);
  const steps = Array.from({length: 36}, () => (rotorStep(many, 1 / 60, true)));
  assert.ok(Math.abs(position - steps.reduce((a, b) => a + b, 0)) < 1e-8);
  assert.ok(many.omega > .48 && many.omega < 6);
  assert.equal(liftMotion(.18).turn, 0);
  assert.ok(liftMotion(.18).latch > .94);
  assert.ok(liftMotion(.61).turn > .8);
  assert.equal(liftMotion(1).turn, 1.46);
});
