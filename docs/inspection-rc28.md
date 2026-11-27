# RC28 · Hazard outlets and collectible records

[Local preview](http://127.0.0.1:8770/) · [Standalone ZIP](../releases/last-light-3d-3.0.0-rc.28-html5.zip) · [Editable Blender source](../art/blender/inspection-rc28.blend). ZIP: 45,409,575 bytes; SHA-256 `22f2264657dde5e4efeebdc0fcc86bbaeb44d1633178beca09b9b03fed3fc495`.

## What changed

- All eight machinery tiles across the three main chapters now mount an original model. Four warm-phase grates have cast frames, captive fasteners and heat manifolds under the slats; four night-phase grates have recessed circular returns and deflectors. Each has an independent frame and visible safety casting. Neither model alters where or when the machine can hurt the player. The first archive close-up revealed an older drawing bug: its visual slab planner excluded hazard cells just because they carry phase metadata. The final package restores those permanent slabs under the grates without changing traversability. [Warm grate](evidence/rc28/heat-outlet-active.jpg) · [Night grate on the restored floor](evidence/rc28/cold-return-active.jpg)
- All six optional records use distinct assemblies with modeled paper thickness, folds, print and mounts. [Fire-control clipboard](evidence/rc28/BoilerRecord1.jpg), [brass duty card](evidence/rc28/BoilerRecord2.jpg), [archive register](evidence/rc28/OfficeRecord1.jpg), [handover book](evidence/rc28/OfficeRecord2.jpg), [roof evacuation plan](evidence/rc28/RoofRecord1.jpg), and [Gary’s maintenance note](evidence/rc28/RoofRecord2.jpg). Each room has its own stand; the roofs get spill lips. After reading, the document goes away while the stand remains, as before. English model print is illustrative: the interaction and journal still provide the full localized text.
- The editable scene contains eleven assemblies and 226 child parts, including twelve editable type objects and six non-destructively thickened sheets. At export materials are batched by assembly; the runtime instances the fixed stands and outlet meshes and keeps each record independently controllable. Rebuild with `blender -b --python-exit-code 1 -P art/blender/build_inspection_rc28.py`. [Blender reopen log](evidence/rc28/blender-source.txt)

## Exact-package checks

- `npm test`: 144 passing. `npm run check`: 115 JavaScript modules. `unzip -tq` passed.
- `TEST_DIST=<extraction> JOURNEY=complete INSPECTION_PROOF=<stills>` plus a fresh `JOURNEY=normal`: each run completed nine stations and crossed all 28 annex obstacles with zero deaths. Before/after assertions verified that all six authored record meshes replaced their stand-ins and disappeared after actual collection. Both endings survived reload and a Classic round trip. [Complete run](evidence/rc28/complete-campaign.json) · [Normal run](evidence/rc28/normal-campaign.json).
- `TEST_DIST=<extraction> ROOF_COMBAT_STILLS=<output>` preserved roof hits, banishment across phase swaps, checkpoint recovery and emulated landscape touch. It also traced English audio with Chinese interface and captions. [Roof run](evidence/rc28/roof-combat.json). A separate [Classic run](evidence/rc28/classic-english-voice.json) played the English boiler guide with Chinese interface selected.
- `TEST_DIST=<extraction> OUTLET_STILLS=<output>` confirmed all eight instances and their correct visibility after chapter-by-chapter phase switches. Actual inputs triggered hot and cold damage; waiting a complete machine cycle in the wrong phase did not remove integrity, and repeat heat discharges led to normal checkpoint revival. [Outlet results](evidence/rc28/outlets.json).

## What is not done

This batch does not close the full-map detail request. Wall/floor/ceiling junctions, roof copings and undersides, and annex crossing and fire-door trim are still open. See the [detail register](detail-register.md). Physical mobile and full audiovisual review remain outside this pass. Earlier local previews and archives are independent; there was no public upload.
