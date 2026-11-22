# Progress · 2.0.0-rc.1

## Browser title navigation · 3.0.0-rc.13

- Both title logos now target explicit index files so they open the title screen on the itch.io CDN. The packaged Chrome smoke passed both logo links and both edition switches. The route receipt identifies the three archive entries in this navigation patch.

## Advanced routes · 3.0.0-rc.12

- Both fresh 2D Chrome journeys cleared all 18 work areas and persisted their respective endings. The complete route deliberately missed the first phase catch in every section, recovered, then completed 131 ordered jumps and 77 airborne phase switches. The normal route used the existing section controller without mandatory advanced routes. Neither journey lost a life.
- The fire corridor was replayed from the earlier failed save. The player climbed all eight steps of the added recovery stair and completed the fire controls before continuing to Gary's office.
- The extracted 3D release reached both endings in separate fresh Chrome runs with all three floors cleared and zero deaths. Separate real-input shortcut runs landed 3, 3 and 4 jumps, accepted seven airborne switches and revived at the nearby lamp after an intentional fall on every floor.
- The 1440p High archive walk trials measured a 16.7–33.3 ms frame interval on the first night switch. Those cold tests cover the archive walk and first switch under the tested host load.
- All 90 unit and integration cases passed. [Section-by-section browser receipt](docs/route-playtest-rc12.json).

## Dual-edition visual refresh · 3.0.0-rc.11

- Added pixel-crafted room dressings and day/night backdrops across all 18 sections, revised the janitor and ghosts, and redrew door and phase effects. Seventy-two paired Chrome fixture cases cover the 18 sections in each phase. Inactive platforms remain pixel-invisible during the transition.
- Added 3D fittings and signs for each of the three floors and revised the three pursuers' faces, clothing and motion using the existing rig and texture sizes. Nineteen paired scene checks ran at 2560×1440 High with 2× MSAA and reported zero WebGL errors.
- Independent fresh Chrome runs reached the complete endings in both editions. The 2D run completed 18 mechanisms and 60 shifts, then passed completed-save reload, all-section revisit and the Chinese journal. The 3D run collected six records and triggered all four recorded dialogue cues. Both completed with zero deaths or runtime errors. Two combined-package iframe smoke runs also confirmed day/night and exact saves across the edition round trip.
- Five cold archive walk trials per version held 2560×1440 High and 2× MSAA. The first switch after walking to the bridge stayed between 16.6 and 16.7 ms, and the entry median was about 267 ms for each version. The slowest entry was 283 ms before and 333 ms after the art update. Both builds showed occasional 50 ms frames when first revealing a new area.
- Syntax checks covered 63 modules and all 71 automated tests passed. The historical release evidence below covers the original expansion.

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

## 3D edition · 3.0.0-rc.4

Rebuilt the three creature bodies as continuous skinned meshes. Added integrated sculpted facial features, a jaw morph, worn workwear and localized dried blood. New code-generated voices cover distant howls, alert screams, near snarls and capture screeches, with spatial attenuation, room reflections and interruption on phase change.

A normal-input Chrome session crossed both opening phase routes, triggered the first creature capture and returned to the saved lamp with full integrity. The 64-test suite passes. Creature renders were checked at each graphics tier. Offline stereo checks cover direction, peak headroom and phase transitions. Subjective headphone listening remains open.

## 3D edition · 3.0.0-rc.5

The three pursuers use imported, rigged human models with separate clothing and materials. Six props and four photographed surfaces add detail to the boiler room, office and roof. The mix adds 12 recorded spatial effects and four performed English lines with English and Chinese subtitles. The recordings, assets and licenses ship in the game package.

Retested the three chapters, both phases and all three quality tiers in Chrome. A normal-input run switched phase, triggered the first recorded line, crossed the opening bridges, saved at a lamp, was captured and respawned with three integrity points. The 66 automated tests and the 2D evidence checks pass. The matched-camera Chrome benchmark on Apple M4 measured about 60 FPS for each chapter in both builds. High quality rendered at 2560×1440 in this build and 1920×1080 in rc.4. The new build drew 31–63% fewer triangles per frame in those scenes. Subjective headphone listening and performance on other physical devices remain open.

## 3D edition · 3.0.0-rc.6

Separated touch pointers from keyboard input and reflowed HUD messages and controls for narrow portrait and short landscape. Pausing returns an interrupted spoken line to the front of the queue. Dialogue now ducks recorded and synthesized room tone as well as music, and capture fades the preceding creature call. The 58-second stereo review covered the four spoken lines, five categories of creature vocalizations, two arrangements on all three floors, and overlapping effects. Default and maximum volume runs had zero clipped samples, with peaks at −2.46 and −1.90 dBFS respectively. The review played through the connected headphone output. Subjective listening remains unverified.

