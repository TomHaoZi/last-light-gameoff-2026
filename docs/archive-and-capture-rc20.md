# RC20 · Archive interior and capture sequence

## The archive

The second floor uses eight independently modeled Blender assemblies for the tile slabs, two fluorescent fittings, fire bulkhead, register cabinet, grille, drain and ledger spill. The game instances each assembly across the existing neutral tiles and preserves the authored floor phases. Photography supplies the ceramic and plaster color, normal and roughness data. Weak fluorescent pools reveal the floor and structure by day. In the dark, red emergency fixtures pick out walls and the headlamp reveals nearby surfaces. Safe lamps and phase bridge signals keep their existing colors.

The Mourning Clerk has fitted feather layers, weathered surface detail and articulated wings. She still charges under direct eye contact and stops if the player turns away. At contact, her pose, the player's hands, the camera, the wing sweep and sound progress together. The fall closes to black before the checkpoint view returns. Reduced effects keeps the mechanical timing and uses fewer camera and light changes. Classic uses a separate hand-pixeled capture, fall and lamp recovery.

[Archive Blender source](../art/blender/archive-interior.blend) · [Wing Blender source](../art/blender/mourning-wings.blend) · [Photographed surfaces](../dist/3d/assets/surfaces/CREDITS.md)

## Browser verification

- Classic finished all 18 areas, recovered six records and held the complete ending. The run had zero deaths and zero browser exceptions. The Records Annex took 45.05 seconds. Separate tests deliberately triggered the capture and lamp recovery in normal and reduced-effects modes from the packaged Classic build.
- The 3D route finished all nine handovers, cleared the 28 Records Annex obstacles in 45.43 seconds and reached the normal ending with zero deaths. The save and journal survived a reload and a round trip through Classic. The route ran with the same timing and geometry. The final wing finish and archive texture loading were checked in focused runs of the release package.
- The 3D capture test measures every beat at actual contact, checks a fully dark frame before the viewpoint changes, and confirms the original checkpoint restores the player. Separate frames verified the wing fold and boots against the floor during the fall.
- The automated suite passed 133 tests. Syntax checks covered 100 modules. The local and staged source built identical ZIP bytes.

[In-game capture](../media/archive-rc20.jpg)

Three fresh Chrome profiles ran at 2560 × 1440, High, with adaptive resolution off on an Apple M4. The first night shift stayed within 16.8 ms. The real-input fight's 86 capture frames and 51 revival frames also stayed within 16.8 ms. Cold entry still had occasional long frames while the scene initialized. The worst was 116.6 ms with staged textures, compared with 116.7 ms in the three earlier RC19 comparison runs on the same machine.
