# Environment model credits

Poly Haven makes these six models available for modification and redistribution under Creative Commons CC0 1.0. [Poly Haven asset license](https://polyhaven.com/license) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

- `compressor.glb` is Brian Speight’s Old Military Compressor. [Source model](https://polyhaven.com/a/old_military_compressor)
- `fire-alarm.glb` is Slinc’s Fire Alarm. [Source model](https://polyhaven.com/a/fire_alarm)
- `records-desk.glb` is Ulan Cabanilla’s Metal Office Desk. [Source model](https://polyhaven.com/a/metal_office_desk)
- `dispatch-radio.glb` is Mateusz Sadek’s Vintage Radio Transceiver. [Source model](https://polyhaven.com/a/vintage_radio_transceiver)
- `records-lamp.glb` is Desk Lamp Arm 01 by Kuutti Siitonen and Yann Kervran. [Source model](https://polyhaven.com/a/desk_lamp_arm_01)
- `roof-condenser.glb` is the weathered variant of Monsta3D’s Exterior Aircon Unit. [Source model](https://polyhaven.com/a/exterior_aircon_unit)

The game bundles resized PBR textures inside each GLB and simplifies the compressor, radio and lamp meshes for browser performance.

The folding steel service lift is an original LAST LIGHT model. Rebuild its landing, inspection gates, cab and deadbolts using Blender 4.5 and `art/blender/build_service_lift.py`.

The pressure gauge, punch clock and rooftop flow meter are original Blender models. Rebuild the three moving instruments with `art/blender/build_workstation_models.py`.

The Records Annex and its fixtures are original LAST LIGHT assets, authored in Blender 4.5. Open the twenty-three assemblies in `art/blender/backrooms-annex.blend` or rebuild them with `art/blender/build_backrooms.py`. The annex uses one instanced kit, including the cast-concrete slabs, tiled return-air gallery, bolt-joined portal beam, rotating extractor and amber stairwell fixtures. The boiler steam trap, outgoing ticket case and roof rainwater hopper each have a separate GLB. The classic edition uses orthographic Cycles views of these models. Wallpaper, carpet, ceiling finish and cast concrete each have original colour, roughness and normal maps.


The archive phonograph is an original LAST LIGHT prop. The spun brass bell, shellac grooves and desk notice are modeled in `art/blender/office-phonograph.blend`.

The archive kit is an original LAST LIGHT scene, authored in Blender 4.5. It includes a chamfered floor slab, two recessed fluorescent fittings, a red fire bulkhead, a steel register cabinet, a return grille, a cast floor drain and curled ledger sheets. Open `art/blender/archive-interior.blend` or rebuild it with `art/blender/build_archive_interior.py`. In the game, the kit instances share source geometry. Its ceramic and plaster scans are credited in the surfaces directory.

## RC21 pressure and roof sets

`boiler-plant.glb` and `roof-plant.glb` contain original Blender geometry, including the B2 gauge bank, pipe return, caged lamps, pressure gantry and sump grates, plus the RAIN 03 tanks, zinc glazing, guarded intake and its impeller, rain scuppers and raised beds. Placement and contact areas were authored against the current game tiles. Each assembly's static parts share one material, with a second emissive primitive for cages that have powered lenses.

The painted-metal atlas incorporates [Metal Plate 02 by Amal Kumar, Poly Haven](https://polyhaven.com/a/metal_plate_02) under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Its diffuse, GL normal and ARM maps were recolored, resampled and packed with individual wear levels for each finish. The GLBs include the resulting atlas.

The editable source is `art/blender/pressure-and-roof.blend`. The builder takes the three 1K JPEG maps from Poly Haven in a local directory.

```sh
blender -b --python-exit-code 1 -P art/blender/build_plant_sets.py -- /path/to/metal-plate-maps
```
