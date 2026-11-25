# RC19 · Controls, difficulty and the Mourning Clerk

## Controls and encounter

Open **Settings** from either title screen. During play, pause first. Each action has up to three keyboard slots. Click a slot and press the new key. The panel asks before swapping a key that belongs to another action. Escape cancels an edit. Reset restores the defaults for the current edition. The game updates control prompts to show the active bindings.

Story, Standard and Nightmare tune danger and recovery. Preferences are stored separately for Classic and first-person play and independently of progress. The route and phase timings for the Records Annex remain fixed.

In the office, sustained direct eye contact makes the Clerk move toward the player. Turn the first-person camera or lower it to stop her. In Classic, face away or hold the configured lower-eyes key. A capture requires actual proximity. The phase gates, partitions and lit checkpoints still govern the encounter.

## Character source

The adult figure uses a fitted MakeHuman base mesh and skeletal weights, reshaped and painted in Blender. The gown was tailored around the sculpt and has its own UVs and cloth weave. The browser animates shoulders, elbows, spine, jaw and legs on the model's shared rig. The Classic version uses new hand-drawn pixel silhouettes and a reaching charge pose.

[Actual 3D charge](../media/mourning-clerk-rc19.jpg) · [Editable Blender model](../art/blender/mourning-clerk-human.blend) · [Model and texture credits](../dist/3d/assets/creature/SOURCES.md)

## Verification

- Automated suite passed 129 tests. These cover preference persistence, conflict swaps, edition isolation, pursuit timing and contact, difficulty changes, checkpoint recovery and the existing routes.
- Chrome exercised real key remapping and gameplay in both editions, including removing the effects of replaced keys, saving a difficulty, refreshing, and restoring defaults.
- The fresh Classic run finished all 18 sectors and persisted the complete ending with six records and zero deaths. It switched phase 67 times and traversed the Records Annex in 45.05 seconds.
- Fresh first-person runs finished both endings with zero deaths. The complete ending held all six records. The Records Annex took 45.43 seconds. Both endings survived reload and a round trip through Classic.
- Focused office encounters track the enemy's position during direct gaze, averted gaze, phase change, capture and checkpoint revival. The full first-person route runs preceded the final visual export. The packaged encounter test verifies that export in Chrome.

### Desktop frame timing

Three cold Chromium runs on the Apple M4 rendered the archives at 2560 × 1440, High, with adaptive resolution off. Before staging the new mesh, the first drawable Clerk introduced an entry hitch. The final renderer prepares model buffers, shader programs and texture strips in idle slots. It also skips the character draw when the complete silhouette is behind one solid wall strip.

After the fix, the worst frame in the entry windows was 33.3, 33.4 and 50.0 ms. RC18 reached 50.0, 66.6 and 50.1 ms in the matched cold trials. The first night switch peaked at 16.7–16.8 ms in the final trials.

Two Clerks first came into view during the real-input 1440p office run at 16.6 and 16.7 ms. The surrounding windows peaked at 16.8 and 16.7 ms. The run continued through the warning, physical charge, phase change, contact and lamp revival.

## Published build

Published as itch.io build 20812192. Signed-out Chrome started both editions from the public page and switched phase. The 2D test used a newly assigned Q key. All 149 embedded files matched the published archive after accounting for the platform's loader in the two HTML pages.

The archive is 23,869,230 bytes. SHA-256: `f6419ed0b18d0f837e3c18034f333a827a52e65911110931946af9cdc7e575a7`. The source commit is `f4b17286b597fa03ac6ae445ae49dce199c5dbfa`.

[Public game](https://tomhao.itch.io/last-light)
