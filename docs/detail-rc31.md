# RC31 · Electrical fixtures, roof underside panels, and annex seams

[Local preview](http://127.0.0.1:8773/) · [Standalone HTML5 ZIP](../releases/last-light-3d-3.0.0-rc.31-html5.zip) · [Editable Blender source](../art/blender/detail-rc31.blend).

ZIP: 45,645,277 bytes; SHA-256 `63239bde79717503e999808ee21b61a252beaa95bf5834bc3580e58bfa221f16`. RC24–RC30 keep their previous load URLs and archives. No public upload.

## What changed

- **Boiler:** 49 mounted switch assemblies use a recessed rocker, pilot lens, machined plate, gasket and slotted screws. 51 ceiling joists use shaped flanges, splices and anchor shoes. The 13 work lights and exit fixture have modeled glass ribs, guard straps, hinge barrels and stand-offs, with their original light/cue positions. [Switch close-up](evidence/rc31/boiler-control-plate-day.jpg) · [Ceiling fixture and joists](evidence/rc31/boiler-lamp-mount-day.jpg).
- **Archive:** 29 ceramic socket assemblies with recessed contacts; 66 modeled ceiling joists; 20 pairs of suspension tubes and their ceiling plates above the existing period fluorescent fixtures. Worn lamps remain worn; fittings are scenery, not new switches or tasks. [Socket](evidence/rc31/archive-socket-day.jpg) · [Fluorescent hanger](evidence/rc31/archive-hanger-night.jpg).
- **Roof:** six weather vent covers with folded blades and captive fasteners. Under all 184 permanent deck tiles, a precast field panel has two downstand ribs, plates and anchors. Mounts only in the permanent shell. The lowest field details are shielded by the perimeter fascia from most normal eye-level positions, so below-deck geometry inspection is separate from the real camera fall screenshot. [Roof cover](evidence/rc31/roof-service-cover-day.jpg) · [Actual edge during a fall](evidence/rc31/roof-edge-during-fall.jpg).
- **Transfer floor:** formed vertical joint extrusions bridge changes in wall material and recess returns. All six phase platforms gain four bolted corner fittings each, in the same phase groups as their decks, not on the permanent pit edge. [Wall material boundary](evidence/rc31/annex-wall-seam.jpg) · [Inactive platform](evidence/rc31/annex-bridge-corners-hidden.jpg) · [Active platform](evidence/rc31/annex-bridge-corners-active.jpg).

`art/blender/detail-rc31.blend` retains 11 assembly roots and 130 editable parts. Rebuild with `blender -b --python-exit-code 1 -P art/blender/build_detail_rc31.py`. [Source reopen](evidence/rc31/blender-source.txt).

## Exact-package verification

- `npm test`: 144 passing. `npm run check`: 115 modules. `unzip -tq` passed; preview extraction matches the tested tree.
- `TEST_DIST=<extraction> DETAIL_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: verified socket mount counts and fallbacks, visually sampled both phases, checked the annex bridge fitting parent's visibility during an actual airborne flip, and cleared all 28 obstacles. Read-only upward ray tests on the mounted runtime meshes found a distinct downstand on each of 184 roof slabs and no neutral soffits under any of the 32 phase tiles. The real-camera roof fall still registered as a fall and revived at the checkpoint. [Mesh and play results](evidence/rc31/details.json).
- `TRANSFER_RECOVERY=1 TRANSFER_MISSES=1 TRANSFER_SIDE_WALL=1`: deliberate capture and missed fixed/phase gaps retained the original failure and revival behavior, then the clean follow-up run passed door-side collision and finished all 28 obstacles. [Transfer recovery](evidence/rc31/transfer-falls.json).
- Fresh `JOURNEY=normal` and `JOURNEY=complete` runs each completed nine stations and 28 transfer obstacles with zero deaths. Six records on the complete path, none on the normal path, and both endings survived reload and a Classic round trip. [Normal](evidence/rc31/normal-campaign.json) · [Complete](evidence/rc31/complete-campaign.json).
- `ROOF_COMBAT_STILLS=<output>` retained roof-only strikes, phase persistence, checkpoint recovery, English voice with Chinese captions and Chrome-emulated landscape touch. `CLASSIC_ENGLISH_VOICE=1` played the English guide with Chinese interface selected. [3D](evidence/rc31/roof-combat.json) · [Classic](evidence/rc31/classic-english-voice.json).

## Scope still open

Covered families are not a full placement-by-placement approval. Remaining art review includes how fittings meet old furniture and trim, imperfect casing/wall joins, carpet stitching, and the entire reachable skyline/phase perimeter under oblique views. See [detail register](detail-register.md). Physical touch and full audiovisual review remain open.
