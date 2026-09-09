import type { Face } from '@/cube/facelets';

export type HSV = { h: number; s: number; v: number }; // h in [0,1)
export const FACES6: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return { h, s: max > 0 ? d / max : 0, v: max };
}

/** Starting references under a neutral lamp; each captured centre replaces its own entry. */
export const DEFAULT_REFS: Record<Face, HSV> = {
  U: { h: 0.12, s: 0.06, v: 0.95 },
  D: { h: 0.14, s: 0.85, v: 0.95 },
  R: { h: 0.0, s: 0.8, v: 0.8 },
  L: { h: 0.07, s: 0.85, v: 0.92 },
  F: { h: 0.38, s: 0.75, v: 0.7 },
  B: { h: 0.6, s: 0.8, v: 0.75 },
};

const hueDist = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 1 - d) * 2; }; // 0..1

/** Nearest reference in the user's own colour space. White is decided by saturation first. */
export function classify(p: HSV, refs: Record<Face, HSV>): { face: Face; confidence: number } {
  const scores = FACES6.map((f) => {
    const r = refs[f];
    if (f === 'U') {
      // white: low saturation and bright; hue is meaningless
      const d = Math.max(0, p.s - Math.max(0.22, r.s + 0.12)) * 3 + Math.max(0, r.v - 0.25 - p.v) * 1.5;
      return { f, d };
    }
    const chroma = Math.min(1, p.s / 0.35); // desaturated samples shouldn't match a chromatic colour by hue alone
    const d = hueDist(p.h, r.h) * (0.6 + 0.4 * chroma) + Math.abs(p.s - r.s) * 0.25 + Math.abs(p.v - r.v) * 0.2 + (1 - chroma) * 0.6;
    return { f, d };
  }).sort((a, b) => a.d - b.d);
  const best = scores[0], second = scores[1];
  return { face: best.f, confidence: Math.max(0, Math.min(1, (second.d - best.d) / 0.25)) };
}

/** Median RGB of a square patch of `data` (RGBA), robust to specular highlights. */
export function medianRGB(data: Uint8ClampedArray, width: number, x0: number, y0: number, size: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let y = y0; y < y0 + size; y += 2) for (let x = x0; x < x0 + size; x += 2) {
    const i = (y * width + x) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
  }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  return [med(rs), med(gs), med(bs)];
}
