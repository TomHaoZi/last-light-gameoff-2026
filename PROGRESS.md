# Progress · 2.0.0-rc.1

## Current implementation and verified state

- User wants autonomous sustained work, reasonable recovery from transient failures and durable checkpoints, not repeated “continue?” prompts. Global Pi preference is in `~/.pi/agent/AGENTS.md`. Bounded tests and honest session/disconnection limits still apply.
- All prior work preserved. Backups are outside this repo in `../last-light-backups/`. Old root jam ZIPs, dev.1 ZIPs and trailer remain untouched; versioned dev.1 SHA manifest preserved.
- Fresh world revision 2 implements 18 sections (six/chapter), unchanged 480×270 / 14×28 scale, actual 1920×1620 section geometry, two-axis camera, stairwell loops, phase crossings/balconies, machinery, warned hazards, lamps, powered return routes and staged doors.
- Eighteen persistent work sequences and bilingual visible scenes: power/pressure/steam/water/bridge/door work, corrected Gary record, phone, fire-door evacuation, lunchbox slide, plants, warned pursuit, animated normal/full departure. Actor motion is continuous across beats; deep-camera abyss death remains visible.
- Legacy saves are backed up and continue on compatible maps. Restart shift backs up current progress before entering the new expansion. Unknown future schema/world stays read-only.
- Space audit uses archived actual baseline and real physics. All three chapters exceed 10× in documented qualifying-screen and standing-interval metrics: 16×/16×/14.4× screens; 19.99×/19.56×/18.97× standing intervals. Small unsampled surfaces are excluded. This does not replace route/art quality review.
- **52 tests pass**, syntax and real Chrome smoke pass. Exact logs: `docs/evidence/expanded/checks/`.
- **Fresh normal ending: passed, 0 deaths**, `normal-rc1-ready/attempt.json`.
- **Fresh complete ending: passed, 0 deaths**, `complete-rc1/attempt.json`; six clues, corrected record, independent light and 18 mechanisms.
- **Actual completed disk save / 18-section revisit / Chinese journal / reload-resume: passed**, `revisit-rc1/report.json`.
- The harness now closes Chrome gracefully; earlier abruptly killed test profiles had corrupt WAL tails and are preserved as failed evidence, not user-save success claims.
- Real synth review regenerated: 136 s, 120.32 s composition cycle, zero clipped/non-finite samples, about −6.39 dB peak. No subjective listening claim.
- `node scripts/verify-evidence.mjs` checks exact current runtime hashes, fresh rather than resumed runs, both ending conditions, persisted completion, geometry-source hashes and numeric audio. It currently passes.

## Release work

Version is `2.0.0-rc.1`, not a completed universal audiovisual/platform sign-off. Generate HTML/source ZIPs with `npm run package`; then extract HTML to a temporary directory and run browser smoke against it. Keep release/source runtime bytes equal and versioned/latest manifests. Never overwrite historical jam/dev.1 archives or publish without authorization.

## Remaining review — do not invent completion

- Subjective headphone/speaker listening. The model has not listened to the WAV; numeric tests cannot approve perceived quality.
- Physical mobile devices and full Firefox/Safari playthroughs.
- Full-map profiling on target hardware; entrance/headless samples are narrower evidence.
- External final art/design review, including whether architectural repetition and exploration pacing meet the desired final-quality bar.
- Current ending screenshots/action logs exist; no continuous full-run video has been claimed.

These review limits do not negate the implemented expansion or successful whole-game functional tests. They are the reason the deliverable is a release candidate. No invisible background continuation is promised.

## Review / release preparation · 2026-11-12

Re-ran 52 Node tests, syntax checks and exact-runtime evidence validation: passed. Native Chrome confirmed legacy saved-game resume, phase hotkey and pause. Fixed packaging to actually run the evidence gate, replace stale dev.1 acceptance metadata and preserve versioned manifests. Current audiovisual/physical-device limitations remain explicit. User authorized GitHub and platform publication in this session; release confirmation still requires observing remote results.

Release result: GitHub main f5119861069825df5ce29b859a2ca11d5d5089c6 published. itch.io selected last-light-2.0.0-rc.1-html5.zip as the browser build, retained original archive, and native Chrome started/paused the fresh expanded build from html-classic.itch.zone/html/20459390/. The optional Sites backup sync stalled at Git network transfer and was cancelled; no updated Sites deployment is claimed. All 18 online JS/CSS assets matched local bytes; itch modifies index.html for its hosting wrapper.

## 3D edition · 3.0.0-rc.1

The boiler, office and roof are now first-person 3D levels with nine stations, six evidence records, checkpoint lamps and two possible endings. Sprinting extends detection range, sight and sound drive pursuit, and nearby floor and machinery hazards depend on the current time. The renderer adds animated shift light, sliding exits, ghost capture and lamp revival. The dedicated Web Audio mix has positional threats and separate room responses. Local HTTP entry is `/3d/`; use `python3 scripts/package-3d.py` for the standalone HTML5 package. The expanded 2D code and its evidence remain available.

The 63-test suite passes, including a zero-death complete-ending route driven by normal simulation inputs with the ghosts active. Chrome checks covered all three scenes, day and night, high and performance graphics, the 2D fallback and simultaneous touch movement/sprint under emulation. The offline stereo mix had no clipped or non-finite samples. Headphone listening and physical mobile play remain to be checked.

## 3D edition · 3.0.0-rc.2

Added weathered physical materials, procedural reflections, light shafts, new cloud layers, a deeper rooftop skyline and detailed props for the boiler room, office and roof. Controls now appear in the title and pause screens. The HUD phase button works by click or touch. X switches day/night and the first bridge appears at night. An itch-sized Chrome iframe with pointer lock denied passed both phase controls, the lamp save, a live first-bridge crossing and pause. Mobile touch controls were verified in Chrome emulation. Native browser scene checks covered all three floors. The 63 automated gameplay/audio tests still pass.

## 3D edition · 3.0.0-rc.3

Desktop mouse look is the default when entering or resuming the shift. Moving the mouse turns the view without holding a button. Escape releases the cursor and pauses. The menu, HUD and settings explain the desktop binding, while touch still has its own controls. All 63 existing automated tests and the syntax check passed.

Chrome verified that moving the mouse with no buttons pressed turns the camera, Escape pauses and releases capture, and Resume captures again. An isolated sandbox that blocks pointer lock still accepted free mouse movement and X. The packaged Classic link now points to its explicit index page for itch.io hosting.
