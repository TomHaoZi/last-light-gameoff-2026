# Engineering / design decisions

## 3.0.0-rc.40 · Save generations and visible scene geometry

Compare and write the exact source snapshot inside a per-origin IndexedDB transaction. Serialize the compatibility mirror with Web Locks where available. Reconcile at safe resume boundaries. Keep a raw backup when the player explicitly restarts. Keep control hitboxes inside the live playfield and out of reserved status, topbar and action-badge areas.

At fixed native resolution, retain the original materials, samples, lights and models. Group repeated meshes by spatial cells and skip fully hidden bounds only when opaque walls cover the whole batch for both the camera and headlamp. Keep late prop loading independent from the playable route. Share identical embedded image bytes without changing maps or bindings.

Stage the opening, falls or capture, lamp recovery, and both endings from the game state and authored shots. Keep gameplay timers, the save checkpoint and the recorded dialogue triggers independent of cinematic playback.

## RC39 verification · Real reload and separate evidence gates

Use a true page reload followed by Play in Mobile to test persistence; chapter fixtures that navigate away and back are for independent starts, not substitutes. Record the audible master in parallel without changing game output; decoded sample metrics do not replace human listening. Test panel ownership independently of first-hit ordering at diagonally adjoining permanent roof corners, and audit phase-neighbor expectations against the current map. Mount counts and ray checks do not replace walked visual review. See `docs/closeout-rc39.md`.

## 3.0.0-rc.39 · Keep blood on surfaces and at contact

Attach wound detail in rig rest space so blood follows wrinkles, skinned cloth, hands and mouth. Use actual gameplay contact to drive short world-space droplets and hand transfer, not a fullscreen tint or a change to damage. Animate small asymmetric strain before the grip, keep visual recovery bounded, and retain reduced-motion behavior and bilingual content notices.

## 3.0.0-rc.38 · Advance around the roof instead of retracing it

Keep the original stations, evidence, checkpoint keys and shortcuts. A west day approach and north night exit link support a forward circuit without hard-locking the order. Choose the shift from stable floor, keep the opposite span physically absent, and reserve the end of the loop for optional power and evidence. Keep ghost order based on marker family so changing an encounter's coordinates does not change its visual variant, voice slot or AI seed. Add creature foley at presentation-state boundaries and from actual vaults rather than scaling all audio with tension.

## 3.0.0-rc.37 · Build dread with contrast and anticipation

Keep the close task light and active phase edges readable; place the pressure in the low sky, distant silhouettes, and gaps between creature breaths. Derive worker pose and ambient vocal timing from the same alert/distance/stagger presentation blend, without changing the simulation or applying another screen filter. Editable touch layouts use a separate storage key and safe-area plane; portrait and landscape are independent, editing pauses play, and touch emulation does not stand in for device acceptance.

## 3.0.0-rc.36 · Licensed originals, fitted to existing depth

Download and checksum upstream model and PBR files in a pool, retain named mesh components, and collect packed editable Blender sources. Inspect the exact package before approving wall fits. Reposition the hose and service-bay props around existing piping; replace a decorative archive surround rather than mounting over it. Avoid altering simulation, phase ownership, saves, and transfer width for visual imports.

## 3.0.0-rc.35 · Ground the distant buildings and close straight joins

Use the seeded tower sites as the placement authority for their plinths. Keep the boulevard, access lanes and lower lots below the roof; the original grade remains if any city kit family fails to mount. Roof splices have exactly one owner per pair of adjacent permanent straight edges, even next to a phase deck; no extra support or phase cues. An exact-package inventory of mounted placements is separate from visual per-placement acceptance.

## 3.0.0-rc.34 · Wrap convex edges without touching support

Fit lapped fascia corners to pairs of exposed faces on permanent slabs, retaining straight rails as the load fallback. Recess each assembly below walking level; the three adjacent phase cells retain their own mesh visibility and collision. Use capped render-only camera comparisons for below-deck views, and separate actual keyboard routes for skyline sightlines and fall/revival proof.

## 3.0.0-rc.33 · Reserve wall depth for the prop that belongs there

Move independent boiler controls off the feed junctions; do not alter pipes or machine logic. Archive signs take priority over ornamental sashes, and cabinets/ticket furniture over misleading decorative insets. Mount printed art over the authored folded tray rather than burying it in ornamental depth. Report paired render-only cameras separately from player-walked photos and campaign evidence.

