# The Records Annex · RC17

The expanded chase follows the same archive handover in both editions. The pursuer can gain ground at obstacles. A clear run still takes approximately 45 seconds.

| Edition | Earlier speed | RC17 speed | Earlier obstacles | RC17 obstacles |
| --- | ---: | ---: | ---: | ---: |
| Classic 2D | 112 px/s | 140 px/s | 23 | 37 |
| First-person 3D | 6.1 m/s | 7.7 m/s | 18 | 28 |

Classic crosses the intake offices, pump gallery, tall stacks, mail sorting and fire stair. The route changes floor height six times and includes nine phase bridges. Its halfway lamp retains the existing save identifier. The first-person route is 333.6 metres long. Alternating rack openings, narrower runs and six airborne phase changes lead through a tiled return-air gallery, high microfilm stores and the concrete stairwell. Permanent yellow stripes mark the real edges of floor openings. The bridges disappear with their inactive phase.

The glass-tiled walls, shuttered concrete, ventilation fan, roof beams, shaft markings and caged lights are original editable Blender assemblies. The fans rotate at different speeds in the two phases. In motion, the chase score accelerates at bar boundaries. Short warning sounds identify the obstacle ahead, and the rear footfalls and cries move with the pursuer.

- [Editable Blender scene](../art/blender/backrooms-annex.blend)
- [Browser game](https://tomhao.itch.io/last-light)


## Verification

- Chrome cleared the Classic route in 45.05 seconds. Both endings were verified by continuing actual fresh-run archive saves in the exact package, across all 18 sectors. The complete run retained all six records. Also tested ghost capture, retry, the halfway lamp and replay from a legacy completed save.
- Two fresh first-person stories cleared the chase without deaths and reopened their normal and complete endings. With the exact archive, a clean run took 45.475 seconds. Deliberate capture, an unlit bridge, a missed gap and steering back from the exit's side wall all recovered correctly.
- At a 2560 × 1440 High render target on Apple M4, both exact-package pursuit samples had a 16.7 ms median and no intervals above 50 ms. The 99th percentile was 33.4 ms with recording or other browser workloads running. The isolated art pass reached 16.8 ms at the 99th percentile. These are browser display intervals on one machine.
- The 46.825-second trailer uses normal Chrome input and synchronized actual game stereo for both editions. All 2,809 video frames decoded. The original voice performance aligns with the opening caption. Waveform matches place the two creature screams at 11.31 and 23.31 seconds, and the metal door at 41.50 seconds. The audio measured −19.2 LUFS and −1.7 dBTP. All decoded samples were finite and unclipped. The full audio was played through macOS. No subjective headphone assessment was available.

The reproducible HTML5 archive contains 124 files. SHA-256: `583bc13a4b3e74780ddd98c92ddb2f6c20f02bbadc02797ba273aa44d38d182d`.

[Updated trailer](https://www.youtube.com/watch?v=mlfnCk58LAw).
