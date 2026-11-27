# RC36 · Five fitted Poly Haven models

[Play locally](http://127.0.0.1:8778/). Exact package: `releases/last-light-3d-3.0.0-rc.36-html5.zip`, 60,135,922 bytes, SHA-256 `a44bf147613c3ab59ceb640169464bcc6b6660b90855ae97cbca7aa97cbf879b`. RC35 stays on 8777. No public upload, old ZIP change, or save change.

Online imports were downloaded concurrently from the official [Poly Haven](https://polyhaven.com/license) endpoints, using the advertised lengths and MD5 for each binary and image. All are CC0 1.0; original component geometry and embedded 1K PBR maps retained. Credits and file-to-asset links are in `dist/3d/assets/env/CREDITS.md`. [`evidence/rc36/`](evidence/rc36/) carries upstream manifests, local GLB hashes and comparison captures. The editable Blender library is `art/blender/polyhaven-rc36.blend`, built by `art/blender/open_polyhaven_rc36.py`. It includes packed texture maps.

- **Boiler and archive:** two Portable Generators on open service-wall bays and one Utility Box 01. The office box replaces a redundant decorative door surround, rather than burying the functional-looking box in trim. Neither model is a new simulated switch.
- **Roof:** two Garden Hose Wall Mounted 01 assemblies near beds/tower masonry. The first was relocated to the opposite face after comparison showed it covering the simulated irrigation hardware.
- **Annex:** four rusted Metal Trash Cans (open can, separate lid and handles) and eight Korean Fire Extinguisher 01 assemblies in tiled service bays. Adjusted the cans forward of the rear pipe run and raised the extinguishers above it after the first review. Geometry bounds for all twelve items clear the corridor by at least 0.59 m. Their positions deliberately do not affect pursuit/collision. The main-floor props have cheap fallbacks; missing Annex additions simply do not draw.

## Exact-package checks

Independent Chrome extraction `/tmp/ll-rc36-final.7s077e/site`; `npm test` 146 passed; `npm run check` 117 modules; ZIP integrity and preview byte comparison passed. `SERVICE_MODELS` confirmed original maps mounted at all five main-floor positions and inspected all twelve Annex bounds across the render window. The first generator photo was walked and framed with controls; matched day/night comparisons and detailed service-bay views use a render-only camera, not reachable-player claims.

Both fresh exact-package campaigns passed with zero deaths: nine stations and 28 Annex obstacles each, six versus zero records. Reload and the Classic round trip retained completion. Deliberate Annex capture, fixed/phase-gap falls, revival and terminal side-wall blocking passed. The exact-package transfer profile measured 16.7 ms p95 on desktop Apple M4 Chrome at 1280×720; no physical-device performance claim. Roof combat, checkpoint reset, and emulated touch passed. Both editions played English recordings with Chinese UI; narration is synthetic.

The added models increase the ZIP by about 14.3 MB. For the next online wave, prioritize overlaps and direct close-up needs over repeating decoration. Candidates with catalog metadata: `power_box_01`, `industrial_pipe_lamp`, `small_oil_can_01` and `ladder_sectioned_01`; verify source bounds and license before importing, and profile model/texture size. Physical touch, full AV sign-off, and the whole-map visual placement queue remain open.
