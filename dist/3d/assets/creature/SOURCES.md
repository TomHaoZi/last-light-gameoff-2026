# Late Worker model and wardrobe

`late-worker.glb` is a fitted and recolored combination of the MakeHuman Team’s human character mesh, rigging, eyes, skin and clothing. The model geometry, source textures and weights are derived from these artist assets, shared under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- Base human `hm08`, default skeleton and weights, expression/body targets and high-poly brown eyes are from [MakeHuman at a8bc2d54ff0ac92e78ff71431b1023eda42bf482](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data). See [MakeHuman Asset License](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md).
- Aged skin (`old_caucasian_male`), work clothes (`male_worksuit01`), archive suit (`male_elegantsuit01`), roof clothes (`male_casualsuit02`), shoes (`shoes04`) and teeth (`teeth_base`) are from the official [MakeHuman system assets CC0 pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html). The source assets credit Data Collection AB, Joel Palmius and Jonas Hauquier.
- LAST LIGHT fitted the three original outfits, projected soot and old stains onto their texture charts, and normalized the skeleton. Blender 4.5.16 LTS was used to resculpt cheekbones, temples, lips, throat and cloth folds, and to model a caged helmet lamp, broken glasses, an archive badge, ear defenders, a respirator and its harness. Photographic skin carries new wound, bruise, vein, stubble and grime treatment. The three jobs have distinct facial asymmetry and teeth. The game's pursuit and contact poses animate the brows, eyelids, upper lips, cheeks, jaw, eyes and fingers.

The editable Blender cast is in `art/blender/late-workers.blend`. Each dressed figure has its own armature object. The file also contains the original fitting curves, sculpture shape keys, a studio camera and lights. Project-authored additions use the repository license.

The final makeup pass paints separate temple, mouth and ear wounds in reserved areas of the shared skin atlas. Oxidized trails follow gravity into individual collar, suspender and sleeve stains. The models keep their existing animation rig.

To reproduce the runtime asset, extract `assets/creature/late-worker.glb` from the rc.13 HTML5 package or use `dist/3d/assets/creature/late-worker.glb` from Git commit `d4a8669fea72197f8cad11cccdd7954f3cfc3e29`. The fitted input has SHA-256 `65493fd04d6043bf0fa713e5bc9ba687988dc8c3e3893fdba86f2bfa251f04ae`. It can also be authored from the MakeHuman data and system assets above with `scripts/export-creature-asset.py`.

Run from the repository root, with the input stored outside the destination directory.

```sh
blender -b --python-exit-code 1 -P scripts/blender/build-late-workers.py -- \
    /path/to/rc13-late-worker.glb dist/3d/assets/creature/late-worker.glb \
    art/blender/late-workers.blend
```
