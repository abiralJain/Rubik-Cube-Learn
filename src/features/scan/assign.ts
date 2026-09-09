/**
 * Decide late, decide globally. The scanner keeps one raw colour sample per sticker; once all six faces are in,
 * every sticker is assigned to one of the six centre colours with exactly nine per colour, and if the result is
 * not a cube the cheapest repair (by measured colour) is taken. Colour maths in OKLab, where distances mean what
 * the eye sees.
 */
import { FACES, CENTRE, type Face, type Facelets } from '@/cube/facelets';
import { core, repairs } from '@/cube/validate';

export type RGB = [number, number, number];
export type Lab = [number, number, number];

export function rgbToOklab([r8, g8, b8]: RGB): Lab {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const chroma = (c: Lab) => Math.hypot(c[1], c[2]);
export const hue = (c: Lab) => Math.atan2(c[2], c[1]);

/**
 * Distance between a sticker and a centre. Lightness counts less than hue and chroma (exposure varies across faces),
 * and the white centre is matched mostly on chroma so glare on a coloured sticker does not read as white.
 */
export function stickerDistance(p: Lab, anchor: Lab, anchorIsWhite: boolean): number {
  const dl = p[0] - anchor[0], da = p[1] - anchor[1], db = p[2] - anchor[2];
  if (anchorIsWhite) return Math.hypot(chroma(p) * 2.2, dl * 0.6, Math.max(0, 0.55 - p[0]) * 1.5);
  const cp = chroma(p), ca = chroma(anchor);
  const dh = Math.atan2(Math.sin(hue(p) - hue(anchor)), Math.cos(hue(p) - hue(anchor)));
  const hueTerm = Math.abs(dh) * Math.min(cp, ca) * 1.6;      // hue matters in proportion to how colourful both are
  const chromaTerm = Math.abs(cp - ca) * 0.6;
  const lowChromaPenalty = Math.max(0, 0.05 - cp) * 4;         // a grey sample should not claim a colour
  return Math.hypot(hueTerm, chromaTerm, dl * 0.35, da * 0.4, db * 0.4) + lowChromaPenalty;
}

/** Fallback anchors under a neutral lamp, for faces whose centre has not been seen yet. */
export const DEFAULT_ANCHORS: Record<Face, RGB> = { U: [235, 235, 230], R: [200, 30, 40], F: [30, 160, 80], D: [245, 205, 40], L: [245, 130, 40], B: [40, 80, 200] };

export interface AssignResult {
  facelets: Facelets;
  /** Per sticker: how clearly it chose its colour (second best minus best), 0..1-ish. */
  margin: number[];
  /** Whether the final string is a valid cube, and how it got there. */
  valid: boolean;
  repaired: 'none' | 'recolour' | 'swap' | 'twist' | 'flip' | 'failed';
  totalCost: number;
}

/** Label a single sticker against the anchors currently known (live preview). */
export function nearest(p: Lab, anchors: Record<Face, Lab>): { face: Face; margin: number } {
  const d = FACES.map((f) => ({ f, d: stickerDistance(p, anchors[f], f === 'U') })).sort((a, b) => a.d - b.d);
  return { face: d[0].f, margin: d[1].d - d[0].d };
}

/**
 * Assign all 54 samples. `samples[i]` is the RGB read for facelet i (centres included; they become the anchors).
 * Balanced to exactly nine per colour, then repaired to a valid cube if needed.
 */
export function assign(samples: RGB[]): AssignResult {
  const lab = samples.map(rgbToOklab);
  const anchors = Object.fromEntries(FACES.map((f) => [f, lab[CENTRE[f]]])) as Record<Face, Lab>;
  const cost: number[][] = lab.map((p) => FACES.map((f) => stickerDistance(p, anchors[f], f === 'U')));
  const label: Face[] = new Array(54);
  for (const f of FACES) label[CENTRE[f]] = f;
  const free = Array.from({ length: 54 }, (_, i) => i).filter((i) => i % 9 !== 4);
  // 1. nearest colour for each free sticker
  for (const i of free) label[i] = FACES[argmin(cost[i])];
  // 2. balance: while a colour is over-full, move its least-committed sticker to its best under-full colour
  const count = () => Object.fromEntries(FACES.map((f) => [f, label.filter((x) => x === f).length])) as Record<Face, number>;
  for (let guard = 0; guard < 200; guard++) {
    const c = count();
    const over = FACES.find((f) => c[f] > 9);
    if (!over) break;
    const under = FACES.filter((f) => c[f] < 9);
    let best: { i: number; to: Face; extra: number } | null = null;
    for (const i of free) {
      if (label[i] !== over) continue;
      for (const to of under) {
        const extra = cost[i][FACES.indexOf(to)] - cost[i][FACES.indexOf(over)];
        if (!best || extra < best.extra) best = { i, to, extra };
      }
    }
    if (!best) break;
    label[best.i] = best.to;
  }
  // 3. local search: swap labels between two stickers when it lowers the total cost
  let improved = true;
  for (let guard = 0; improved && guard < 6; guard++) {
    improved = false;
    for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) {
      const i = free[a], j = free[b];
      if (label[i] === label[j]) continue;
      const fi = FACES.indexOf(label[i]), fj = FACES.indexOf(label[j]);
      const now = cost[i][fi] + cost[j][fj], swapped = cost[i][fj] + cost[j][fi];
      if (swapped + 1e-6 < now) { const t = label[i]; label[i] = label[j]; label[j] = t; improved = true; }
    }
  }
  const margin = lab.map((_, i) => { const row = cost[i].slice().sort((x, y) => x - y); return row[1] - row[0]; });
  let facelets = label.join('');
  const total = (f: string) => free.reduce((s, i) => s + cost[i][FACES.indexOf(f[i] as Face)], 0);
  if (core(facelets).ok) return { facelets, margin, valid: true, repaired: 'none', totalCost: total(facelets) };
  // 4. not a cube: among every single-edit repair, take the one that best agrees with what the camera saw
  const reps = repairs(facelets, { all: true });
  if (reps.length) {
    const before = total(facelets);
    const best = reps.map((r) => ({ r, extra: total(r.facelets) - before + (r.kind === 'swap' ? 0.02 : 0) })).sort((a, b) => a.extra - b.extra)[0];
    facelets = best.r.facelets;
    return { facelets, margin, valid: true, repaired: best.r.kind, totalCost: total(facelets) };
  }
  // 5. two edits: recolour the two least certain stickers in every combination (bounded)
  const shaky = free.slice().sort((a, b) => margin[a] - margin[b]).slice(0, 10);
  let found: { f: string; extra: number } | null = null;
  const before = total(facelets);
  for (let x = 0; x < shaky.length; x++) for (let y = x + 1; y < shaky.length; y++) {
    for (const cx of FACES) for (const cy of FACES) {
      if (cx === facelets[shaky[x]] && cy === facelets[shaky[y]]) continue;
      const g = setTwo(facelets, shaky[x], cx, shaky[y], cy);
      if (!core(g).ok) continue;
      const extra = total(g) - before;
      if (!found || extra < found.extra) found = { f: g, extra };
    }
  }
  if (found) return { facelets: found.f, margin, valid: true, repaired: 'recolour', totalCost: total(found.f) };
  return { facelets, margin, valid: false, repaired: 'failed', totalCost: before };
}

