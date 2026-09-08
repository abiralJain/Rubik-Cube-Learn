# Cube

A web app that teaches a child to solve the Rubik's cube in their hand. Point the camera at each side (or colour the stickers in), then follow one turn at a time on a glossy 3D cube you can turn with your finger.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build && npm run preview   # production build on http://localhost:4173
```

## Test

```bash
npm test             # unit: facelet tables vs cubejs, cubie model, validator, teaching solver (500 scrambles), camera classifier, scrambles
npm run e2e          # Playwright: cube gestures, Paint flow, Learn walk-through to solved, resume, gated swipe, camera (fake device), axe accessibility
npm run shots        # screenshots of every route at six viewports into shots/
```

The Learn walk-through test sets `localStorage['cube.fast']='1'` so turns commit without waiting for springs.

## Structure

- `src/cube/` pure TypeScript: `facelets.ts` (54-sticker model, cubejs order, move tables), `cubies.ts` (Kociemba cubie tables), `validate.ts` (counts, centres, impossible pieces, twist, flip, parity, repair-search suspects), `lbl.ts` (beginner's layer-by-layer teacher producing steps with display moves, explanations, tips and highlights), `scramble.ts`.
- `src/cube3d/` the toy cube: rounded cubelets and puffy stickers, async shader compile behind a poster, orbit with momentum, layer drag with detent snapping and velocity handoff, press springs, move arrows, sparkles, bloom.
- `src/features/` Home, Paint, Camera, Learn, Solved, share card, smart cube adapter (behind `VITE_SMART_CUBE=1`).
- `src/audio/sounds.ts` synthesised sounds; `src/features/learn/speech.ts` read-aloud.
- `CRAFT.md` records motion and material values and why they were chosen.

## Conventions

Facelet strings use the standard cubejs letters (U white, D yellow, F green, B blue, R red, L orange). The teacher works in a yellow-up frame (z2 of the standard string) so the child never flips the cube; `displayMoves` are what the child turns, `moves` are the standard-frame equivalents applied to the app state.
