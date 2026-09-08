/**
 * Facelet model. 54 characters in cubejs / Kociemba order: U R F D L B, 9 per face,
 * each face read left→right, top→bottom when looking straight at it
 * (U with B at the top, D with F at the top, B seen from behind).
 * Letters name the colour by its home face; '.' is an unpainted sticker.
 * Standard scheme: U white, D yellow, F green, B blue, R red, L orange.
 */
import type { Move } from './notation';
import { parseMove } from './notation';

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Facelet = Face | '.';
export type Facelets = string;

export const FACES: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SOLVED: Facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
export const FACE_COLOUR: Record<Face, string> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };
export const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

export const faceOf = (i: number): Face => FACES[Math.floor(i / 9)];
export const posOf = (i: number): number => i % 9;
export const idx = (f: Face, p: number): number => FACES.indexOf(f) * 9 + p;
export const CENTRE: Record<Face, number> = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 };
export const isCentre = (i: number) => i % 9 === 4;

/** Quarter-turn cycles, clockwise looking at the face: a→b→c→d→a. */
const CYCLES: Record<Face, number[][]> = {
  U: [[0, 2, 8, 6], [1, 5, 7, 3], [18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11]],
  R: [[9, 11, 17, 15], [10, 14, 16, 12], [20, 2, 51, 29], [26, 8, 45, 35], [23, 5, 48, 32]],
  F: [[18, 20, 26, 24], [19, 23, 25, 21], [8, 15, 27, 38], [9, 29, 44, 6], [7, 12, 28, 41]],
  D: [[27, 29, 35, 33], [28, 32, 34, 30], [24, 15, 51, 42], [26, 17, 53, 44], [25, 16, 52, 43]],
  L: [[36, 38, 44, 42], [37, 41, 43, 39], [0, 18, 27, 53], [6, 24, 33, 47], [3, 21, 30, 50]],
  B: [[45, 47, 53, 51], [46, 50, 52, 48], [2, 36, 33, 17], [11, 0, 42, 35], [1, 39, 34, 14]],
};

/** perm[dst] = src for a single clockwise quarter turn. */
function permFromCycles(cycles: number[][]): Int8Array {
  const p = new Int8Array(54);
  for (let i = 0; i < 54; i++) p[i] = i;
  for (const c of cycles) for (let k = 0; k < c.length; k++) p[c[(k + 1) % c.length]] = c[k];
  return p;
}
function compose(a: Int8Array, b: Int8Array): Int8Array {
  // apply a then b: out[dst] = a[b[dst]]
  const out = new Int8Array(54);
  for (let i = 0; i < 54; i++) out[i] = a[b[i]];
  return out;
}

const QUARTER: Record<Face, Int8Array> = Object.fromEntries(FACES.map((f) => [f, permFromCycles(CYCLES[f])])) as Record<Face, Int8Array>;

export const PERM: Record<Move, Int8Array> = (() => {
  const out = {} as Record<Move, Int8Array>;
  for (const f of FACES) {
    const q = QUARTER[f];
    out[f as Move] = q;
    out[`${f}2` as Move] = compose(q, q);
    out[`${f}'` as Move] = compose(compose(q, q), q);
  }
  return out;
})();

export function applyMove(f: Facelets, m: Move): Facelets {
  const p = PERM[m];
  if (!p) throw new Error(`Unknown move ${m}`);
  let out = '';
  for (let i = 0; i < 54; i++) out += f[p[i]];
  return out;
}
export const applyMoves = (f: Facelets, ms: readonly Move[]): Facelets => ms.reduce(applyMove, f);

/** Whole-cube y rotation (the whole cube turns like a U move) with letters relabelled so centres stay canonical. */
export function rotateY(f: Facelets, times = 1): Facelets {
  let s = f;
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
    let out = '';
    for (let i = 0; i < 54; i++) out += s[Y_FULL[i]];
    s = relabel(out, { F: 'L', L: 'B', B: 'R', R: 'F' } as Partial<Record<Face, Face>>);
  }
  return s;
}
// Full y permutation: U layer turns like U, D layer like D', side faces shift F→L→B→R→F.
const Y_FULL: Int8Array = (() => {
  const p = new Int8Array(54);
  for (let i = 0; i < 54; i++) p[i] = i;
  // U face rotates CW as seen from above: same as U cycles [0,2,8,6],[1,5,7,3]
  for (const c of CYCLES.U.slice(0, 2)) for (let k = 0; k < 4; k++) p[c[(k + 1) % 4]] = c[k];
  // D face rotates CCW as seen from below (i.e. D' cycles)
  for (const c of CYCLES.D.slice(0, 2)) for (let k = 0; k < 4; k++) p[c[k]] = c[(k + 1) % 4];
  // side faces: whole face F moves to L position, L→B, B→R, R→F (as U cycle sends F stickers to L)
  const shift: Array<[Face, Face]> = [['F', 'L'], ['L', 'B'], ['B', 'R'], ['R', 'F']];
  for (const [from, to] of shift) for (let k = 0; k < 9; k++) p[idx(to, k)] = idx(from, k);
  return p;
})();

/** z2: rotate the whole cube 180° about the F–B axis. U↔D, R↔L with local index reversed; F and B reversed in place. */
export function rotateZ2(f: Facelets): Facelets {
  const out = new Array<string>(54);
  const swap: Array<[Face, Face]> = [['U', 'D'], ['D', 'U'], ['R', 'L'], ['L', 'R'], ['F', 'F'], ['B', 'B']];
  for (const [from, to] of swap) for (let k = 0; k < 9; k++) out[idx(to, 8 - k)] = f[idx(from, k)];
  return relabel(out.join(''), { U: 'D', D: 'U', R: 'L', L: 'R' });
}

export function relabel(f: Facelets, map: Partial<Record<Face, Face>>): Facelets {
  let out = '';
  for (const ch of f) out += (map as Record<string, string>)[ch] ?? ch;
  return out;
}

export const isComplete = (f: Facelets) => !f.includes('.');
export const countOf = (f: Facelets, c: Facelet) => f.split('').filter((x) => x === c).length;
export const isSolved = (f: Facelets) => f === SOLVED;

export { parseMove };
