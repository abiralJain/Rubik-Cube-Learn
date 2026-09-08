import type { Face } from './facelets';

export type BaseMove = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Move = `${BaseMove}` | `${BaseMove}'` | `${BaseMove}2`;

export const BASES: readonly BaseMove[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export function parseMove(s: string): Move {
  const m = s.trim();
  if (!/^[URFDLB](2|')?$/.test(m)) throw new Error(`Bad move: ${s}`);
  return m as Move;
}
export const parseAlg = (alg: string): Move[] => alg.trim().split(/\s+/).filter(Boolean).map(parseMove);
export const faceOfMove = (m: Move): BaseMove => m[0] as BaseMove;
/** 1 = quarter CW, 2 = half, 3 = quarter CCW */
export const turnsOf = (m: Move): 1 | 2 | 3 => (m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1);
export const makeMove = (f: BaseMove, turns: number): Move | null => {
  const t = ((turns % 4) + 4) % 4;
  return t === 0 ? null : t === 1 ? f : t === 2 ? (`${f}2` as Move) : (`${f}'` as Move);
};
export const invert = (m: Move): Move => makeMove(faceOfMove(m), 4 - turnsOf(m))!;
export const invertAll = (ms: readonly Move[]): Move[] => ms.slice().reverse().map(invert);

/** Merge adjacent same-face turns and drop cancellations. */
export function normalizeMoves(ms: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const m of ms) {
    const last = out[out.length - 1];
    if (last && faceOfMove(last) === faceOfMove(m)) {
      out.pop();
      const merged = makeMove(faceOfMove(m), turnsOf(last) + turnsOf(m));
      if (merged) out.push(merged);
    } else out.push(m);
  }
  return out;
}

/** Relabel a move written for front=F so it applies when the working front is `k` quarter turns clockwise (F→R→B→L). */
const RING: Face[] = ['F', 'R', 'B', 'L'];
export function rotY(m: Move, k: number): Move {
  const f = faceOfMove(m);
  const i = RING.indexOf(f);
  if (i < 0) return m;
  return (RING[(i + k) % 4] + m.slice(1)) as Move;
}
export const ringIndex = (front: Face) => Math.max(0, RING.indexOf(front));

/** Letter relabel for a z2 whole-cube rotation: U↔D, R↔L. Directions are unchanged. */
export function z2Relabel(m: Move): Move {
  const map: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R' };
  return ((map[m[0]] ?? m[0]) + m.slice(1)) as Move;
}

/** Plain language for a child holding the cube: top = U, front = F, right = R. */
export function describe(m: Move): string {
  const t = turnsOf(m);
  const f = faceOfMove(m);
  if (t === 2) return ({
    U: 'Turn the top layer halfway round.', D: 'Turn the bottom layer halfway round.',
    R: 'Turn the right side halfway round.', L: 'Turn the left side halfway round.',
    F: 'Turn the front halfway round.', B: 'Turn the back halfway round.',
  } as Record<BaseMove, string>)[f];
  const cw = t === 1;
  switch (f) {
    case 'U': return cw ? 'Turn the top layer to the left.' : 'Turn the top layer to the right.';
    case 'D': return cw ? 'Turn the bottom layer to the right.' : 'Turn the bottom layer to the left.';
    case 'R': return cw ? 'Turn the right side up, away from you.' : 'Turn the right side down, toward you.';
    case 'L': return cw ? 'Turn the left side down, toward you.' : 'Turn the left side up, away from you.';
    case 'F': return cw ? 'Turn the front like a clock.' : 'Turn the front backwards, like a clock going back.';
    case 'B': return cw ? 'Turn the back so its top slides to your left.' : 'Turn the back so its top slides to your right.';
  }
}
