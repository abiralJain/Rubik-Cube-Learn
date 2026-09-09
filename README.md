# Cube

A web app that solves the Rubik's cube in your hand, hands-free. Prop the phone up, show the cube to the camera one side at a time (no button), then put your hands back on it: the app says each turn, sweeps the arrow on a gemstone cube, waits, turns it on screen, and moves on. Theory is one swipe away and never in the way.

Live: https://abiraljain.github.io/Rubik-Cube-Learn/

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build && npm run preview   # production build on http://localhost:4173
```

## Test

```bash
npm test             # unit: facelet tables vs cubejs, cubie model, validator, repair suggestions (500 cubes), colour assignment and centre identification under four lights, autopilot state machine, teaching solver
npm run e2e          # Playwright (desktop + Pixel 7): cube gestures, colouring in, one-tap fixes, zero-click autopilot solve, pause/resume, resume after reload, six-side fake-camera scan, axe, one-viewport layout on phones
```

The autopilot test sets `localStorage['cube.fast']='1'` so the speak → wait → play cycle runs in a few tenths of a second. The scan test renders a six-side Y4M video for Chrome's fake camera with `scripts/make-scan-y4m.mjs`.

## Structure

- `src/cube/` pure TypeScript: `facelets.ts` (54-sticker model, cubejs order, move tables), `cubies.ts` (Kociemba cubie tables), `validate.ts` (counts, centres, impossible pieces, twist, flip, parity, and `repairs()` that returns repaired cubes), `suggest.ts` (ranked fixes in words), `lbl.ts` (beginner's layer-by-layer teacher), `scramble.ts`.
- `src/cube3d/` the cube: one persistent canvas (`PersistentStage`, `scene/stage.ts` with `useStage()`), asscher-cut stones with black bezels, a code-built jeweller's studio, orbit with momentum, gated layer drags, the sweeping move arrow, sparkles, bloom.
- `src/features/solve` home (states: fresh, colouring, one thing off, ready, mid-solve) · `scan` button-less camera scan with global colour assignment (`assign.ts`) · `fix` colouring in and one-tap fixes · `play` the autopilot (`autopilot.ts`, `voice.ts`) · `journey` the seven stones · `learn` chapters with watch/try · `solved`.
- `src/store/session.ts` zustand + localStorage: facelets, paint history, the solve in progress, unlocked stones, history, pace and voice.
- `CRAFT.md` the reasons behind motion, material and interaction values.
