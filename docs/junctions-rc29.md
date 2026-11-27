# RC29 · Junctions, landing thresholds and roof returns

[Local preview](http://127.0.0.1:8771/) · [Standalone HTML5 ZIP](../releases/last-light-3d-3.0.0-rc.29-html5.zip) · [Editable Blender kit](../art/blender/junctions-rc29.blend).

ZIP: 45,505,431 bytes; SHA-256 `7978e693e08af6f150df004173b7e71cec56894f384b091f496826a88c56f8a0`. RC24–RC28 are on separate local ports and in untouched archives. No public upload.

## What changed

- Main interiors: each exposed boiler and archive wall bay gets a coved skirting and a stepped crown, with lap joints, toe seals and fixings. The floor and physical wall planes stay where they were. [Boiler crown](evidence/rc29/boiler-crown-day.jpg) · [Archive skirting](evidence/rc29/archive-skirting-day.jpg).
- Roof: exposed parapet tiles get bedding panels, hemmed flashing, riveted seams and folded convex corners. Steel angles and tapered corbels connect the lower soffit margin to the permanent edge. The first version hid these details behind the existing fascia; the final kit puts the connection beneath the existing lower chord. Ordinary permanent hazard tiles no longer get mistaken for absent phase-bridge tiles when planning adjacent fascia. [Day corner](evidence/rc29/roof-coping-day.jpg) · [Night corner](evidence/rc29/roof-coping-night.jpg) · [Lower return](evidence/rc29/roof-soffit-day.jpg).
- Landings: approach aprons add pressed slopes, traction strips and jamb shoes in front of the three existing service gates. The moving lift leaves and their grooved tracks are untouched. [Boiler](evidence/rc29/boiler-landing.jpg) · [Archive](evidence/rc29/archive-landing.jpg) · [Roof](evidence/rc29/roof-landing.jpg).
- Transfer floor: each permanent side bay and closed recess return gets a wall cove and crown. The terminal fire opening gets folded jambs, heel reinforcements, strike and hinge plates, smoke seals and a separate nonmoving threshold. The original animated door leaf, its hinge transform and simulation collision remain in charge. [Wall/ceiling join](evidence/rc29/annex-cove-and-crown.jpg) · [Closed](evidence/rc29/annex-door-closed.jpg) · [Open](evidence/rc29/annex-door-open.jpg).
- Eleven Blender roots hold 107 editable parts with vertex wear and non-destructive edge breaks. Rebuild with `blender -b --python-exit-code 1 -P art/blender/build_junctions_rc29.py`. [Reopen evidence](evidence/rc29/blender-source.txt).

## Exact-package validation

- `npm test`: 144 passing. `npm run check`: 115 modules. `unzip -tq` passed, and the preview extraction is byte-identical to the tested tree.
- `TEST_DIST=<extraction> JUNCTION_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: 160 boiler and 160 archive junctions; 18 roof runs, eight corners, eight beds and 140 soffit edges; three lift aprons. Transfer instances followed their existing render window. Cleared all 28 transfer obstacles, verified the side wall still blocks the runner, and observed the fire leaf basis rotate while the casing and sill stayed fixed. [Counts, matrices and route results](evidence/rc29/junctions.json).
- Fresh `JOURNEY=normal` and `JOURNEY=complete` profiles finished all nine stations and 28 obstacles with no deaths; both endings survived reload and the Classic round trip. The complete route also passed with `LANDING_STILLS` enabled at each gate. [Normal](evidence/rc29/normal-campaign.json) · [Complete](evidence/rc29/complete-campaign.json) · [Landing route](evidence/rc29/landing-campaign.json).
- `TRANSFER_RECOVERY=1 TRANSFER_PROFILE=1`: deliberately waited for capture, revived, and cleared the route. The transfer render callback sampled 2,726 frames at 1280×720 on the Chrome/Apple M4 test machine (p95 16.7 ms); this is one desk test, not a mobile performance claim. [Recovery and frame timings](evidence/rc29/transfer-recovery.json).
- `ROOF_COMBAT_STILLS=<output>` passed roof controls, phase persistence, checkpoint revival, and Chrome-emulated landscape touch. English audio with Chinese captions remains supported. `CLASSIC_ENGLISH_VOICE=1` also played the English boiler guide with the Classic interface set to Chinese. [Roof](evidence/rc29/roof-combat.json) · [Classic](evidence/rc29/classic-english-voice.json).

## Remaining close-up work

This is an architectural pass, not final sign-off for every visible asset. Next audit interior pipe elbows and ceiling penetrations, transfer pit nosings and carpet seams, roof fixtures and distant skyline, and then perform a placement-by-placement walkthrough. Some distant atmospheric towers are still deliberately coarse. Physical mobile and full audiovisual review remain open. See the [detail register](detail-register.md).
