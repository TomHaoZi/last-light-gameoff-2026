# Late Worker model and wardrobe

`late-worker.glb` is a fitted and recolored combination of the MakeHuman Team’s human character mesh, rigging, eyes, skin and clothing. The model geometry, source textures and weights are derived from these artist assets, shared under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

- Base human `hm08`, default skeleton and weights, expression/body targets and high-poly brown eyes are from [MakeHuman at a8bc2d54ff0ac92e78ff71431b1023eda42bf482](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data). See [MakeHuman Asset License](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md).
- Aged skin (`old_caucasian_male`), work clothes (`male_worksuit01`), archive suit (`male_elegantsuit01`), roof clothes (`male_casualsuit02`), shoes (`shoes04`) and teeth (`teeth_base`) are from the official [MakeHuman system assets CC0 pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html). The source assets credit Data Collection AB, Joel Palmius and Jonas Hauquier.
- LAST LIGHT fitted the body to the three outfits, normalized the rig, added localized smoke and dried-blood coloration, and compressed the original textures for a self-contained web model. The game animates the imported rig with its existing patrol, pursuit and capture state.

The runtime file can be rebuilt using `scripts/export-creature-asset.py`, a checkout of the MakeHuman data at the revision above, and the unpacked official system asset pack. This binary does not include MakeHuman application code.
