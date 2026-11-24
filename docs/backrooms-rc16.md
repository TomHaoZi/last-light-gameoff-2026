# The Records Annex · desktop acceptance

The records transfer is a mandatory single-route pursuit in Classic's Archive → Pantry handover and in the first-person journey from the offices to the roof. All timings below are from native Google Chrome on macOS. Browser playthroughs used normal game controls. Focused recovery tests started the chapter from a test save. The art inspection camera was used only for the separate prop review.

| Edition | Start-to-exit time at full speed | Obstacles and input | Endings |
| --- | --- | --- | --- |
| Classic 2D | 44.57 s | 4,985 px at 112 px/s, 23 jumps and 5 airborne phase changes | Fresh ordinary and complete runs each finished all 18 sectors with zero deaths. The complete run recovered all 6 records. |
| First-person 3D | 45.17 s | 268.8 m at up to 6.1 m/s, 18 barriers, shelving openings, gaps and phase bridges | Both fresh runs worked all 9 stations, passed the chase with zero deaths and retained their ending after reload and a round trip to 2D. The complete run recovered all 6 records. |

### Recovery and visibility

- Classic's focused run deliberately stopped, showed the capture and revival, then ran through the midpoint lamp to the Pantry. A completed old save could replay the annex through Chapters and keep its evidence and ending. Additional physics checks covered falling through a bridge in its inactive phase and resuming from the midpoint save.
- First-person checks stopped within reach of the pursuer, missed a floor gap and ran into a bridge in the wrong phase. Each produced the expected death and a safe retry. A wrong-lane approach stopped against the end wall. The player could steer to the doorway, see the leaf swing on its hinge and leave through the lit landing. Only the forward door carries a green EXIT sign.
- The original Blender scene has sixteen editable assemblies. The game instances the thirteen-piece annex kit and loads the steam trap, ticket case and rainwater hopper separately on their respective floors. All three fittings were loaded and visually inspected with the production renderer by day and by night. This review caught a filing cabinet occluding the ticket slots and a missing backing for the rooftop hopper. Both were corrected. [Day and night close-ups of the three installed fittings](../media/floor-fittings-rc16.jpg).
- The classic atlas contains fifteen orthographic Cycles views of the same meshes. [Gameplay screenshots](../media/backrooms-rc16.jpg) show the classic runner in both phases, the night bridge in first person and a rear-view capture. [Editable Blender source](../art/blender/backrooms-annex.blend).

### Desktop frame timing

An isolated High-quality Chrome run rendered to a 2560 × 1440 game target on Apple M4 using ANGLE Metal. Over 2,709 display frames, the median and 95th percentile were 16.7 ms, the 99th percentile and maximum were 16.8 ms, and zero samples exceeded 50 ms. From start to the centered exit, the simulation measured 45.150 seconds and wall time was 45.160 seconds. These requestAnimationFrame intervals cover an active, warmed pursuit on this machine. They do not measure GPU execution time or cold first-load latency.

### Audio and runtime checks

Both stereo mixers rendered 48 seconds at 48 kHz through the game's master chains, including ten calls apiece. Peaks were −4.89 dBFS in Classic and −5.66 dBFS in first person, with zero clipped or nonfinite samples. Turning reversed the dominant channel of the recorded cry. Pause, mute, focus loss, capture, retry and departure were tested. These are digital measurements. Physical headphone listening and mobile device testing were outside this pass.

The desktop suite passed 112 tests. The syntax check covered 86 JavaScript modules. Chrome smoke covered title, start, first shift, pause and resume. The distribution archive contains 124 files and was reproduced byte-for-byte from the staged source. SHA-256: `2b3b57fe3e8ac70550cb84e4a6c1cc0e93266e2e65616c15081424d836395ad6`.

### Publication

Signed-out Chrome launched both editions on [the public itch.io page](https://tomhao.itch.io/last-light) and switched the playable opening to night in each. The page loaded embed **20795176** and the live manifest identified RC16. All 124 CDN files matched the local ZIP, allowing for the itch runtime script appended to its HTML files. GitHub main received the [release source and ZIP](https://github.com/TomHaoZi/last-light-gameoff-2026/commit/224fe45f5017963113331b8e83dcadf0fcd901ae).

The four full story runs exercised the new gameplay before final prop placement corrections. The finished archive was tested again across both complete chases and with all three standard-floor fittings rendered in both phases.

### Repeat the focused tests

```sh
npm ci
npm test
npm run check
python3 scripts/package-3d.py
EVIDENCE_DIR=/tmp/last-light-annex-2d CHECK_ANNEX=1 node scripts/browser-expanded.mjs
TRANSFER_RECOVERY=1 TRANSFER_MISSES=1 TRANSFER_SIDE_WALL=1 node scripts/browser-3d-shortcuts.mjs
node scripts/render-chase-audio.mjs /tmp/last-light-chase-audio
```
