# Craft log

Motion and material values chosen for the Cube app, with the reason. Reviewed at 10% speed before each entry.

## Slice 1 — cube

- Fill 0.78 → 0.68 of the shorter viewport axis. At 0.78 the cube's lower corner left no room for the ground shadow on 1440×900 and crowded the phone's stage.
- Body `#2E2A3A` → `#35304A`. Near-black read as "hardware store"; the lighter indigo-charcoal sits with `--ink` and lets the sticker sinks read.
- Hemisphere 0.35 → 0.7, exposure 1.0 → 1.18, environment 0.75 → 0.9. Yellow was rendering as amber and white as grey; children's palette needs the stickers to read as their names.
- Ground shadow plane moved from y −1.97 to −2.9 and enlarged to 6.4: at 18° camera elevation the closer plane was hidden inside the cube's projected footprint.

## Slice 3/4 — validator, teaching solver, Learn

- Solver frame is yellow-up/white-down for the whole solve (z2 of the standard string) so a child never flips the cube; each step also picks a `front` so the same finger sequence recurs. Corner permutation stage uses the A-perm `R' F R' B2 R F' R' B2 R2` because the beginner corner cycle twists corners and would undo the yellow face; parity is fixed with one top turn first.
- Move statistics over 1000 random states: mean 127, p90 148, p99 161, max 179 turns; ~23 teaching steps.
- Dimmed stickers: HSL in sRGB, saturation ×0.55, lightness ×0.5 (cap 0.42), environment reflection 0.4 instead of 1.1. Linear-space HSL plus full reflections had produced a pastel wash instead of a recession. Highlighted stickers breathe 0.06 units outward at 4 rad/s so the target is found on a busy cube.
- Card content swaps with a 120 ms opacity + 2 px blur crossfade, no slide: Next is pressed ~130 times per solve.
- The hidden back face gets a straight arrow along the edge it shares with the up face, direction derived by rotating an up-face sticker with the move; the presentation yaws ±0.5 toward whichever side face is being turned so its arc is never behind the cube.
- Layer drags are gated: only the expected move may commit; anything else springs back to 0 with a low bloop and one arrow pulse. Three rejections auto-play the ghost preview.

## Slice 5 — Solved