Two matched three-chapter runs on Apple M4 Chrome measured 59.78–60.00 FPS with a 16.7 ms P90 frame time at desktop High and mobile-emulated Balanced. Visible and shadow render passes drew 13–32% fewer triangles on desktop and 8–25% fewer in mobile emulation. All six profiles stayed at full preset scale. Induced sustained load still lowered scale, and the scale recovered after load cleared. These mobile profiles ran on the M4. Physical phone performance remains unverified.

Chrome touch checks crossed both opening bridges at 320×568 with no deaths and verified movement and camera drag together, cancellation, jump, phase buttons, pause and the checkpoint. The 568×320 safe-area profile kept subtitles, status and targets separate. A packaged desktop run verified the interrupted recording, language switch, checkpoint, capture and full-health revival. All 70 tests passed in the release checkout.

## 3D edition · 3.0.0-rc.7

Desktop players can resume with Enter, recapture the mouse by clicking the scene, and set mouse sensitivity to 50–200%. Chrome and Safari both passed pause and keyboard resume. Sprinting updates the stamina meter without rewriting the room and phase text. A matched Chrome sprint reduced unrelated status-card mutations from 84 to zero.

In three matched Apple M4 WebGL scenes, the first paused frame remained visible with no later draw calls, down from 155–210 calls per callback. Active rendering preserved scene geometry and performed 11–27% fewer local matrix compositions. Quality changes and window resizing re-render the paused scene. Fixed 1440p frame-rate differences were mixed under shared desktop load, so no overall FPS increase is claimed.

The packaged Chrome build accepted ordinary keyboard inputs through all nine stations and all six records. A capture interrupted the rooftop return, and a separate run from a rooftop save fixture verified the complete ending. Both endings also remain covered by the simulation suite. All 70 tests passed in the release checkout.

## 3D edition · 3.0.0-rc.8

The 1440p High pipeline retains two-sample MSAA, scene resolution, shadows, fog, materials and sky detail. The roof sky uses the foreground depth mask, and light shafts skip contributions that would be zero. Ghost parts share the actor's bone texture. Twelve matched patrol, chase, turn and capture images were pixel-identical for the ghost change. Bone texture uploads dropped from 62,720 to 12,544 bytes per drawn actor per frame. Isolated shader comparisons preserved the sky and showed negligible RGB rounding differences in scenes with post effects.

An alternating baseline/candidate/candidate/baseline run on Apple M4 Chrome held fixed 2560×1440 and 2× MSAA on all three floors, with adaptive resolution disabled. Both builds reached the test display's ~60 FPS. Mean GPU time across the two runs of each build dropped from 11.84 to 11.40 ms during phase transitions and from 12.04 to 10.74 ms during capture. Turn and chase averages were approximately unchanged. In the separate cold-office test, idle shader preparation shortened the first night transition's ~100 ms frame interval to ~83 ms. The cold-office hitch remains visible.

Ten combined-build screenshots at 2560×1440 were either pixel-identical or differed at no more than 26 pixels, with a maximum difference of four RGB8 levels. Two packaged Chrome runs with ordinary inputs verified turning, switching, recorded dialogue, the checkpoint, capture and revival. Occasional frames above 25 ms appeared in normal-input timings, although the matched renderer runs stayed at about 16.7 ms. The 70-test suite and syntax checks passed.

## 3D edition · 3.0.0-rc.10

The browser bundle launches a title menu with equally prominent actions for the expanded 2D edition and first-person 3D edition. The 2D title card links back to the shared menu. Each edition uses its existing save and language settings.

Profiling the Office's first night traced the stall to first-use shadow shader work and a synchronous upload of the 2048×2048 creature skin. The shader and strip uploads share one idle slot per frame. Prepared textures retain their original resolution, sampling and mip levels. The renderer reuses the authored vertex buffers between actors. Meshes still use separate materials and skeletons.

Six alternating fresh-profile runs used the actual Chrome game and keyboard to leave the boiler floor and switch at the cold Office bridge. The render contract stayed at 2560×1440 High, 2× MSAA and full scale. First-switch frame interval fell from a median of 100.1 ms (worst 116.7) to 16.7 ms (worst 16.8). Median Office entry stayed at about 166.7 ms, and all six runs had zero pre-switch intervals over 33.4 ms after the entry frame.

Three paired walk trials showed the same occasional roughly 50 ms frame when the camera first reveals new Office geometry. Both builds linked the same two programs at that spot. The first shift after walking or continuing from an Office lamp save stayed near 16.7 ms. Exact GPU readback matched all 67 mip levels of the six creature textures. The geometry check compared 210,708 sampled skinned vertex positions and verified that shared buffers did not change the poses. All 71 tests passed.

Two additional bridge checks on the release source included periods of heavier background work. They measured first-shift intervals of 16.7 and 50.0 ms, versus 133.3 and 83.4 ms in the corresponding rc.8 checks. Entry intervals were 200.1 and 200.0 ms for the new build, versus 216.7 and 183.3 ms for rc.8.

Five combined-build Office frames at 2560×1440, covering turning, the shift, night, pursuit and capture, matched rc.8 pixel for pixel.
