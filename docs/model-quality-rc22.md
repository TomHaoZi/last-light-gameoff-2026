# RC22 · First geometry pass (local review)

This is a partial 3D art pass, not full cinematic acceptance and not a Silent Hill model import.

## Shipped in the local ZIP

- All three main floors now draw the Blender-authored checkpoint lantern. Its radiused castings, five finish groups, bolts, glass shield and guards are geometry. The playable area and teal signal are unchanged. The old shape is visible only while the authored GLB loads or if it cannot load.
- The office phonograph has a retuned finish, modeled spinning lines, grazing practical light and no floating duplicate record label. The authored tabletop, bell, direction card, handle and stylus remain editable.
- Structural meshes add boiler pipe saddle detail, layered archive wainscoting and trim, and roof parapet metalwork and grilles. The geometry is placed on solid walls only. No platform, collision or phase rule changed. Halation was retuned without adding a fullscreen pass.

[Boiler arrival](../media/rc22-model-review/boiler-arrival.jpg) · [Archive arrival](../media/rc22-model-review/office-arrival.jpg) · [Roof arrival](../media/rc22-model-review/roof-arrival.jpg) · [Close-up of the phonograph](../media/rc22-model-review/phonograph.jpg)

## Reproduce and verify

```sh
blender -b --python-exit-code 1 -P art/blender/build_checkpoint_lamp.py
blender -b --python-exit-code 1 -P art/blender/build_office_phonograph.py
npm test
npm run check
python3 scripts/package-3d.py
STAGE=$(mktemp -d)
mkdir "$STAGE/package" "$STAGE/chapters" "$STAGE/office"
unzip -q releases/last-light-3d-3.0.0-rc.22-html5.zip -d "$STAGE/package"
TEST_DIST="$STAGE/package" CHAPTER_STILLS="$STAGE/chapters" node scripts/browser-3d-shortcuts.mjs
TEST_DIST="$STAGE/package" MOURNING=1 MOURNING_STILLS="$STAGE/office" node scripts/browser-3d-shortcuts.mjs
SERVE_DIR="$STAGE/package" ENTRY_PATH=/classic/ EVIDENCE_DIR="$STAGE/classic" node scripts/browser-check.mjs
```

- 138 tests and 107 syntax checks passed. Chrome on the **extracted final ZIP** verified five instanced lantern mesh groups on each main floor, three shortcut routes, ten timed jumps and one planned fall/revival per floor. The 3D office test verified the existing encounter, recording, regain of control after averting the camera, phase switch, contact capture and revival. Classic passed entry, phase switching, pause, resume, movement and emulated layout smoke. [Logs and Classic evidence](evidence/rc22/).
- A previous interim ZIP's fresh normal campaign attempt reached its 110-second bound without a complete result. Neither full ending, the transfer chase nor physical mobile performance were reverified for the final RC22 ZIP.
- Archive size: 30,302,885 bytes. SHA-256: `3274dfb3f66cdd63a637f45e9a0c93495e857c79d1788c20574368560eb69321`. No public upload.

## Next acceptance gate

The user confirmed the archive replacement target is the Bubble Head Nurse from the 2024 *Silent Hill 2* remake. The source asset is still pending. Keep the current encounter intact until the actual model and textures are supplied for authorized project use. Inspect scale, pivots, UVs, maps and rig before retargeting; verify idle, charge, arm contact, silhouette behind walls, phase behavior and lamp recovery in the packaged game. Do not call the existing character or an original substitute the Silent Hill model.

Continue with hands and other enemies, boiler controls and pipe joints, office furniture and walls, annex racks and barriers, roof planters/HVAC and near skyline. For each runtime model record editable source, mesh/material variant and location. Review the actual gameplay camera in both phases, including close range; model any silhouette, moving joint or visible seam that needs real geometry. Only claim whole-scene refinement after an asset-by-asset review and packaged run.
