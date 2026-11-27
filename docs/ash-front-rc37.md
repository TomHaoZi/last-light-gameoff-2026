# RC37 · Ash Front

Local preview: http://127.0.0.1:8779/. ZIP: `releases/last-light-3d-3.0.0-rc.37-html5.zip` (60,141,971 bytes, SHA-256 `78d284fa11375aeef13318151620ec6a964c547101712f54103e73bcd2452bf3`). Not published.

- **Roof:** A procedural cloud bank hangs above a narrow amber horizon before the fire; after the fire, dense cold clouds and weaker broad fill make figures and lit windows stand out. Active span edges, practical fittings and the player's light retain their roles. Reduced effects freeze the sky animation. No changes to floor support, routes, stations, evidence, or exit requirements.
- **Worker apparitions:** A shared presentation blend uses alert, distance, attack and stagger. Listening cocks the head, lifts the brow and suppresses breath; closing changes the shoulder carry and cadence; bracing twists the chest and bares more teeth; recoil folds the arm and closes the lids. The changes reuse existing spatial voice/foley assets and do not adjust detection, damage, or enemy count. The Mourning Clerk's bespoke animation and Annex chase were not reauthored.
- **Play in Mobile:** Choose **Layout** in play. Drag the round joystick or any action, then adjust its size; Save applies it to the current orientation, Cancel discards edits, and Reset restores that orientation's defaults. Gameplay is paused while editing. The HUD profile is separate from checkpoint saves. The 2D HUD is unchanged.

## Verification

- `npm test` (150), `npm run check` (121 modules), `python3 scripts/package-3d.py`, and `unzip -tq` passed. Tested from independent extraction `/tmp/ll-rc37-ash.qtvsWQ/site`; `diff -qr` matched the preview, and HTTP served the same `visual.js` hash.
- `TEST_DIST=<extract> JOURNEY=complete|normal node scripts/browser-3d-shortcuts.mjs`: separate Chrome profiles followed both full routes with real inputs and zero deaths. Six vs zero records; both endings reopened after save and Classic round trip.
- `CITY_SIGHTLINES`, `ROOF_GARDEN_STILLS`, `ROOF_COMBAT_STILLS`, and `CLASSIC_ENGLISH_VOICE=1` passed: both rooftop phases, keyboard and mouse combat, stagger/banishment, phase persistence, checkpoint fall/recovery, dedicated touch Strike, and English playback with Chinese interface/captions where applicable. The garden helper required an existing screenshot directory and passed after it was created.
- `MOBILE_HUD_PROOF=<folder>` verified round hit targets, drag and resize, simultaneous joystick and jump, reload, orientation isolation, cancel and reset in Chrome touch emulation. Independent `MOBILE_SWIPE_PROBE=1` did **not** verify free-look: dispatched touches on the canvas produced no observed yaw in this run. Do not claim touch-look acceptance. Physical phone/tablet checks and full audio listening remain open.
- Screens from played routes: [`evidence/rc37/`](evidence/rc37/), including roof garden before/after the in-game phase switch and an actual stagger. These are samples, not whole-map art approval.

Next: reproduce canvas swipe on a physical device and compare against RC36; redesign the roof route to reduce mandatory detours; extend the creature pass to all remaining actors and review the final mix by ear.
