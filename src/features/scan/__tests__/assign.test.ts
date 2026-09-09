import { describe, it, expect } from 'vitest';
import { assign, rgbToOklab, nearest, DEFAULT_ANCHORS, type RGB } from '../assign';
import { randomState, mulberry32 } from '@/cube/scramble';
import { FACES, CENTRE, type Face } from '@/cube/facelets';

/** A plausible sticker colour for a face under a given light: nominal pigment × light, plus per-sticker noise. */
const PIGMENT: Record<Face, RGB> = { U: [225, 222, 215], R: [190, 25, 35], F: [20, 150, 70], D: [235, 195, 30], L: [235, 120, 30], B: [30, 70, 190] };
type Light = { gain: RGB; noise: number };
const LIGHTS: Record<string, Light> = {
  neutral: { gain: [1, 1, 1], noise: 10 },
  warm: { gain: [1.12, 0.98, 0.78], noise: 12 },
  cool: { gain: [0.85, 0.95, 1.15], noise: 12 },
  dim: { gain: [0.55, 0.55, 0.55], noise: 14 },
};
const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
function sample(face: Face, light: Light, rng: () => number, faceGain = 1): RGB {
  const p = PIGMENT[face];
  return [0, 1, 2].map((k) => clamp(p[k] * light.gain[k] * faceGain + (rng() - 0.5) * 2 * light.noise)) as RGB;
}
function samplesFor(cube: string, light: Light, rng: () => number, opts: { glare?: number; perFaceExposure?: boolean } = {}): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < 54; i++) {
    const faceGain = opts.perFaceExposure ? 0.85 + 0.3 * rng() : 1; // each side was shot at a slightly different exposure
    let s = sample(cube[i] as Face, light, rng, faceGain);
    if (opts.glare && i % 9 !== 4 && rng() < opts.glare) s = s.map((c) => clamp(c + 70 + rng() * 60)) as RGB; // a specular highlight washes the patch
    out.push(s);
  }
  // centres carry the anchor: make them clean reads
  for (const f of FACES) out[CENTRE[f]] = sample(f, light, rng);
  return out;
}

describe('assign', () => {
  for (const [name, light] of Object.entries(LIGHTS)) {
    it(`recovers random cubes under ${name} light`, () => {
      const rng = mulberry32(7 + name.length);
      let ok = 0; const N = 120;
      for (let n = 0; n < N; n++) {
        const cube = randomState(rng);
        const r = assign(samplesFor(cube, light, rng, { perFaceExposure: true }));
        if (r.facelets === cube) ok++;
      }
      expect(ok).toBe(N);
    });
  }
  it('survives glare on a handful of stickers', () => {
    const rng = mulberry32(99);
    let ok = 0, valid = 0; const N = 150;
    for (let n = 0; n < N; n++) {
      const cube = randomState(rng);
      const r = assign(samplesFor(cube, LIGHTS.neutral, rng, { glare: 0.05, perFaceExposure: true }));
      if (r.valid) valid++;
      if (r.facelets === cube) ok++;
    }
    expect(valid).toBe(N);
    expect(ok / N).toBeGreaterThan(0.9);
  });
  it('labels a grey patch as white only when it is bright', () => {
    const anchors = Object.fromEntries(FACES.map((f) => [f, rgbToOklab(DEFAULT_ANCHORS[f])])) as Record<Face, ReturnType<typeof rgbToOklab>>;
    expect(nearest(rgbToOklab([230, 230, 228]), anchors).face).toBe('U');
    // the cube's black body should not be a confident colour
    expect(nearest(rgbToOklab([20, 20, 22]), anchors).margin).toBeLessThan(0.08);
    // orange and red stay apart
    expect(nearest(rgbToOklab([240, 120, 30]), anchors).face).toBe('L');
    expect(nearest(rgbToOklab([190, 30, 40]), anchors).face).toBe('R');
  });
});

import { identifyFaces } from '../assign';
describe('identifyFaces', () => {
  for (const [name, light] of Object.entries(LIGHTS)) {
    it(`tells the six centres apart under ${name} light, in any order`, () => {
      const rng = mulberry32(31 + name.length);
      for (let n = 0; n < 40; n++) {
        const order = [...FACES].sort(() => rng() - 0.5);
        const centres = order.map((f) => rgbToOklab(sample(f, light, rng, 0.85 + 0.3 * rng())));
        expect(identifyFaces(centres)).toEqual(order);
      }
    });
  }
  it('works on a partial set', () => {
    const rng = mulberry32(5);
    const centres = (['B', 'D', 'U'] as Face[]).map((f) => rgbToOklab(sample(f, LIGHTS.neutral, rng)));
    expect(identifyFaces(centres)).toEqual(['B', 'D', 'U']);
  });
});
