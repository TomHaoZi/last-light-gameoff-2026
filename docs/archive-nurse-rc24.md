# RC24 · Archive nurse fan redesign

The user accepted a fan interpretation in place of the 2024 official model. The archive enemy has actually been replaced in the local game. LAST LIGHT authored this adaptation with its existing CC0 human skeleton, exposed skin and shoes. The new mesh has rounded layered wraps with an under-wrap sculpt, a folded ward cap, an ivory uniform, sculpted binding and snaps, and baked color and normal maps. Classic has matching hand-drawn pixel art. The original encounter's save state, gaze trigger, pursuit, capture timing and lamp recovery are unchanged.

An online search identified Sebastian Kansik's separately authored, CC BY 4.0 *Nurse of Horror*. Its public metadata was accessible; the file endpoint required authentication (401). No platform restriction was bypassed. No third-party fan download or Konami asset was bundled. The runtime model is an independently authored LAST LIGHT fan interpretation, not the official or Kansik model.

[Approach in Chrome](../media/rc24-nurse-review/nurse-approach.jpg) · [Capture close-up](../media/rc24-nurse-review/nurse-capture.jpg) · [Classic capture](../media/rc24-nurse-review/classic-capture.png) · [Editable Blender source](../art/blender/archive-nurse.blend)

```sh
blender -b --python-exit-code 1 -P art/blender/build_archive_nurse.py
npm test
npm run check
python3 scripts/package-3d.py
STAGE=$(mktemp -d)
mkdir "$STAGE/package" "$STAGE/stills"
unzip -q releases/last-light-3d-3.0.0-rc.24-html5.zip -d "$STAGE/package"
TEST_DIST="$STAGE/package" MOURNING=1 MOURNING_STILLS="$STAGE/stills" node scripts/browser-3d-shortcuts.mjs
SERVE_DIR="$STAGE/package" PLAYTEST_URL_PATH=/classic/ EVIDENCE_DIR="$STAGE/classic" CHECK_OFFICE_GAZE=1 node scripts/browser-expanded.mjs
```

- Chrome on the extracted final ZIP verified 12 skinned mesh primitives on the active nurse, the normal maps for both fabrics, and no wing rig. The actual encounter passed observation, look-away, phase change, capture, fall, blackout and lamp recovery. Classic separately passed its archive encounter, capture, recovery and bypass. These focused tests are separate from the complete route runs below and are not physical mobile verification. 138 unit tests and 107 module syntax checks passed. [Evidence](evidence/rc24/).
- Archive: 28,681,821 bytes, SHA-256 `f5fa79743c6ccafe2907dcb8c02f4e5c6ffc1f04498282d176e818aa6f47b6ae`. This package does not ship the three retired Clerk GLBs; historical releases and editable Clerk sources are retained. Not published.
- Next: continue full-asset mesh replacement with the roof edge mounts and boiler entrance machinery; the normal ending on these exact bytes, physical devices and full audiovisual sign-off are still open.

## Complete route

The exact ZIP above was extracted into a temporary local server root. These commands used separate fresh browser profiles and played from the title screen with game inputs dispatched by Chrome DevTools. The visible pass ran in the user's logged-in Aqua session and did not modify the user's own Chrome profile.

```sh
TEST_DIST="$STAGE/package" JOURNEY=complete RECORD_PLAYTHROUGH="$STAGE/recorded" node scripts/browser-3d-shortcuts.mjs
TEST_DIST="$STAGE/package" JOURNEY=complete WATCH_PLAYTHROUGH=1 QA_WIDTH=1152 QA_HEIGHT=648 node scripts/browser-3d-shortcuts.mjs
```

Both runs cleared all nine work stations and 28 transfer obstacles, collected six records and reached the complete ending with zero deaths. The transfer took 45.43 s in the recorded game and 45.45 s in the visible game. The ending and all records survived reload and a visit to Classic. See the [recorded](evidence/rc24/take1-complete-journey.json) and [visible](evidence/rc24/live-complete-journey.json) input-run receipts.

[Complete game recording](../media/LAST_LIGHT_RC24_Complete_Playthrough.mp4): 203.60 seconds, 1280×720 H.264 at 30 fps, stereo AAC from the game, not a narrated trailer. This is the separate recorded pass, not a recording of the user's desktop. Preserved title through ending; the nurse appears at about 1:07. Compositor frames (5,908) were timestamped and muxed with a 2.471-second offset to the first game audio. Reviewed sampled chapter, transfer, nurse and ending frames and decoded every frame and audio packet with FFmpeg. No public upload. Video SHA-256 `73f59db9c47a2d749171ec060d42df9d34979a7aa28ff5301a53a75ba7c9c376`.
