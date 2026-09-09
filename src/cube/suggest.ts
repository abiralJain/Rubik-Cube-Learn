/**
 * Turns an invalid cube into a ranked list of concrete fixes in plain words: "This corner is turned. It should read
 * white, red and green." Each suggestion carries the repaired facelets, so applying it is one tap.
 */
import { FACE_COLOUR, faceOf, type Face, type Facelets } from './facelets';
import { CORNER_FACELET, EDGE_FACELET } from './cubies';
import { core, repairs, type Repair, type ValidationReason } from './validate';

export interface Suggestion extends Repair {
  /** One short sentence naming what is wrong. */
  sentence: string;
  /** One sentence saying what the stickers should be. */
  detail: string;
}
export interface Suggestions { reason: ValidationReason | null; top: Suggestion | null; all: Suggestion[] }

const cache = new Map<string, Suggestions>();
const colour = (c: string) => FACE_COLOUR[c as Face] ?? c;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function suggest(f: Facelets, opts: { recentlyEdited?: number[] } = {}): Suggestions {
  const key = f + '|' + (opts.recentlyEdited ?? []).join(',');
  const hit = cache.get(key); if (hit) return hit;
  const r = core(f);
  if (r.ok || r.reason === 'incomplete') return { reason: r.ok ? null : r.reason, top: null, all: [] };
  let reps = repairs(f, { deep: true });
  // rank: fewest stickers changed; then a recent edit is the likelier slip; keep the list short
  const recent = new Set(opts.recentlyEdited ?? []);
  const score = (x: Repair) => x.touched.length * 10 - (x.touched.some((i) => recent.has(i)) ? 5 : 0) + (x.kind === 'swap' ? 3 : 0);
  reps = reps.sort((a, b) => score(a) - score(b)).slice(0, 6);
  const all = reps.map((x) => describe(f, x));
  const out: Suggestions = { reason: r.reason, top: all[0] ?? null, all };
  if (cache.size > 64) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return out;
}

function describe(f: Facelets, x: Repair): Suggestion {
  const after = x.facelets;
  if (x.kind === 'twist') {
    const names = x.touched.map((i) => colour(after[i]));
    return { ...x, sentence: 'One corner is turned.', detail: `The lit corner should read ${list(names)}, going round.` };
  }
  if (x.kind === 'flip') {
    const [a, b] = x.touched;
    return { ...x, sentence: 'One edge is flipped.', detail: `The lit edge should be ${colour(after[a])} on the ${colour(faceOf(a))} side and ${colour(after[b])} on the ${colour(faceOf(b))} side.` };
  }
  if (x.kind === 'recolour') {
    const i = x.touched[0];
    return { ...x, sentence: 'One sticker reads wrong.', detail: `The lit ${colour(f[i])} sticker on the ${colour(faceOf(i))} side should be ${colour(after[i])}.` };
  }
  const [a, b] = x.touched;
  return { ...x, sentence: 'Two stickers are swapped.', detail: `The ${colour(f[a])} on the ${colour(faceOf(a))} side and the ${colour(f[b])} on the ${colour(faceOf(b))} side belong in each other's places.` };
}

/** The piece (corner or edge) a sticker belongs to, as facelet indices. */
export function pieceOf(i: number): number[] {
  return CORNER_FACELET.find((c) => c.includes(i)) ?? EDGE_FACELET.find((e) => e.includes(i)) ?? [i];
}
