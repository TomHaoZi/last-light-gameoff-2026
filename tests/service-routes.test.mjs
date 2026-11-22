import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAPTERS } from '../dist/chapters.js';
import { freshSave } from '../dist/save.js';
import { Simulation, FIXED_DT } from '../dist/simulation.js';

function steer(player, center) {
  const brakingPosition = player.x + 7 + player.vx / (player.grounded ? 20 : 12);
  return { left: center < brakingPosition - .95, right: center > brakingPosition + .95 };
}

function settle(world, center) {
  for (let frame = 0; frame < 190; frame++) {
    const player = world.player;
    if (player.grounded && Math.abs(center - (player.x + 7)) < 1.4 && Math.abs(player.vx) < 3) return;
    world.step(steer(player, center), FIXED_DT);
  }
  assert.fail(`Could not stop on the service route near x=${center}`);
}

for (const [floor, sections] of CHAPTERS.entries()) {
  for (const [sector, { id }] of sections.entries()) {
    test(`${id} service route has a complete sequence of jumps and airborne switches`, () => {
      const world = new Simulation({ ...freshSave(), floor, sector, events: ['arrival-seen'] });
      const { steps, checkpoint } = world.sectorData.relay;
      world.start();
      settle(world, 62);
      let switches = 0;
      for (const [index, step] of steps.entries()) {
        const landing = index === steps.length - 1;
        if (landing) settle(world, 428);
        const center = index === 0 ? 62 : step.x + Math.min(step.w / 2, 25);
        const switchInAir = step.phase != null && (step.phase === 'night') !== world.night;
        const previousShifts = world.shifts;
        let landed = false;
        for (let frame = 0; frame < 160; frame++) {
          const shift = frame === 17 && switchInAir;
          if (shift) assert.equal(world.player.grounded, false);
          world.step({ ...steer(world.player, center), jump: frame === 0, shift }, FIXED_DT);
          if (frame <= 12 || !world.player.grounded) continue;
          assert.equal(world.player.supportId, step.id);
          landed = true;
          break;
        }
        assert.ok(landed, `No landing on ${step.id}`);
        if (switchInAir) {
          assert.equal(world.shifts, previousShifts + 1);
          switches++;
        }
        if (index !== steps.length - 2) settle(world, center);
      }
      settle(world, checkpoint.x + 7);
      assert.ok(switches >= 3);
      assert.equal(world.checkpointId, checkpoint.id);
      assert.equal(world.deaths, 0);

      const resumed = new Simulation(world.persist());
      resumed.start();
      settle(resumed, checkpoint.x + 7);
      assert.equal(resumed.checkpointId, checkpoint.id);
      settle(resumed, 625);
      assert.ok(!resumed.player.supportId.includes('/relay-'), 'The far landing must rejoin the ordinary room');
      assert.equal(resumed.deaths, 0);
    });
  }
}
