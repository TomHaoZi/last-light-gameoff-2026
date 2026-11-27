# RC35 · City streets and straight fascia joins

[Play locally](http://127.0.0.1:8777/). Exact package: `releases/last-light-3d-3.0.0-rc.35-html5.zip`, 45,813,020 bytes; SHA-256 `3f716175a9204e71784312ccd98c560ac06338a1ff986b0eccb4fa4c3952294d`. RC34 remains on 8776; older ZIPs and their save origins are unchanged. Nothing was published.

## What changed

- The downward skyline no longer ends at a flat color field. One ring boulevard connects 72 grid road segments, 44 junctions and 50 gateways/service drives. There are 29 raised lots (15 low-rise buildings, eight service yards, six planted squares), 58 streetlights, and foundations aligned to all 116 existing tower sites. The original near/far tower placement and gameplay maps were not moved. The new city mesh reaches no higher than −17.77 m relative to the roof: render-only, not support or a route. The grade fallback stays visible if the city file fails. The city kit adds 35 instanced material batches / 93,720 submitted triangles when all are drawn (not a mobile performance benchmark).
- All 112 straight roof fascia/soffit junctions between neighboring permanent slabs now have a lap over the drip, a compression plate and a lower return. The 25 convex fittings from RC34 remain in place. Neither the new splices nor the city geometry adds support or outlines an inactive deck.
- Editable assets: `art/blender/city-ground-rc35.blend` (12 assemblies, 242 parts) and `art/blender/roof-splices-rc35.blend` (18 parts), with builders beside them.

## Exact-package evidence

Independent Chrome extraction: `/tmp/ll-rc35-release.Jb68Cl/site`. `npm test` passed 146 tests; `npm run check` checked 117 modules; `unzip -tq` and `diff -qr` verified the final ZIP and the separate preview. See [`evidence/rc35/`](evidence/rc35/).

- The keyboard route reached south `(15,17)`, west `(1,10)`, and east `(24,5)` and captured each in both phases. RC34 comparisons use the same real-input route. Not every skyline angle was photographed. Mounted instance bounds, 116 foundation centers, and all 12 city asset families were checked. A forced `404` for the city GLB preserved the grade fallback and the roof remained playable.
- Mesh rays hit the correct metal at all 336 straight-joint samples and all 150 corner samples. The three nearest phase decks still have geometry only in their own phase. Real input at `(22,2)` fell through the inactive roof edge and revived at the original checkpoint. Under-edge photos use the render-only camera; street photos are actual player views.
- The map mount audit checked all planned placements from each architecture-kit collection: 667 boiler / 351 archive / 1,300 roof, across 54 floor-family entries. The transfer run also verified its authored set and 34 named instance groups. This establishes mount/phase ownership, not visual acceptance of every small prop or every angle.
- Both endings were replayed with ordinary inputs from clean profiles: nine stations and 28 annex obstacles each, zero deaths, six versus zero records. The results persisted through reload and a Classic round trip. Deliberate annex capture, fixed and phase-gap falls, revival and terminal side-wall blocking passed separately. Roof wrench combat, checkpoint reset and Chrome touch emulation passed. Both editions played English narration with Chinese UI; the narration is synthetic.

Reproduce with `TEST_DIST` pointing at the extraction and `node scripts/browser-3d-shortcuts.mjs`: `ASSERT_CITY_GROUND=1 CITY_SIGHTLINES=…`, `CITY_GROUND_MISSING=1 CITY_SIGHTLINES=…`, `ASSERT_ROOF_CORNERS=1 ASSERT_ROOF_SPLICES=1 ROOF_CORNER_FALL=1 ROOF_CORNER_STILLS=…`, `MAP_MOUNT_INVENTORY=…`, `JOURNEY=complete|normal`, `ROOF_COMBAT_STILLS=…`, `CLASSIC_ENGLISH_VOICE=1`, and `TRANSFER_RECOVERY=1 TRANSFER_MISSES=1 TRANSFER_SIDE_WALL=1`.

**Acceptance boundary:** The desktop routes and the listed geometry pass are complete. Whole-map visual close-up acceptance at every individual placement, physical phone/tablet touch, and full audiovisual listening are not complete. The remaining visual families and access checks are tracked in [`detail-register.md`](detail-register.md).
