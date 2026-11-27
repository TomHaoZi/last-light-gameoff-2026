# RC25 · Geometry, roof combat and English dialogue

**Local candidate:** [`last-light-3d-3.0.0-rc.25-html5.zip`](../releases/last-light-3d-3.0.0-rc.25-html5.zip), 36,693,291 bytes, SHA-256 `02fa6671e322ab95c32f6a9720535a718abede109d4d2f85ec2651ddfa7be3f0`. Extract and serve the root `index.html` over local HTTP; Classic is linked from the title. No public upload. The RC24 preview on port 8766 and its release ZIP were not touched. The RC25 preview is on `http://127.0.0.1:8767/`, where the browser uses a separate save origin.

## Models and placement

Four CC0 models were downloaded from Poly Haven, checked against the published size and checksum for each file, and repacked into self-contained GLBs without reducing geometry or re-encoding the 1K PBR maps. The standalone build does not need Poly Haven or an internet connection. See [artist credits and source links](../dist/3d/assets/env/CREDITS.md). The editable [Poly Haven library](../art/blender/polyhaven-rc25.blend) preserves separate objects, materials and embedded textures. `python3 scripts/import-polyhaven-geometry.py <scratch-dir>` can rebuild the runtime imports; `blender -b -P art/blender/open_polyhaven_rc25.py` recreates the library from the bundled GLBs.

- **Boiler arrival:** An open red tool chest with separate metal fittings sits under a wall-mounted extractor. The original [Blender assembly](../art/blender/boiler-arrival-extractor.blend) gives the extractor a cast housing, bolts, a welded concentric guard, a separate hub and six curved, pitched blades. It replaces the five flat bars at the first crossing. The rotor turns behind the fixed guard and changes speed by phase. The handover sign moved to the opposite wall bay rather than intersecting the vent. [Day](evidence/rc25/boiler-tool-chest-and-extractor-day.jpg) · [Night](evidence/rc25/boiler-tool-chest-and-extractor-night.jpg).
- **Archive:** Replaced the blocky Personnel Drawers with a drawer cabinet and shelving. Moved it into the plain south wall bay so it does not overlap the register cabinet, desk or window sill. [Day](evidence/rc25/archive-drawer-cabinet-day.jpg) · [Night](evidence/rc25/archive-drawer-cabinet-night.jpg).
- **Records Annex:** Instanced worn steel shelves replace the earlier rack kit. The placement transforms keep the original opening widths and phase groups; the pursuit uses the same map collision. [In-game rack near the first bypass](evidence/rc25/annex-steel-rack.jpg).
- **3D roof:** The pipe wrench has modeled teeth, worm thread and shaft. The hand has a dedicated Blender grip shape; the tool moves with the wrist through wind-up, sweep and recoil. [Stagger](evidence/rc25/roof-stagger.jpg) · [Banishment](evidence/rc25/roof-banished.jpg).

## Combat and speech

Only the 3D roof gets melee. **Left-click / F** (keyboard binding can be changed) or tap **Strike**. Each swing checks aim, line of sight, target range, current phase and active floor at contact. Story / Standard / Nightmare require one / two / three successful hits. Banishment persists through phase changes, but resets when reviving or reloading. Other chapters, Classic and save schemas are unchanged. The existing audio mix now has separate swing, contact and banishment sounds.

English is the only spoken language in 3D and Classic. Selecting Chinese changes UI and subtitles where available, not which audio is decoded. The five historical Mandarin tracks are omitted from the ZIP. Human voice and synthetic guidance sources remain identified in [dialogue credits](../dist/3d/assets/dialogue/CREDITS.md). [Chinese subtitles with English playback](evidence/rc25/roof-english-voice-chinese-captions.jpg).

## Verification of the extracted ZIP

- `npm test`: 144 passing, including contact timing/range/visibility, difficulty, phase switching, no save schema changes, English-with-Chinese captions, and legacy keyboard binding preservation. `npm run check`: 110 JavaScript modules checked.
- `TEST_DIST=<extraction> IMPORTED_MODEL_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: real camera inspection in both phases of boiler and archive; mesh, material and moving rotor assertions; all 28 annex obstacles crossed with the new rack instances. [Run data](evidence/rc25/imported-models.json).
- `TEST_DIST=<extraction> ROOF_COMBAT_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: real keyboard miss and stagger, mouse banishment, phase persistence, deliberate fall and recovery at the saved roof lamp, and a strike from Chrome's emulated landscape touch control. The test traced the English roof AAC from fetch and decode to playback while Chinese captions were on screen. [Run data](evidence/rc25/roof-combat.json) · [Touch layout](evidence/rc25/roof-touch.jpg).
- `TEST_DIST=<extraction> CLASSIC_ENGLISH_VOICE=1 node scripts/browser-3d-shortcuts.mjs`: the English boiler guide started with the Classic UI set to Chinese. [Run data](evidence/rc25/classic-english-voice.json).
- `TEST_DIST=<extraction> JOURNEY=complete|normal node scripts/browser-3d-shortcuts.mjs` (two fresh profiles): all nine stations and 28 annex obstacles on both paths, six journal entries and auxiliary roof power on the complete path, zero deaths on either. Each ending persisted after refresh and after visiting Classic and returning. [Complete run](evidence/rc25/complete-campaign.json) · [Normal run](evidence/rc25/normal-campaign.json).

## Work remaining

This is one batch, not a whole-game art acceptance. Next visible targets: boiler distribution manifolds and pressure hardware, office desks and archival equipment that still use generic props, annex barriers and carts, roof edge planter mounts and near skyline. Choose appropriately licensed sources per item and keep the campaign route and phase geometry unchanged. Physical mobile testing and a full audiovisual pass remain open.
