import { type Face, type Facelets, idx } from './facelets';

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const;

/** Facelet indices of each corner position, clockwise starting with the U/D sticker (Kociemba, 0-based). */
export const CORNER_FACELET: readonly number[][] = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
export const EDGE_FACELET: readonly number[][] = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25], [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
export const CORNER_COLOR: readonly Face[][] = [
  ['U', 'R', 'F'], ['U', 'F', 'L'], ['U', 'L', 'B'], ['U', 'B', 'R'],
  ['D', 'F', 'R'], ['D', 'L', 'F'], ['D', 'B', 'L'], ['D', 'R', 'B'],
];
export const EDGE_COLOR: readonly Face[][] = [
  ['U', 'R'], ['U', 'F'], ['U', 'L'], ['U', 'B'], ['D', 'R'], ['D', 'F'], ['D', 'L'], ['D', 'B'], ['F', 'R'], ['F', 'L'], ['B', 'L'], ['B', 'R'],
];

export interface CubieCube { cp: number[]; co: number[]; ep: number[]; eo: number[] }

export type ToCubies = { ok: true; cube: CubieCube } | { ok: false; badFacelets: number[] };

/** Kociemba's facelet → cubie conversion. Fails (with the offending facelets) on impossible pieces. */
export function toCubies(f: Facelets): ToCubies {
  const cp: number[] = [], co: number[] = [], ep: number[] = [], eo: number[] = [];
  for (let i = 0; i < 8; i++) {
    const fc = CORNER_FACELET[i];
    let ori = 0;
    while (ori < 3 && f[fc[ori]] !== 'U' && f[fc[ori]] !== 'D') ori++;
    if (ori === 3) return { ok: false, badFacelets: [...fc] };
    const c1 = f[fc[(ori + 1) % 3]], c2 = f[fc[(ori + 2) % 3]];
    const j = CORNER_COLOR.findIndex((cc) => cc[1] === c1 && cc[2] === c2);
    if (j < 0 || CORNER_COLOR[j][0] !== f[fc[ori]]) return { ok: false, badFacelets: [...fc] };
    cp[i] = j; co[i] = ori;
  }
  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELET[i];
    let j = EDGE_COLOR.findIndex((ec) => ec[0] === f[a] && ec[1] === f[b]);
    let ori = 0;
    if (j < 0) { j = EDGE_COLOR.findIndex((ec) => ec[0] === f[b] && ec[1] === f[a]); ori = 1; }
    if (j < 0) return { ok: false, badFacelets: [a, b] };
    ep[i] = j; eo[i] = ori;
  }
  return { ok: true, cube: { cp, co, ep, eo } };
}

export function toFacelets(c: CubieCube): Facelets {
  const out = new Array<string>(54).fill('.');
  for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) out[CORNER_FACELET[i][(k + c.co[i]) % 3]] = CORNER_COLOR[c.cp[i]][k];
  for (let i = 0; i < 12; i++) for (let k = 0; k < 2; k++) out[EDGE_FACELET[i][(k + c.eo[i]) % 2]] = EDGE_COLOR[c.ep[i]][k];
  for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as Face[]) out[idx(face, 4)] = face;
  return out.join('');
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Find the corner piece with these three colours. Returns its position, its facelets there, and where each colour sits. */
export function findCorner(f: Facelets, colours: readonly Face[]): { pos: number; facelets: number[]; stickers: Record<string, number> } | null {
  for (let i = 0; i < 8; i++) {
    const fc = CORNER_FACELET[i];
    const cols = fc.map((x) => f[x]);
    if (sameSet(cols, colours)) {
      const stickers: Record<string, number> = {};
      fc.forEach((x) => { stickers[f[x]] = x; });
      return { pos: i, facelets: [...fc], stickers };
    }
  }
  return null;
}
export function findEdge(f: Facelets, colours: readonly Face[]): { pos: number; facelets: number[]; stickers: Record<string, number> } | null {
  for (let i = 0; i < 12; i++) {
    const fe = EDGE_FACELET[i];
    const cols = fe.map((x) => f[x]);
    if (sameSet(cols, colours)) {
      const stickers: Record<string, number> = {};
      fe.forEach((x) => { stickers[f[x]] = x; });
      return { pos: i, facelets: [...fe], stickers };
    }
  }
  return null;
}

export function permutationParity(p: readonly number[]): 0 | 1 {
  let parity = 0;
  const seen = new Array(p.length).fill(false);
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let j = i, len = 0;
    while (!seen[j]) { seen[j] = true; j = p[j]; len++; }
    if (len % 2 === 0) parity ^= 1;
  }
  return parity as 0 | 1;
}
