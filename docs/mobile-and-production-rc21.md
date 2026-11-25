# RC21 · Mobile play and production design

## Controls

The title screens offer **Play in Mobile**. The 3D edition has a left movement joystick, camera drag on the scene, and separate **Jump**, **Day / Night** and **Use** buttons. Classic uses directional buttons alongside **Jump**, **Day / Night** and **Interact**. The buttons share the normal campaign and checkpoint saves.

Right-click switches phase by default in both editions. Classic also keeps left and right Shift. In **Settings → Key bindings**, select the switch action and press X, another key, or the right mouse button. A reset restores the edition defaults. The settings migration updates legacy defaults and preserves customized bindings.

## Art and sound

- The boiler gallery and rooftop use twelve original Blender assemblies with photographic surface maps. The editable source and provenance are in [the Blender scene](../art/blender/pressure-and-roof.blend) and [environment credits](../dist/3d/assets/env/CREDITS.md). The archive and annex keep their authored geometry.
- Closing a boiler valve moves the handle, drops the gauge and releases visible steam. The office press returns on a spring, and Gary's door swings open and settles. The rooftop valve opens into visible runoff. The fan coasts when power falls, and lift gates retract their physical bolts before moving.
- The pixel edition adds layered background steam and night rain. Recorded breathing and field Foley accompany gameplay in both editions. The recorded gasp, chase breath and recovery breath are non-verbal performances. The existing dialogue sources and localization methods are listed in the [dialogue credits](../dist/3d/assets/dialogue/CREDITS.md). The new field clips are listed in the [recording credits](../dist/3d/audio/CREDITS.md).

## Desktop verification

Three fresh Chrome profiles per release ran the same archive route at an actual 2560×1440 render size, High quality and adaptive resolution off. With RC20 and RC21, the sampled first day-to-night switch, first camera turn, first Clerk render, charge, capture and revival each stayed at or below 16.8 ms. The max during cold entry was 116.6–133.4 ms across the six runs. Cold entry still has a visible stall in both builds. A separate Classic browser run was active, so these runs do not establish a cold-entry speed difference.

The 3D campaign cleared all nine stations and the 28-obstacle transfer from a fresh save, reached its normal ending, and kept the ending on reload and after visiting Classic. Its route used the default right mouse switch and recorded zero deaths. The archive capture test separately reached the captured state and recovered at the original lamp.

All seven new recorded effects decode at 32 kHz mono with peaks of 0.579–0.797 and no clipped samples. These measurements do not substitute for a headphone listening session.

Classic cleared all 18 sections in a fresh Chrome profile with zero deaths, 63 phase switches and no browser exceptions. The Records Annex took 45.05 seconds in game. The normal ending and all 18 completed jobs persisted. The route used the development build while audio and scenery changes were landing. The final ZIP was checked separately.

## Mobile and distribution

The extracted release ZIP launched both editions using Chrome touch input at 390×844 and 412×915. The checks covered movement, jumping with movement held, a third touch switching phase, orientation changes and continued input in landscape. The 3D check also exercised touch camera movement and confirmed that the joystick clears on rotation. This was browser touch emulation, without physical iOS Safari or Android hardware.

The public itch.io page loads build `20819782`. Signed-out Chrome opened the 3D and 2D title screens and started their mobile modes. The public 3D **Day / Night** button changed the clock from 17:59 to 18:00. The ZIP is 30,161,556 bytes with SHA-256 `8c1b599577488a2cba93499423e696fd8c25a11dd3c80860336f441e40c0638e`.

The final suite passed 138 tests and the syntax check passed 105 JavaScript modules.