## 3.0.0-rc.32 · Fit by actual scene geometry

Use short mounted-mesh rays to locate suspected occlusions, then actual first-person framing to distinguish clutter, intentional screening and bad fit. Keep socket fallbacks on the corrected placement. Remove an ornamental sash hidden by the handover board rather than stacking frames. Clip annex recess bars to permanent floor intervals, and keep the roof zinc return attached to the three permanently backed quadrants rather than changing phase support.

## 3.0.0-rc.31 · Small fixtures and ownership at seams

Replace generic faceplate blocks and ceiling beams in their established sockets. Preserve the archive's authored troffers and add their support hardware separately. Roof underside fields only exist under neutral slabs and are tested below their obstructing fascia with mesh rays as well as real-camera fall recovery. Transfer corner fittings use the bridge phase, while vertical wall seams stay on the permanent shell.

## 3.0.0-rc.30 · Fitted utilities and skyline LOD

Pipe elbows shorten the two corresponding straight meshes and keep the old reaches live only as load fallbacks. Firestop plates must meet the ceiling and clear old beams in the real camera. Annex warning nosings frame permanent ledges without supplying support or lighting phase bridges. Far-city variations fit established seeded sites and keep a separate geometric/detail budget from the midground city.

## 3.0.0-rc.29 · Permanent trim and animated thresholds

Landings, casing, cove and roof underside details belong to the permanent shell; they are not traversal mesh or phase cues. Generate roof fascia only against true voids or bridge cells, not any cell with `phase` metadata. Keep gate hardware as static surrounds and move only the original simulated leaves. Mount the transfer trim in the existing instance/culling system so four rooms' extra detail does not force all of their geometry to render at once.

## 3.0.0-rc.28 · Keep inspection props subordinate to gameplay

Hazard models inherit the original phase groups. Machinery clocks, per-tile damage, particle emission and traversable floors retain their original owners. Evidence stands are static, but each authored record is a child of the original evidence indicator: a late asset load must not unhide an already collected record. Both replacements keep the old geometry available until the actual model mounts.

## 3.0.0-rc.26 · Replace repeated parts across the map

Imported GLB components remain editable and are instanced into the established wall-side or obstacle envelopes by asset family. Fallback batches disappear only when the actual replacement meshes are ready. The authored midground uses three variants and shared low-cost materials; coarse distant sky silhouettes stay separate. Wall brackets bolt to the permanent roof fascia, never to phase platforms. None of this decoration owns simulation collision, course timing or save progress.

## 3.0.0-rc.25 · Measured geometry imports, roof encounters and English speech

Model the silhouettes and visible hardware instead of hiding missing geometry with lighting. Use licensed CC0 sources for scene-appropriate items, retain the imported meshes and PBR maps, and credit the artists. Keep purpose-built mechanisms such as the wall extractor editable as separate parts in Blender. Place new dressing against actual walls, keep phase/route collision unchanged, and verify its in-game appearance before treating it as accepted.

Keep speech selection separate from caption language in both editions; English is the only shipped spoken track. The recordings retain their human and synthetic credits. Melee is confined to the 3D roof and simulated at contact time (not at button press or when the viewmodel happens to touch a mesh). Banishment lasts until checkpoint revival or reload, with no save schema change. Keep RC24's hosted directory intact and stage RC25 on a different local port for testing.

## 3.0.0-rc.24 · Archive nurse fan redesign

With the user's later approval of a fan interpretation, replace the Clerk's visible character but not the eye-contact rules or saved state. Use the existing CC0 skeleton and articulated capture, with shaped layered wraps and wearable cloth instead of wings. Keep both editions visually consistent. Preserve historical assets in source and prior ZIPs but don't bundle or request them in RC24. Credit the actual geometry and never label it an official game extraction.

## 3.0.0-rc.23 · Replace prop families, not just the hero angle

Replace the roof entrance growing bed, portable boxes and irrigation panel as separate modeled forms. Reuse the shared portable box mesh with instancing at existing positions and hold the fallbacks only until success. Validate through the player's camera in both phases. No model from a different Silent Hill release or a fan sculpt may stand in for the confirmed 2024 remake asset.

## 3.0.0-rc.22 · Editable production meshes

