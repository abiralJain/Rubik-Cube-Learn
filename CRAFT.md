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
