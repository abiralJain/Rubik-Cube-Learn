import { CENTRE, FACES, FACE_COLOUR, type Face, type Facelets, isCentre } from './facelets';
import { CORNER_FACELET, EDGE_FACELET, toCubies, permutationParity } from './cubies';

export type ValidationReason = 'incomplete' | 'counts' | 'centres' | 'bad-piece' | 'corner-twist' | 'edge-flip' | 'parity';
export type Validation =
  | { ok: true }
  | { ok: false; reason: ValidationReason; message: string; suspects: number[]; candidates: number };

export function core(f: Facelets): { ok: true } | { ok: false; reason: ValidationReason; bad: number[] } {
  if (f.length !== 54 || f.includes('.')) return { ok: false, reason: 'incomplete', bad: [] };
  for (const face of FACES) {
    const n = f.split('').filter((c) => c === face).length;
    if (n !== 9) {
      const over = FACES.filter((x) => f.split('').filter((c) => c === x).length > 9);
      const bad: number[] = [];
      for (let i = 0; i < 54; i++) if (over.includes(f[i] as Face) && !isCentre(i)) bad.push(i);
      return { ok: false, reason: 'counts', bad };
    }
  }
  const centres = FACES.filter((face) => f[CENTRE[face]] !== face);
  if (centres.length) return { ok: false, reason: 'centres', bad: centres.map((c) => CENTRE[c]) };
  const r = toCubies(f);
  if (!r.ok) return { ok: false, reason: 'bad-piece', bad: r.badFacelets };
  const { cp, co, ep, eo } = r.cube;
  const dupC = duplicates(cp), dupE = duplicates(ep);
  if (dupC.length) return { ok: false, reason: 'bad-piece', bad: dupC.flatMap((i) => CORNER_FACELET[i]) };
  if (dupE.length) return { ok: false, reason: 'bad-piece', bad: dupE.flatMap((i) => EDGE_FACELET[i]) };
  if (co.reduce((a, b) => a + b, 0) % 3 !== 0) return { ok: false, reason: 'corner-twist', bad: [] };
  if (eo.reduce((a, b) => a + b, 0) % 2 !== 0) return { ok: false, reason: 'edge-flip', bad: [] };
  if (permutationParity(cp) !== permutationParity(ep)) return { ok: false, reason: 'parity', bad: [] };
  return { ok: true };
}

function duplicates(p: number[]): number[] {
  const seen = new Map<number, number[]>();
  p.forEach((id, pos) => seen.set(id, [...(seen.get(id) ?? []), pos]));
  return [...seen.values()].filter((v) => v.length > 1).flat();
}

export const swapAt = (f: string, a: number, b: number) => { const arr = f.split(''); [arr[a], arr[b]] = [arr[b], arr[a]]; return arr.join(''); };
export const rotateCornerAt = (f: string, i: number, dir: 1 | 2) => { const fc = CORNER_FACELET[i]; const arr = f.split(''); const v = fc.map((x) => f[x]); fc.forEach((x, k) => { arr[x] = v[(k + dir) % 3]; }); return arr.join(''); };
export const flipEdgeAt = (f: string, i: number) => swapAt(f, EDGE_FACELET[i][0], EDGE_FACELET[i][1]);
export const setAt = (f: string, i: number, c: string) => f.slice(0, i) + c + f.slice(i + 1);

export type RepairKind = 'twist' | 'flip' | 'recolour' | 'swap';
export interface Repair { kind: RepairKind; facelets: string; touched: number[] }

/**
 * Repairs that make the cube valid, cheapest first: one corner turned, one edge flipped, one sticker recoloured,
 * two stickers swapped. The search stops at the first tier that finds anything unless `all` is set.
 */
export function repairs(f: Facelets, opts: { deep?: boolean; all?: boolean } = {}): Repair[] {
  const out: Repair[] = [];
  const tryIt = (kind: RepairKind, g: string, touched: number[]) => { if (core(g).ok) out.push({ kind, facelets: g, touched }); };
  for (let i = 0; i < 8; i++) { tryIt('twist', rotateCornerAt(f, i, 1), [...CORNER_FACELET[i]]); tryIt('twist', rotateCornerAt(f, i, 2), [...CORNER_FACELET[i]]); }
  for (let i = 0; i < 12; i++) tryIt('flip', flipEdgeAt(f, i), [...EDGE_FACELET[i]]);
  if (out.length && !opts.all) return out;
  // one sticker read as the wrong colour (the camera's usual slip)
  for (let a = 0; a < 54; a++) {
    if (isCentre(a)) continue;
    for (const c of FACES) if (c !== f[a]) tryIt('recolour', setAt(f, a, c), [a]);
  }
  if (out.length && !opts.all) return out;
  if (!opts.deep && !opts.all) return out;
  // two stickers in each other's places
  for (let a = 0; a < 54; a++) {
    if (isCentre(a)) continue;
    for (let b = a + 1; b < 54; b++) {
      if (isCentre(b) || f[a] === f[b]) continue;
      tryIt('swap', swapAt(f, a, b), [a, b]);
    }
  }
  return out;
}

const MESSAGES: Record<ValidationReason, string> = {
  incomplete: 'Some stickers are still empty.',
  counts: 'A colour is used more than nine times.',
  centres: 'A centre sticker has the wrong colour.',
  'bad-piece': 'Two of these colours never share a piece.',
  'corner-twist': 'One corner reads turned.',
  'edge-flip': 'One edge reads flipped.',
  parity: 'Two stickers are swapped somewhere.',
};

export function validate(f: Facelets, opts: { recentlyEdited?: number[] } = {}): Validation {
  const r = core(f);
  if (r.ok) return { ok: true };
  let suspects = r.bad;
  let candidates = suspects.length ? 1 : 0;
  if (!suspects.length && r.reason !== 'incomplete') {
    const reps = repairs(f, { deep: r.reason === 'parity' || r.reason === 'bad-piece' }).map((x) => x.touched);
    candidates = reps.length;
    if (reps.length === 1) suspects = reps[0];
    else if (reps.length > 1) {
      const common = reps.reduce((acc, cur) => acc.filter((x) => cur.includes(x)));
      if (common.length) suspects = common;
      else if (opts.recentlyEdited?.length) {
        const recent = reps.filter((rep) => rep.some((x) => opts.recentlyEdited!.includes(x)));
        if (recent.length === 1) suspects = recent[0];
        else if (recent.length > 1) suspects = [...new Set(recent.flat())];
      }
    }
  }
  return { ok: false, reason: r.reason, message: MESSAGES[r.reason], suspects, candidates };
}

/** "the white–green edge", "the white, red and green corner" */
export function describePiece(f: Facelets, facelets: number[]): string {
  const names = facelets.map((i) => FACE_COLOUR[f[i] as Face]);
  return names.length === 2 ? `the ${names[0]}–${names[1]} edge` : `the ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} corner`;
}