Use the actual first-person camera to judge silhouettes, joints, castings and seams. Geometry handles physical detail; lighting and PBR describe its finish. Keep editable source alongside merged/instanced web exports. Maintain the original phase and collision envelope, and retain a visible gameplay signal even while its authored lantern loads. Keep the Silent Hill nurse request distinct from the existing original Clerk; the latter remains until the specified production asset is available for project use.

## 3.0.0-rc.21 · Direct touch, mouse inputs and practical machinery

Launch the same campaign and checkpoint from **Play in Mobile**. Give the movement joystick its own pointer capture, allow independent camera drag and action pointers, and clear held input when the app loses focus or rotates. Classic keeps directional touch buttons around the existing game canvas.

Bind right mouse to the same game action as other editable shortcuts. Migrate legacy defaults and retain explicit customization. Place the boiler and roof assemblies off collision paths and draw repeated parts with instancing. Keep steam damage and visible pressure on the same timing, and mix recorded breathing separately from spoken guidance.

## 3.0.0-rc.20 · Practical light and capture continuity

Use the existing phase and collision grid for the archive. Its modeled slab, ceiling fixtures, cabinets and dressing instance behind neutral geometry. Light selection checks real walls and keeps safety sources and phase markings distinct. Retain old runtime assets in the repository for archived releases.

The contact frame settles the death and begins one timed presentation shared by the attacker, camera, player hands, sound and particles. The view goes fully dark before changing position to the saved lamp. Reduced effects limits camera motion while preserving the consequences and recovery. The wings keep their independent rig and license.

## 3.0.0-rc.19 · Bindings, difficulty and charge behavior

Resolve physical keyboard codes to game actions before processing movement, camera input and interaction. Each edition has its own control defaults and browser preferences. A key belongs to one action at a time and a conflict can be swapped explicitly. Every action retains at least one key. Settings and input loss clear held controls. Touch continues to send its own game actions.

Difficulty presets adjust enemy reaction, speed and recovery after hazards. Keep platform geometry, jump timing and puzzles consistent across presets. The Mourning Clerk moves toward the player during a sustained direct gaze. Breaking that gaze ends the charge, and capture requires contact. Her navigation respects phase-specific support and obstructions.

## 3.0.0-rc.18 · Eye contact and guidance

Exposure accumulates only under a clear direct gaze at an active office spectre. A short warning gives the player time to look elsewhere. Ordinary collision remains dangerous. Render the new figure and repaired wings from original independent Blender assemblies. Keep rule instructions playable from the phonograph and readable in the journal. Give directional creature sounds their own path and keep speech free of parallel delayed copies.

## 3.0.0-rc.17 · Chase pacing and interiors

Raise chase speeds in both editions and extend the route to retain roughly 45 seconds of uninterrupted running. Classic uses linked runs of jumps, steps and drops, while the first-person route alternates rack openings and follows them with paired jumps. Keep the old checkpoint identifiers and the phase switch as the single source of collision and platform visibility.

Build the utility gallery, microfilm stores and fire stair as different interiors. Modeled pit walls and markings belong to the stable edges. The renderer and collision share each obstacle's position. Fit a unique warning and a faster late arrangement into the existing chase mixer and duck the score briefly around the pursuer.

## 3.0.0-rc.16 · The Records Annex

The records transfer is part of each edition's existing story route. Its exit distance and the player's maximum forward speed give a clear run at least forty seconds without a countdown or a locked exit. Each physical obstacle, floor opening and phase bridge uses the same dimensions for simulation and rendering. The 2D midpoint lamp retains old save compatibility. First-person steering remains voluntary, with a pursuer that closes lost ground and an entrance checkpoint for retries.

Model original mechanical, office and roof fittings as separate editable Blender assemblies. Bake classic sprites from the same models. Instance the 3D corridor within view distance, switch off both geometry and shadows on inactive bridges, and swing the fire door independently of its jamb. Paper fibres catch the nearest real ceiling light. Route the pursuit score and directional calls through the existing edition-specific sound controls.

## 3.0.0-rc.15 · Gameplay and save recovery

A 2D checkpoint remains active while its trigger overlaps another lamp. Work and exit cues point to the current task while the player chooses a route. The 3D lift reports the remaining records on its floor before departure. The journal, completed ending and edition switch remain accessible to returning players. Both games preserve unreadable or newer-format saves until a deliberate restart can back up their original bytes.

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
