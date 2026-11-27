# RC39 · Close-contact horror

Preview: http://127.0.0.1:8781/. Archive: `releases/last-light-3d-3.0.0-rc.39-html5.zip` · 60,148,160 bytes · SHA-256 `ee529c611e8912ad512e86799f07f516b13635f000d84ccee59414bbbf548d28`. Not published; RC38 and its save origin remain available.

## Changes

- Common 3D apparition rig: a seed-specific uneven gait, stagger/weight transfer, asymmetric cheek and lip pulls, jaw chatter that stills at full grip, and tighter hand articulation during contact. This also applies to the Annex pursuer's existing vault/pursuit rig. The Clerk has her own asymmetrical jaw/wrap articulation and close-grip pose.
- `dist/3d/wound-finish.js` defines rest-space masks and material roughness for lips/teeth, cuts, knuckles, soaked linen and cuffs. The detail follows existing skinned faces, movement and morph targets. Blood transfers to the player’s hands at actual bind/contact, fades after a strike, and is removed on checkpoint revival. It is not a full-frame tint. New marks are original procedural work, with no changed third-party asset licenses.
- Short, depth-tested droplets run on the shared atmospheric batch and are started by actual bind, apparition contact or a confirmed roof hit. New short contact sound layers are nonverbal and do not change the English-only speech policy. Reduced effects suppress the drops and extra shudder but not static/staged blood marks. Classic features new wrap/mouth pixels and contact droplets, including its Annex. Both editions disclose blood on the title screen.
- Unchanged: objectives, collision, phases, enemy hearing/speed, chase route, difficulty, save schema, damage and revival.

## Verification of the exact archive

Independent extraction `/tmp/ll-rc39-final.2A6Z87/site` matched local preview. All 210 entries byte-match the current source after packaging rewrites. `npm test`: 154 pass; `npm run check`: 123 modules; `unzip -tq` passed. Direct preview launch showed the new advisory and started chapter 1 with WebGL.

- Two fresh Chrome campaigns (`JOURNEY=normal` and `JOURNEY=complete`) passed with zero deaths, all 28 Annex obstacles each, zero/six records, reopened endings and successful Classic round trips.
- Chrome `MOURNING=1 WOUND_PROOF=1 MOURNING_FOLEY=1`: existing gaze, look-away, charge, capture and revival; four selected actor surface kinds, seven matching linked programs without recorded compile failures, ten droplets, hand transfer during hold, and clean/finite hand pose at revival. `REDUCED_WOUND_PROOF=1` followed the play route again with zero droplets.
- `ROOF_COMBAT_STILLS` with wound proof: hit contact activates the worker/hand shaders and four droplets, tested with stagger, subsequent banishment, phase persistence, intentional checkpoint fall/recovery and mobile touch Strike. Code and browser checks do not measure perceived sound quality.
- Packaged Classic gaze and capture path passed; its English voice with Chinese UI passed independently. Browser mobile editor drag/resize, persistence, orientation separation, reset and multitouch also passed. Physical mobile and full AV/listening sign-off remain open. No whole-map art acceptance is implied.

Played screenshots and traces: [evidence/rc39](evidence/rc39/).
