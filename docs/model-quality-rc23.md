# RC23 · Roof garden asset replacement

Three editable assemblies in [`roof-garden.blend`](../art/blender/roof-garden.blend) replace the entrance herb bed, the repeated portable nursery boxes (13 instances), and the wall-mounted greenhouse irrigation header. The bed has a continuous outside/inside trough with a rolled return, raised fittings, drip pipe, rough soil, curved leaves, distinct stems and midribs. The portable box has pressed ribs, seams and rivets modeled into the mesh. The header has pipe elbows, union fittings, a gasketed pressed panel, rolled wheel grip and spokes. The header is scenery; the gameplay valve still uses its existing work station and timing. Old scenery meshes are hidden after successful load and otherwise remain the failure fallback. All placements preserve the original gameplay grid.

[Bed day](../media/rc23-model-review/roof-bed-day.jpg) · [Bed night](../media/rc23-model-review/roof-bed-night.jpg) · [Header day](../media/rc23-model-review/roof-header-day.jpg) · [Header night](../media/rc23-model-review/roof-header-night.jpg)

```sh
blender -b --python-exit-code 1 -P art/blender/build_roof_garden.py
npm test
npm run check
python3 scripts/package-3d.py
STAGE=$(mktemp -d)
mkdir "$STAGE/package" "$STAGE/stills"
unzip -q releases/last-light-3d-3.0.0-rc.23-html5.zip -d "$STAGE/package"
TEST_DIST="$STAGE/package" ROOF_GARDEN_STILLS="$STAGE/stills" node scripts/browser-3d-shortcuts.mjs
TEST_DIST="$STAGE/package" CHAPTER_STILLS="$STAGE/stills" node scripts/browser-3d-shortcuts.mjs
```

Chrome on the exact extracted ZIP checked all three mesh replacements and their hidden fallbacks. The keyboard/mouse review approached the bed and header in both phases, using the east lane on the night bridge and switching to day on the greenhouse deck; zero deaths. A separate regression run cleared ten shortcut jumps after one planned fall and lamp reset per main floor. The 138-test suite passed on a quiet rerun: the first attempt run alongside Chrome hit a pre-existing `OfflineAudioContext.suspend` error; there was no audio code change. Syntax checked 107 modules. [Evidence](evidence/rc23/). These are not full campaign or physical-mobile verification.

The ZIP is 31,484,765 bytes. SHA-256 `b9717215bda5ded49706f9c07bf2e01895311f773b130386243ca35323bf1344`. It has not been published.

## Pending

The 2024 *Silent Hill 2* remake's Bubble Head Nurse is the target. In a bounded online search, official pages were inaccessible, the Models Resource search was gated, and the Sketchfab API returned a 2020 fan redesign, a 2019 fan project and a downloadable May 2024 listing labeled only “Silent Hill 2”, without proof it is the remake model or that its uploader can license Konami's original asset. No verified exact source was found and no third-party model was bundled. The existing Clerk stays in this ZIP; do not treat another edition or fan sculpt as the requested asset.

Next geometry work: edge planter mounts and supports (visible in the roof bed shots), skyline close buildings, the boiler arrival fan/guard and pressure equipment, the archive furniture set, and annex racks/barriers. Record source and check close views in both phases. A complete asset-by-asset replacement, full campaign test and cinema-quality sign-off remain pending.