- Sequence starts on shader-ready, not mount: settle 700 ms → bloom (iridescence 0.12→0.75, thickness range widening, clearcoat roughness tightening) with chime and haptic → copy at 1400 ms → actions 450 ms later via a CSS transition (motion's delayed entrance stalled under heavy WebGL load in testing; CSS transitions run off the main thread).
- Iridescence relaxes to 0.25 after 2.6 s and drops to 0 the moment the child turns the cube out of solved.

## Performance and landing

- Landing page shows a pixel-matched WebP poster of the cube (rendered from the real scene with `?poster=1`, transparent, 540/810/1080) and boots WebGL on first interaction or after 3.8 s idle. Home's entrances are CSS keyframes so the motion library loads only with Paint, Learn and Solved. Natural rolldown chunking (React, cube, orientation) instead of manual chunks, which had forced three and motion into the entry preloads.
- Lighthouse mobile (simulated 4G, 4× CPU) on the production preview: performance 97, accessibility 100, best practices 100; first paint 2.0 s, blocking time 0 ms, layout shift 0.
- Glow blobs use soft radial gradients instead of a 60 px blur filter over animated children, so each frame is a transform composite rather than a re-blur.
- Test hook `cube.fast` commits turns instantly: headless software WebGL runs at 3–4 fps, which made a 130-turn walk-through take minutes.

## Kid delight

- Stage complete: ripple from the top centre, one 1.2 % squash along the top axis, twelve glossy dots in the stage colour rising 0.9–1.5 units and fading over ~1.2 s (one instanced draw call), a three-note chime, and the praise line spoken.
- Paint first run: a breathing ring follows a front sticker until the first tap; never shown again.
- Spring rest criterion loosened to |x−target| < 0.002 and |v| < 0.02 (from 0.001 / 0.001): imperceptible at 60 fps, but the old threshold let a finished turn linger "active" for a second in low-frame-rate environments.
- Playwright pinned to one worker: four headless browsers rendering WebGL in software starved each other and turned five-second tests into timeouts.

## Opal skin and the cut-stone cube (2026-09-08, late)

- Direction reset: the light "Opal Way" mock was rejected as slop. The skin now copies Opal's system literally on its native black: SF Pro / Inter, 22/28 semibold sentences, 15/20 body at 60 %, 11 px small caps at +0.08 em, 52 px pills (dark base with the pale-yellow→mint sheen along the bottom edge), 36 px icon circles, outlined stat pills, rounded cards at 6 % white, the floating three-item tab bar, and a 3 px segmented progress bar. Colour lives only in the cube, the stage-tinted room light, and data words.
- Cube finish: "Clay" (matte) read as dull on black; four glossy candy passes read as the rejected candy. What worked is geometry, not gloss: each tile is an `ExtrudeGeometry` square with a two-ring chamfer (`bevelThickness 0.11`, `bevelSize 0.13`, `bevelSegments 2`, flat shading) sitting 0.22 proud of a glossy black body, deep enamel colours (`#128F4E` green, `#C8231F` red, `#1F4FC2` blue), roughness 0.04, clearcoat 1, ior 2.0, iridescence 0.2.
- Lighting: the default room environment floods every tile pastel. Replaced by a jeweller's studio built in code: a 0.32 grey light tent, one 12-stop warm key softbox high front-left, a cool vertical strip on the right (wall facets), a strip above-behind the camera (tables), a dim floor bounce. Directional lights cut to 0.85 / 0.25 / 0.55, hemisphere 0.15, exposure 1.05. Small hard lights on black are what make facets read as facets.
- Dimmed tiles: HSL darkening turned muddy under the warm key. Now the pigment is scaled ×0.3 in linear light (hue never drifts), roughness eases to 0.6, environment to 0.18 and iridescence to 0, all damped at 12 /s. Key light is neutral white so darks stay clean.
- Learn: the algorithm ruler (Opal's duration scrubber) shows every move of the step as a tick, the current one 1.6× at the centre mark; the sentence names the layer in the stage colour. The on-cube arrow stays, lifted by the tile height plus 0.18 and drawn in white.
- Stage complete: a full-screen milestone (Opal's gem detail) with the stage's stone composited by `mix-blend-mode: screen` from `/public/gems/stage-N.png`; falls back to a lit orb until the images exist. Not shown for the last stage, which is the Solved page itself.
- Headless note: the in-app Browser pane keeps `document.hidden` true, so requestAnimationFrame never runs and the WebGL cube never boots there. All visual checks in this pass were rendered with Playwright (`scripts/shot-opal.mjs`, `shot-learn-dark.mjs`, `shot-milestone.mjs`, `shot-wide.mjs`, `gem-variants.mjs`).

## Round two on the Opal skin (2026-09-08, night)

- Layout: side-by-side only in landscape (`min-width: 760px and orientation: landscape`); portrait tablets stack like a phone with a taller stage. The cube's on-screen radius is capped at 250 px in `CameraFit`, so it reads as an object you hold, not a wall.
- Learn no longer redirects silently. With no valid cube it shows a gate: one sentence, one pill (Colour it in / Fix it), the tab bar stays.
- Home gained two states: "Ready" (54 valid stickers, Start) and "one thing off" (54 stickers that cannot be a cube: the validator's sentence as the headline, Show me → Paint).
- Validator sentences rewritten as plain instructions ("One edge is flipped. Its two colours are swapped."). Paint's issue card now says what to do once the suspects are lit.
- Cube: brighter key (14 stops), exposure 1.18, env 1.15, a slightly more luminous palette; room light at 28 % when a stage tints it.
- Gems: `public/gems/stage-N.png` converted to 1024 px WebP (~45 KB each) and composited with a screen blend on the milestone screen.

## The gemstone cube (2026-09-08, late night)

- Reference: the user generated a cube in the gems' lighting (`public/ref/cube.png`): step-cut stones with light inside, thin black bezels, hard facet highlights, a coloured floor reflection, a higher corner-on camera.
- Opaque materials could not do "light inside". The tile is now two meshes: a glass crown (`MeshPhysicalMaterial`, transmission 1, thickness 0.25, ior 2.4, roughness 0.03, clearcoat 1, iridescence 0.25) over an unlit faceted core (`MeshBasicMaterial`, vertex colours jittered per facet, colour × 1.5). The crown's own colour and attenuation are a light tint per face (`GLASS_TINT`) so yellow stays yellow through the glass; the core carries the saturated colour.
- Geometry: `stepCutGeometry` builds an octagonal step cut (five rings to a small table) as non-indexed triangles with per-facet vertex shade. Crown shade is flat; the core's jitters so the inside sparkles. Core is scaled 0.86 and sits 0.01 behind the crown. Cores skip raycasting; the controller drives the core colour (and now the glass colour) through the same damped dim/highlight pass, and ghosts both layers.
- Studio: dim 0.2 tent, one 2×1 key at 16 stops, a 0.4×6 rim strip, a small quad above the camera, a strip behind. Directional lights 0.6 / 0.18 / 0.4, hemisphere 0.08, exposure 1.1. Transmission pass at half resolution (`transmissionResolutionScale 0.5`).
- Camera: elevation 22°, hero yaw −0.7 / pitch 0.3 (the reference's corner view). A CSS floor reflection in the stage tint sits under the cube.
- Headless note: with transmission on, one tablet screenshot in a batch failed with "Unable to capture screenshot"; a reload-and-retry fixed it. Worth watching on low-end devices.