function argmin(xs: number[]) { let k = 0; for (let i = 1; i < xs.length; i++) if (xs[i] < xs[k]) k = i; return k; }
function setTwo(f: string, a: number, ca: string, b: number, cb: string) { const arr = f.split(''); arr[a] = ca; arr[b] = cb; return arr.join(''); }

/** Is there a cube in front of the camera? Nine patches that are colourful or bright, with darker gaps between them. */
export function cubePresent(patches: Lab[], gaps: Lab[]): boolean {
  const lit = patches.filter((p) => chroma(p) > 0.06 || p[0] > 0.7).length;
  if (lit < 8) return false;
  const meanL = patches.reduce((s, p) => s + p[0], 0) / patches.length;
  const gapL = gaps.reduce((s, p) => s + p[0], 0) / Math.max(1, gaps.length);
  return gapL < meanL - 0.08;
}

/**
 * Which face is each captured side? Decided jointly from the centre colours: one-to-one against the six colours,
 * minimising total distance. Six centres are far easier to tell apart together than one sticker alone, and it frees
 * the user from showing the sides in any particular order.
 */
export function identifyFaces(centres: Lab[]): Face[] {
  const n = centres.length;
  const anchors = Object.fromEntries(FACES.map((f) => [f, rgbToOklab(DEFAULT_ANCHORS[f])])) as Record<Face, Lab>;
  const cost = centres.map((c) => FACES.map((f) => stickerDistance(c, anchors[f], f === 'U')));
  let best: { perm: Face[]; total: number } | null = null;
  const used = new Array(6).fill(false), perm: Face[] = [];
  const rec = (i: number, total: number) => {
    if (best && total >= best.total) return;
    if (i === n) { best = { perm: perm.slice(), total }; return; }
    for (let k = 0; k < 6; k++) {
      if (used[k]) continue;
      used[k] = true; perm.push(FACES[k]);
      rec(i + 1, total + cost[i][k]);
      perm.pop(); used[k] = false;
    }
  };
  rec(0, 0);
  return best!.perm;
}

/** Distance between two centre reads: used to refuse a side that has already been taken. */
export const centreDistance = (a: Lab, b: Lab) => Math.hypot((a[0] - b[0]) * 0.6, a[1] - b[1], a[2] - b[2]);
