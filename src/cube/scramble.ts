import { toFacelets, permutationParity } from './cubies';
import type { Facelets } from './facelets';
import { BASES, makeMove, type Move } from './notation';

/** Deterministic PRNG (mulberry32) so scrambles can be reproduced from a seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(arr: T[], rng: () => number) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/** A uniformly random solvable cube state: random permutations with equal parity, twists summing to 0 mod 3, flips to 0 mod 2. */
export function randomState(rng: () => number = Math.random): Facelets {
  const cp = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
  const ep = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], rng);
  if (permutationParity(cp) !== permutationParity(ep)) [ep[0], ep[1]] = [ep[1], ep[0]];
  const co = Array.from({ length: 8 }, () => Math.floor(rng() * 3));
  co[7] = (3 - (co.slice(0, 7).reduce((a, b) => a + b, 0) % 3)) % 3;
  const eo = Array.from({ length: 12 }, () => Math.floor(rng() * 2));
  eo[11] = eo.slice(0, 11).reduce((a, b) => a + b, 0) % 2;
  return toFacelets({ cp, co, ep, eo });
}

/** A move sequence a child can apply to a real cube: no face twice in a row, no three moves on one axis. */
export function randomScramble(n = 20, rng: () => number = Math.random): Move[] {
  const axis = (f: string) => ({ U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 })[f]!;
  const out: Move[] = [];
  while (out.length < n) {
    const f = BASES[Math.floor(rng() * 6)];
    const last = out[out.length - 1], prev = out[out.length - 2];
    if (last && last[0] === f) continue;
    if (last && prev && axis(last[0]) === axis(f) && axis(prev[0]) === axis(f)) continue;
    out.push(makeMove(f, 1 + Math.floor(rng() * 3))!);
  }
  return out;
}
