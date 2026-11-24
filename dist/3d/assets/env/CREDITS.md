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

The Records Annex and its fixtures are original LAST LIGHT assets, authored in Blender 4.5. Open the sixteen assemblies in `art/blender/backrooms-annex.blend` or rebuild them with `art/blender/build_backrooms.py`. The annex uses one instanced kit. The boiler steam trap, outgoing ticket case and roof rainwater hopper each have a separate GLB. The classic edition uses orthographic Cycles views of these models. Wallpaper, carpet and ceiling finish each have original colour, roughness and normal maps.
