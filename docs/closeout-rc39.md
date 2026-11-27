# RC39 · Exact-package closeout

**Playable:** http://127.0.0.1:8781/ · **ZIP:** `releases/last-light-3d-3.0.0-rc.39-html5.zip` (60,148,160 bytes; SHA-256 `ee529c611e8912ad512e86799f07f516b13635f000d84ccee59414bbbf548d28`). `unzip -tq` passed. Fresh package extraction `/tmp/ll-rc39-final.2A6Z87/site` and `outputs/local-play/rc39/site` had no `diff -qr` differences. Only QA scripts changed; RC39 runtime and earlier releases are unchanged. No upload/publication.

## Campaign and mobile

Both fresh 3D campaigns replayed on the exact package: zero deaths, 28 Annex obstacles each, 0/6 journal records respectively, saved ending reopened, Classic link and back. Separate Annex input run verified capture, revival, two intentional misses and subsequent 28-obstacle escape. Rooftop west catwalk proved solid by day, fall and revival at night. `npm test`: 154 passed. `npm run check`: 124 modules.

The combined mobile probe now uses `Page.reload` on the running game, confirms navigation type `reload`, then uses **Play in Mobile** to resume its existing save. The old helper navigated via `about:blank`, rewrote a chapter fixture and navigated in again. In the split trace, that old sequence lost yaw at the fake reload boundary; removing an extra screenshot did not fix it. With a real refresh, yaw advanced 0.28 rad at each instrumented checkpoint (including after reload and both rotations); a separate trace-free long run finished at 0.39 rad with all six scene pointer moves. The same long run covers editing, drag/resize, simultaneous stick+jump, persistence, independent portrait layout, Cancel and Reset. This resolves the Chrome regression test, not physical iOS/Android acceptance. No connected phone/tablet was available in the session.

## Audio from the real graph

`record-browser-mix.mjs` adds a parallel MediaStream destination to the node that already feeds the live output. The exact app graph and its output connection remain intact; it does not render replacement cues. Chrome recorded Opus, then decoded that deliverable to inspect sample peaks and 0.5 s RMS windows. These are decoded sample peaks, not true peaks or loudness measurements. All captures were stereo at 44.1 kHz (decoded), with no samples at/above 0.99 absolute amplitude.

- [Complete 3D route](evidence/rc39-closeout/audio/stereo-playthrough.webm): 193.20 s, peak −3.26 dBFS, RMS −21.43 dBFS.
- [3D Clerk, standard](evidence/rc39-closeout/audio-3d-normal/stereo-playthrough.webm) and [reduced](evidence/rc39-closeout/audio-3d-reduced/stereo-playthrough.webm): 17.64/17.76 s, peaks −3.51/−2.93 dBFS. Both are real input encounter captures, including avert, charge, bind and revival.
- [Classic Clerk, standard](evidence/rc39-closeout/audio-classic-normal/stereo-playthrough.webm) and [reduced](evidence/rc39-closeout/audio-classic-reduced/stereo-playthrough.webm): 10.98 s each, peaks −5.06/−4.91 dBFS. Local chapter fixtures start the encounter; actual keyboard input drives it.

The session has no listening channel to judge rhythm, pronunciation, spatial presentation or speech intelligibility by ear. These recordings and metrics are evidence, not subjective sign-off. Existing synthetic English narration remains disclosed; no new narration was added. A full Classic campaign mix and a physical speaker/headphone review are not represented by the Clerk clips.

## Geometry coverage and limits

- `mounts/whole-map-mounts.json`: 2,341 architecture placements (667 boiler, 350 archive, 1,324 roof) and 36 Annex material/mount groups. No failed new-kit mount. This is an inventory of the tested families, not literally every visible object.
- Selected indoor mounts: 700 short wall rays at 140 placements and 145 socket rays at 29 sockets, no blockers/missing samples. Verified moving between regular chapter controls as well as diagnostic pose stills. Imported service models checked at five floor placements and all 12 Annex bin/extinguisher bounds.
- Roof: 150 rays across 25 convex corners, every ray intersects its own modeled joint and none miss. 140 rays hit the joint first; 10 hit the neighboring permanent fascia first at diagonally touching corners `(25,4)` and `(24,5)`. Repositioned the diagnostic camera rather than taking a screenshot from inside the neighboring slab. 339 rays across 113 straight splices passed. Six phase-neighbor cases (five unique phase tiles), checked by day and night: zero inactive deck hits and no missing active deck. Paired render-only corner photos are distinct from walked landing/west-catwalk shots.
- Annex: actual passage and jump/phase validation for every obstacle; samples at obstacles 3, 16 and 28 and the exit door. This does not establish close-up approval for each later wall bay or gallery. Roof detours, coping viewpoints and skyline variants are also not individually visually signed off.

## Reproduce

From `last-light/`; the archived evidence is in `docs/evidence/rc39-closeout/`.

```sh
export TEST_DIST=outputs/local-play/rc39/site
export OUT=$(mktemp -d /tmp/ll-rc39-check.XXXXXX)
npm test && npm run check
JOURNEY=normal node scripts/browser-3d-shortcuts.mjs
JOURNEY=complete RECORD_MIX="$OUT/audio" LANDING_STILLS="$OUT/landings" node scripts/browser-3d-shortcuts.mjs
MOBILE_HUD_PROOF="$OUT/mobile" MOBILE_SWIPE_PROBE=1 node scripts/browser-3d-shortcuts.mjs
MAP_MOUNT_INVENTORY="$OUT/mounts" node scripts/browser-3d-shortcuts.mjs
FIT_DIAGNOSTIC_STILLS="$OUT/walls" FIT_PHOTO_CASES=1 node scripts/browser-3d-shortcuts.mjs
FIT_STILLS="$OUT/sockets" FIT_VISUAL_STILLS=1 node scripts/browser-3d-shortcuts.mjs
ROOF_CORNER_STILLS="$OUT/roof" ASSERT_ROOF_CORNERS=1 ASSERT_ROOF_SPLICES=1 ROOF_CORNER_LANDING=1 node scripts/browser-3d-shortcuts.mjs
TRANSFER_RECOVERY=1 TRANSFER_MISSES=1 TRANSFER_STILLS="$OUT/transfer" node scripts/browser-3d-shortcuts.mjs
MOURNING=1 MOURNING_FOLEY=1 WOUND_PROOF=1 RECORD_MIX="$OUT/clerk-3d" node scripts/browser-3d-shortcuts.mjs
CHECK_OFFICE_GAZE=1 SERVE_DIR="$TEST_DIST" PLAYTEST_URL_PATH=/classic/ EVIDENCE_DIR="$OUT/classic" RECORD_MIX="$OUT/clerk-classic" node scripts/browser-expanded.mjs
```

For reduced recordings, add `REDUCED_WOUND_PROOF=1` or `REDUCED_OFFICE=1` respectively and use new output folders. Continue from the mount inventory for the unreviewed visual placements; physical-device sign-off should repeat the same real-refresh sequence, on both iOS Safari and Android Chrome if available.
