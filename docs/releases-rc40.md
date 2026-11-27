# RC40 · Safe saves and continuous scenes

## Shipping changes

- Both editions use an IndexedDB transaction to compare and commit the authoritative save. Existing saves import from localStorage, which becomes a compatibility mirror. A paused tab reads the latest committed progress before resuming. Intentional restarts keep backups.
- The touch editor previews safe placement, prevents collisions with fixed controls and adjusts old overlapping profiles. The added Strike action preserves existing bindings when all letters are assigned.
- Opening and ending staging runs from gameplay transitions, and falling, capture and recovery have distinct poses. The 3D opening can be skipped. Reduced effects limit camera motion and flashing. Runtime timings, collision and campaign checkpoints remain authoritative.
- The archive apparition has re-sculpted brows, cheeks, nose, fingertips and palms with the same original 163-joint skeletal binding. Archive plaster varies along wall bays. Boiler, archive and roof gates use distinct finishes on the existing timed mechanical assembly.
- Boiler prop geometry uses spatial instances and full-wall occlusion for both the camera and headlamp. The generator's duplicate JPEG now shares its buffer view, saving 755,136 GLB bytes with the same bindings and decoded maps. Annex side props stream after core geometry. Optional archive fittings mount on their own. High quality retains its materials, texture resolution, anti-aliasing and lighting, and reports the actual render size in the frame-rate display.
- Rooftop strikes account for the full length and height of walls. The audio transition test schedules the same real cues at fixed offsets, without racing asynchronous suspend requests.

## Native-resolution sample

Two matched Chrome runs per tested release used a 2560×1440 canvas and render scale 1 with desktop High and adaptive resolution off. At Boiler arrival, RC39's turn window reported about 50.1 ms P95 and 66.7 ms maximum. With RC40 the two turn windows stayed at or below 33.4 ms. The sampled Boiler first shift also remained at or below 33.4 ms. The Archives first night stayed at about 16.7 ms. The recorded RC40 cold-entry maxima still reached 0.52–0.55 s on Boiler and Roof. Browser load and software-canvas Classic route tests were present at some points, so these are host measurements, rather than a guarantee for all hardware.

Chrome touch emulation passed orientation-specific editing, multi-touch, persistence, refresh, and post-edit camera swipe. The transactional save passed 24 simultaneous-write comparisons per edition, with exactly one committed writer in each comparison. Physical iOS and Android play and listening by ear remain open.

[Opening](evidence/rc40/3d-opening.jpg) · [Clerk contact](evidence/rc40/3d-contact.jpg) · [3D normal ending](evidence/rc40/3d-normal-ending.jpg) · [Classic opening](evidence/rc40/classic-opening.png) · [Roof lift by night](evidence/rc40/roof-lift-night.jpg)

## Campaign and audio evidence

The real-input Chrome runs completed the normal and complete endings in each edition. Both 3D runs cleared all three chapters and 28 Annex obstacles in 45.43 seconds. Both Classic runs cleared all 18 sections and 37 Annex obstacles in 45.05 seconds. The two complete runs found all six records. All four runs recorded zero deaths, and their saved outcomes were recovered. The final transactional save update was checked separately with concurrent writers and real browser resume.

The full complete-ending runs recorded the live WebAudio output in stereo at 44.1 kHz. Peak sample levels were −3.28 dBFS in 3D and −4.04 dBFS in Classic, with no samples at or above 0.99 absolute amplitude. These measurements verify the captured runtime signal. [Route and mix receipts](evidence/rc40/verification.json).
