# Engineering / design decisions

## 3.0.0-rc.14 · Character and encounter art

Author the workers, janitor, instruments and service lift in Blender and export the meshes into the browser build. Keep the existing collision, phase timing, rig and save semantics. Put department-specific damage into the shared skin atlas, align stains with clothing seams and keep the player's sightline and aiming point clear. The watch, station instruments and elevator leaves follow the simulation state. Voice performances carry per-source credits and can be understood through either subtitle language.

- Advanced maintenance routes branch from neutral platforms and rejoin the existing walkthroughs. Every 2D section provides a neutral finish lamp. Each 3D shortcut has a nearby retry lamp, and arrow markings belong to the actual floor phase. A second fire-corridor stairwell gives players who miss the handover jump a way back to the controls from the lower corridor. Saved checkpoint names and both save schemas are retained.
- The dual-edition visual update uses cached, authored pixel layers and existing simulation geometry in 2D. In 3D, floor-specific dressing and physical labels use per-floor batches, while the three pursuers keep the original topology, skeleton and texture sizes. Both editions keep their separate save formats and one authoritative day/night phase.
- Expanded world revision 2 is separate from retained-map save compatibility. Legacy v3 values are backed up before interpreting new fields and continue on their original maps; fresh shifts opt into the new chapter architecture automatically.
- Expansion uses authored 4-column/six-storey section plans, explicit stairwell placement, phase gaps, balconies, machines and six distinct work mechanisms per chapter. Door transitions are locked staged actions with positioning/fade, not debug teleport commands. Both exploration density and repeated-layout quality need review; numeric space alone is not final design sign-off.
- Area audit compares the exact archived local geometry at unchanged player/native scale. The denominator conservatively includes ALL baseline surfaces, even ones not sampled by the graph. Numerator counts only physics-graph-reached standing intervals, unions same-height/phase duplicates, excludes moving-platform sweep and subtracts machine-occupied intervals. A qualifying 480×270 screen cell needs at least 240 px of standing intervals. This is component-space evidence, not enemy-aware playthrough acceptance.
- Narrative work commits only after its visible scene; interruption restores at a lamp without silently granting it. Paused scenes do not advance. Final pursuit gives a five-second warning and restarts safely after death. Synthetic voices are not added.
- Persistent autonomy preference is recorded in `~/.pi/agent/AGENTS.md`; it does not override bounded tests, publication authorization or honest session/disconnection limits.

- 2026-11-11: actual baseline is the uncommitted 4200/4550/4900 local build, backed up outside the repo. Historical ZIPs remain unchanged. Do not use W=1450 to claim 10×.
- Runtime remains static Canvas 2D, 480×270, ES modules and WebAudio. No third-party runtime engine.
- Simulation owns gameplay phase. Renderer may interpolate background colours only. Inactive platform deletion is byte-for-byte PNG regression-tested, including transition frames.
- Simulation uses 1/120 s ticks. Browser frames accumulate at most 100 ms and discard inactive time. Edge inputs are consumed once. Focus loss pauses during death and lift sequences too.
- HP is health, never a respawn counter. Instant ghost/abyss kills ignore ordinary damage invulnerability. Only alive/hurt can die; respawning is separately locked.
- Checkpoints are named authored lamps, not arbitrary last-foot positions. Reassembly snaps the camera under the death transition so revival is visible at the lamp, and resets enemy targets.
- Corridor watchers chase horizontally; they do not home vertically onto a player jumping over them. Listeners may approach a noise source in 2D, but only in short range with warning. Wall intersections block motion.
- Ghosts were moved away from unavoidable phase-bridge landings. Rooftop listener is day-phase so an observed night route provides an escape. This preserves contact instant death, not a hidden grace-hit system.
- Legacy saves are backed up before v3 migration. Failed backup or unknown future schema enters read-only saving; neither destroys old data. Restart also backs up the current value.
- E commits task interactions through a brief protected pose; danger does not keep damaging a player while an interaction locks controls. Text does not lock controls or repeat fully after death.
- Normal-input browser testing is bounded: max three deaths and 235 seconds in current route attempt. Controller misses are logged as attempt failures, not conclusive map impossibility. Controlled fixtures never count as whole-game proof.
- The request’s tenfold space, final story staging and full audiovisual direction have NOT been reduced to this foundation patch. They remain open acceptance blockers. Packaging this as a complete upgrade would be false; new archives are explicitly dev/incomplete.
- No public upload, competition submission replacement, trailer modification or destructive Git operation is authorized by routine local implementation work.

