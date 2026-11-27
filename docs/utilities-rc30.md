# RC30 · Utility runs, roof lighting, annex floor edges and distant skyline

[Local preview](http://127.0.0.1:8772/) · [Standalone HTML5 ZIP](../releases/last-light-3d-3.0.0-rc.30-html5.zip) · [Editable Blender source](../art/blender/utilities-rc30.blend).

ZIP: 45,579,961 bytes; SHA-256 `5ba016e04a6f3dcd718907f3b9dad7655943b077135d4fb760faecca0748925d`. RC24–RC29 retain their independent archived bytes and local origins. No public upload.

## Modeled details

- **Boiler pipework:** 19 wall corners turn through two modeled quarter bends with separate unions instead of intersecting at right angles. 67 open straight sections close with paired threaded plugs. 41 selected feeds rise from the trunk into flanged firestop plates, with washers, neck clamps and visible fixings. The final checked placement clears the existing ceiling beam so the flange is visible. [Curved joint](evidence/rc30/boiler-curved-union-day.jpg) · [Ceiling penetration](evidence/rc30/boiler-ceiling-insert-night.jpg).
- **Roof fixtures:** 12 general fixtures and one exit fixture have a base plinth, hold-down nuts, service hatch, roofed aluminum head, clipped gasket and fluted lens. The exit variant sits beside the approach apron rather than in front of it. Existing mechanical, checkpoint and passage rules are unchanged. [Roof head](evidence/rc30/roof-weatherproof-head-night.jpg) · [Post foot](evidence/rc30/roof-post-and-plinth-day.jpg) · [Exit approach](evidence/rc30/roof-landing.jpg).
- **Transfer floor:** permanent nosings on both ends of the 12 gaps/spans grip existing ledges, with warning inlays, traction inserts and studs. The metal carpet threshold sits on the exact boundary between carpet and concrete. Neither fitting belongs to a phase bridge or carries gameplay support. [Pit](evidence/rc30/annex-fixed-pit-nosings.jpg) · [Floor threshold](evidence/rc30/annex-carpet-threshold.jpg).
- **Distant skyline:** all 68 old box silhouettes are replaced by three normalized building assemblies with setback roofs, headhouses, coping ledges and dark window bays. The existing seeded footprints and the 48 detailed midground buildings are preserved. Tested viewpoints are sampled, not full approval for every sightline. [East in daylight](evidence/rc30/distant-city-east-day.jpg) · [West landing at night](evidence/rc30/distant-city-west-landing-night.jpg).

Open `art/blender/utilities-rc30.blend` to select ten assemblies and 187 separately editable parts. `blender -b --python-exit-code 1 -P art/blender/build_utilities_rc30.py` rebuilds the GLB. [Reopen check](evidence/rc30/blender-source.txt).

## Exact-package validation

- `npm test`: 144 passing; `npm run check`: 115 modules. `unzip -tq` passed and the preview extraction is byte-identical to the tested tree.
- `TEST_DIST=<extraction> UTILITY_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: mounted all utility families with fallbacks hidden, checked rooftop views in both phases, verified the seam and matched each visible pit edge to the permanent track coordinates; cleared all 28 obstacles. The far-city kit submits 26,208 triangles across eight batches. [Counts and route](evidence/rc30/utilities.json).
- Fresh `JOURNEY=normal` and `JOURNEY=complete` finished nine stations and 28 obstacles each with zero deaths and ending persistence through reload and a Classic round trip. The complete run also verified the visible-to-collected transition for all six modeled records and inspected all three exit aprons. [Normal](evidence/rc30/normal-campaign.json) · [Complete](evidence/rc30/complete-campaign.json).
- `TRANSFER_RECOVERY=1 TRANSFER_MISSES=1 TRANSFER_SIDE_WALL=1`: deliberate capture and two intentional falls (fixed gap and missed phase span) still led to normal checkpoint recovery. A following run completed the route and verified side-wall blocking at the exit. [Fall and recovery proof](evidence/rc30/transfer-falls.json).
- `ROOF_COMBAT_STILLS=<output>` verified roof strikes, banishment across a phase shift, checkpoint recovery, English speech with Chinese captions, and emulated touch. `CLASSIC_ENGLISH_VOICE=1` traced English boiler guidance with the Chinese interface selected. [3D](evidence/rc30/roof-combat.json) · [Classic](evidence/rc30/classic-english-voice.json).

## Scope still open

Family coverage is not a placement-by-placement sign-off. Audit less prominent corner miters, electrical trim and ceiling fixture penetrations, annex wall-material transitions and roof underside fields beyond the perimeter. Physical mobile and full audiovisual sign-off remain open. See the [detail register](detail-register.md).
