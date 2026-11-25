import assert from 'node:assert/strict';
import { TILE } from '../dist/3d/levels.js';

const journeys = [
  `* N6 * W N W N @A
    N4 @1
    S E S E S E S E S E S E11 @B
    S W2 S3 E S E @2
    * W N W N W N11 E N E @C
    E3 @E`,
  `N E N12 @A
    * W3 @1
    E2 S * S3! * W S W7 @C
    E5 S E6 E! E2! * N2 E4 S2 * @B
    N * E @2
    N W N3 E N @E`,
  `* N E N5 * E N N! @A
    W5 W2! W * N W2 @B
    S3 @1
    E N E N * E3! E7 * E4! N * E4 @C
    W3! S3! W7! W * N8! @P * W3 @2 E6 @E`,
];

const directions = {
  N: [0, -1, 'KeyW'], E: [1, 0, 'KeyD'], S: [0, 1, 'KeyS'], W: [-1, 0, 'KeyA'],
};
const centre = tile => (tile + .5) * TILE;

// This circuit stays on the regular corridors. It shares the trusted-input
// browser session with the separate shortcut and recovery checks.
async function walkChapter({ snapshot, whenPlaying, moveTo, hold, tap, aim, readHud, pauseAndReadGuide, runTransfer }, ending, chapter, route) {
  const start = await snapshot();
  assert.equal(start.chapter, chapter);
  assert.ok(Math.abs(start.yaw) < .01);
  let col = Math.floor(start.x / TILE);
  let row = Math.floor(start.z / TILE);
  const proof = { chapter, phaseChanges: [], interactions: [] };
  if (pauseAndReadGuide) proof.pauseGuide = await pauseAndReadGuide();
  if (start.gaze) {
    await aim('pitch', -.42);
    proof.officeLookPitch = (await snapshot()).pitch;
  }
  const started = performance.now();
  for (const command of route.trim().split(/\s+/)) {
    assert.ok(performance.now() - started < 85000, 'Chapter reached its time limit');
    const before = await snapshot();
    try {
      assert.equal(before.life, 'alive');
      if (command === '*') {
        await tap('MouseRight');
        const shifted = await whenPlaying(state => state.phase !== before.phase, 'accepted phase switch');
        proof.phaseChanges.push({ x: shifted.x, z: shifted.z, phase: shifted.phase });
        continue;
      }
      if (command.startsWith('@')) {
        const marker = command[1];
        if (ending === 'normal' && '12P'.includes(marker)) continue;
        const hudBefore = await readHud?.();
        await tap('KeyE');
        const state = await snapshot();
        const hudAfter = await readHud?.();
        if ('ABC'.includes(marker)) assert.ok(state.work.includes(marker), 'Station worked');
        if ('12'.includes(marker)) assert.ok(state.evidence.includes(chapter + '/' + marker), 'Record found');
        if (marker === 'E') {
          if (chapter === 1) {
            await whenPlaying(progress => progress.chase && !progress.chase.started, 'archive lift opens onto the transfer floor');
            proof.transfer = await runTransfer();
          }
          if (chapter < journeys.length - 1) {
            await whenPlaying(progress => progress.chapter === chapter + 1, 'exit to next chapter');
          } else await whenPlaying(progress => progress.mode === 'won', 'exit to ending');
        }
        proof.interactions.push({ marker, x: before.x, z: before.z, work: state.work, records: state.evidence, hudBefore, hudAfter });
        continue;
      }
      const [, direction, count = '1', sprint] = /^([NESW])(\d+)?(!)?$/.exec(command);
      const [dx, dz, key] = directions[direction];
      if (dx) await moveTo('z', centre(row));
      else await moveTo('x', centre(col));
      col += dx * Number(count);
      row += dz * Number(count);
      await hold(sprint ? ['ShiftLeft', key] : [key], () => whenPlaying(state =>
        dx * (centre(col) - state.x) + dz * (centre(row) - state.z) <= .07,
      'walk to ' + col + '/' + row, Number(count) * 740 + 1000));
    } catch (error) {
      throw Error(`Chapter ${chapter + 1}, ${command}, tile ${col}/${row}: ${error.message}`, { cause: error });
    }
  }
  proof.durationMs = Math.round(performance.now() - started);
  return proof;
}

export async function play3DJourney(browser, ending) {
  assert.ok(['complete', 'normal'].includes(ending));
  const chapters = [];
  const recoveries = [];
  for (const [chapter, route] of journeys.entries()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const start = await browser.snapshot();
      try {
        chapters.push(await walkChapter(browser, ending, chapter, route));
        break;
      } catch (error) {
        const stopped = await browser.snapshot();
        if (stopped.deaths <= start.deaths || attempt === 2) throw error;
        const revived = await browser.until(async () => {
          const state = await browser.snapshot();
          return state.life === 'alive' && state;
        }, 'local checkpoint revival', 5000);
        assert.ok(Math.hypot(revived.x - start.x, revived.z - start.z) < .35, 'Respawn must return to the route’s start');
        assert.ok(stopped.work.every(work => revived.work.includes(work)), 'Revival retains completed stations');
        assert.ok(stopped.evidence.every(record => revived.evidence.includes(record)), 'Revival retains records');
        recoveries.push({ chapter, x: stopped.x, z: stopped.z, phase: stopped.phase, reason: error.message });
      }
    }
  }
  const end = await browser.snapshot();
  assert.equal(end.ending, ending);
  assert.equal(end.deaths, recoveries.length);
  assert.deepEqual([...end.evidence].sort(), ending === 'complete' ? ['0/1','0/2','1/1','1/2','2/1','2/2'] : []);
  return { ending, deaths: end.deaths, records: end.evidence, chapters, recoveries };
}