- 2026-11-12: Packaging is now fail-closed on verify-evidence.mjs rather than relying on an unenforced documentation instruction. RC metadata describes current functional verification without inventing subjective audio sign-off.
- Primary release is the public itch RC and GitHub commit. Do not represent the stalled optional Sites mirror as current. Preserve numeric and subjective QA distinctions in release notes.

## 3D edition

- The first-person edition has its own entry point, simulation and save namespace. The browser package contains the expanded 2D edition at `classic/`.
- Every crossing uses the current gameplay phase for geometry and collision. The visual shift animates light and camera over 0.18 seconds. Ghost patrols use navigable cells in the current phase, while lamp zones shelter the player.
- The 3D environments use original code-built props, procedural materials and temporally animated lighting. Three.js is vendored at r187 with its license. Web Audio generates directional threats, room responses and a shared score with two arrangements.

The 3D renderer now generates surface maps, light probes, city shapes, props and signs in code. Surface weathering follows world coordinates across tile boundaries. The high graphics preset renders depth-aware shafts and contact shading. The controls guide names X as the phase key and explains the first bridge. The phase button, drag-to-look and arrow keys work in a browser embed without pointer lock.

Desktop play captures the mouse inside the Start or Resume click. Relative mouse motion turns the camera, and Escape or loss of game focus pauses the shift. An embed that blocks capture still accepts free mouse motion inside the game canvas. Touch keeps drag-to-look.

Each 3D creature has one closed, connected skinned body surface. The procedural head joins the neck below the jaw, and a facial morph deforms the lips and skin together. Dried marks, seams and folds are generated on the surface. The capture camera frames the actual creature as it lunges. Vocal calls are generated from resonant vocal contours and positioned in the room. A phase or room change fades interrupted calls.

For rc.5, the runtime uses embedded glTF props and skinned characters, photographed surfaces and local AAC recordings. Procedural alternatives cover loading and missing assets. Materials and dialogue are scoped to the active chapter. The original score continues to shift with the room. Dialogue ducks the mix and supplies captions in the selected game language, including while muted. Scene batches are grouped for camera culling. The adaptive resolution setting responds to sustained changes in frame time within the selected preset.

For rc.6, each held touch owns its pointer until release or cancellation. Keyboard state and touch state contribute independently to movement. Layout reserves space for touch targets and stacks active messages above them. An interrupted spoken line restarts from the beginning after a pause. Chapter changes and capture clear pending lines. Speech ducks music and room tone, with threat positioning preserved. Skinned creatures use an animation-safe culling bound. Adaptive resolution requires two slow measurement windows before scaling down.

For rc.7, desktop pause and ending overlays retain a rendered frame and redraw when settings, dimensions or visible assets change. Static scene transforms stay fixed after construction. Stamina updates its own meter without rebuilding the other status text. Desktop sensitivity is a preference shared by captured and uncaptured mouse look. Pause moves keyboard focus to Resume and canvas clicks can retry capture.

For rc.8, the rooftop sky uses scene depth to avoid shading opaque foreground pixels. The atmosphere skips ray samples whose original contribution is zero, and the post pass keeps its contact-shadow samples and exposure math. Each actor owns one bone texture per shared glTF skin. Night and day shader prelinks run in idle batches on desktop High when parallel compilation is available. They prepare programs without drawing inactive platforms or altering gameplay phase.

For rc.9, prepare Office creature bitmaps in short strips during idle frames. Shader preparation shares the same per-frame queue. A live actor uses a staged texture only after every strip and mip is ready. The original image supplies the fallback and context restoration. Office shader preparation includes the existing shadow-depth variants without extra draws. Immutable authored geometry is shared across live actors and remains reusable across chapters.

For rc.10, make edition choice explicit at the title screen. The combined package resolves both menu links within the same bundle. The standalone 2D package links to the public game page for 3D.
