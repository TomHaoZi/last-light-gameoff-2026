# RC27 · Close-up architectural geometry

[Local preview](http://127.0.0.1:8769/) · [Standalone HTML5 ZIP](../releases/last-light-3d-3.0.0-rc.27-html5.zip) · [Editable Blender kit](../art/blender/architecture-rc27.blend). Package size: 45,270,865 bytes; SHA-256 `845477bb07e1366fa3c0bba5f21705e88e522d5f0afab5b4299d36894b6d1d54`. Prior preview ports and the RC24–RC26 ZIP hashes are unchanged. No public upload.

## Replacements

- **Boiler room:** 35 seven-blade louvres with recessed carriers, folded leading edges and hex fasteners; 160 two-piece pipe saddles with clamping lugs and wall plates; 39 tee and socket-union sets. [Vent in daylight](evidence/rc27/boiler-vent-day.jpg) · [Vent at night](evidence/rc27/boiler-vent-night.jpg) · [Pipe union](evidence/rc27/boiler-pipe-union-night.jpg)
- **Archive:** 42 window assemblies with individual sashes, meeting stiles, latch keepers, and projecting sills. 17 wall-door assemblies with casing rebates, three hinges, recessed glazing, lock and return lever. These are surface-mounted on unchanged walls; they do not add new routes or change interactable exits. [Day](evidence/rc27/archive-sash-and-door-day.jpg) · [Night](evidence/rc27/archive-sash-and-door-night.jpg)
- **Transfer floor:** 12 pits (six permanent gaps and six phase spans) have individual precast panels, tie plates and top ledgers placed below the edge. The render window still culls distant shaft instances. [Pit during a real jump approach](evidence/rc27/annex-shaft-lining.jpg)
- **Roof:** 155 fascia segments now have a drip edge, folded membrane return, lower chord, stiffeners and bolted cleats. The permanent shell does not extend a traversable surface into the void. [Day](evidence/rc27/roof-fascia-day.jpg) · [Night](evidence/rc27/roof-fascia-night.jpg)
- **Phase platforms throughout the three main chapters:** 81 tiles use profiled tread channels, raised anti-slip stamps, cross bearers and flush fasteners. The stage phase groups drive replacement and fallback visibility; the gameplay map still owns support and collision. The old glowing markers stay to communicate traversability. [Night bridge close-up](evidence/rc27/roof-bridge-close-night.jpg)

The new pieces are original geometry built for LAST LIGHT's wall and platform sockets, not downloaded replicas. Earlier licensed Poly Haven props remain credited. The Blender source retains 302 separate meshed parts beneath nine assembly roots, with selectable materials and editable edge breaks. The runtime combines by finish and uses instances. Rebuild with `blender -b --python-exit-code 1 -P art/blender/build_architecture_rc27.py`. [Source reopen check](evidence/rc27/blender-source.txt).

## Acceptance of this batch

- `npm test`: 144 passing. `npm run check`: 114 modules checked. ZIP extraction and integrity check passed.
- `TEST_DIST=<extraction> ARCHITECTURE_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: checked that each kit and each tile count mounted on the correct group, checked actual phase swaps, inspected both phases through real input, and cleared all 28 transfer obstacles. [Instance counts and route results](evidence/rc27/architecture.json).
- `TEST_DIST=<extraction> ROOF_COMBAT_STILLS=<output> node scripts/browser-3d-shortcuts.mjs`: keyboard and mouse combat, phase persistence, checkpoint recovery, and Chrome-emulated landscape touch passed. English roof dialogue played with Chinese UI and captions. [Combat run results](evidence/rc27/roof-combat.json). The [Classic voice test](evidence/rc27/classic-english-voice.json) also decoded and played the English boiler guide with a Chinese interface.
- `TEST_DIST=<extraction> JOURNEY=complete` / `JOURNEY=normal`: two fresh Chrome profiles completed all nine stations and 28 transfer obstacles without dying. The complete path found six records; the normal path left them unread. Both endings survived reload and the Classic round trip. [Complete](evidence/rc27/complete-campaign.json) · [Normal](evidence/rc27/normal-campaign.json).

## Full-detail sign-off is still open

Use the [detail register](detail-register.md) to track the remaining families. This release does not assert that every object, material, junction, or placement has had its close-up review. Physical mobile and full audiovisual checks are still separate.
