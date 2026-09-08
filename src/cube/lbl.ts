/**
 * Beginner's layer-by-layer teaching solver.
 *
 * Works in a "solver frame" = the standard facelets rotated by z2, so white is on D and yellow on U for the whole
 * solve and the child never flips the cube. Within that frame each step chooses a `front` face and reasons in a
 * view where that face is at F, so every algorithm is literally the same finger sequence each time it recurs.
 *
 * Output moves are mapped back to the standard frame (what the 3D cube and cubejs use). `displayMoves` are what the
 * user, holding yellow up and `front` toward them, actually turns.
 */
import { SOLVED, applyMoves, rotateY, rotateZ2, yIndexMap, Z2_INDEX, FACE_COLOUR, type Face, type Facelets, CENTRE } from './facelets';
import { type Move, parseAlg, rotY, z2Relabel, normalizeMoves, invert } from './notation';
import { CORNER_FACELET, EDGE_FACELET, findCorner, findEdge, toCubies, permutationParity } from './cubies';

export type StageId = 'white-cross' | 'white-corners' | 'middle-edges' | 'yellow-cross' | 'yellow-corners' | 'position-corners' | 'position-edges';
export const STAGES: StageId[] = ['white-cross', 'white-corners', 'middle-edges', 'yellow-cross', 'yellow-corners', 'position-corners', 'position-edges'];
export const STAGE_NAME: Record<StageId, string> = {
  'white-cross': 'White cross', 'white-corners': 'White corners', 'middle-edges': 'Middle layer',
  'yellow-cross': 'Yellow cross', 'yellow-corners': 'Yellow face', 'position-corners': 'Corners home', 'position-edges': 'Edges home',
};
export const STAGE_DONE_LINE: Record<StageId, string> = {
  'white-cross': "That's the white cross.", 'white-corners': 'Bottom layer done.', 'middle-edges': 'Two layers! Now the top.',
  'yellow-cross': 'Yellow cross.', 'yellow-corners': 'All yellow on top.', 'position-corners': 'Corners home.', 'position-edges': 'You solved it.',
};

export interface Step {
  stage: StageId;
  kind: 'solve' | 'skip';
  /** Standard-frame moves (apply to the app's facelets, animate on the 3D cube). */
  moves: Move[];
  /** What the user turns, holding yellow on top and `front` facing them. */
  displayMoves: Move[];
  /** Standard-frame faces: top is always 'D' (yellow). */
  orientation: { top: Face; front: Face };
  explanation: string;
  tip?: string;
  /** Standard-frame facelet indices to highlight before the step. */
  highlight: number[];
  before: Facelets;
  after: Facelets;
}
export type Plan = Step[];

const RING: Face[] = ['F', 'R', 'B', 'L'];
const ringIndex = (f: Face) => RING.indexOf(f);
/** solver-frame face → standard-frame face */
const Z2FACE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'F', B: 'B' };
/** colour word for a solver-frame letter */
const col = (f: Face) => FACE_COLOUR[Z2FACE[f]];

const U_EDGE_POS = [0, 1, 2, 3]; // UR UF UL UB
const alg = (s: string): Move[] => parseAlg(s);

interface Ctx { state: Facelets; steps: RawStep[]; seen: Partial<Record<string, number>> }
interface RawStep { stage: StageId; kind: 'solve' | 'skip'; front: Face; displayMoves: Move[]; explanation: string; tip?: string; highlightView: number[]; before: Facelets; after: Facelets }

export function view(state: Facelets, front: Face) { return rotateY(state, ringIndex(front)); }

/** Push a step found in the view whose front is `front`. highlightView are indices in that view. */
function push(ctx: Ctx, stage: StageId, front: Face, displayMoves: Move[], explanation: string, highlightView: number[], tipKey?: string, tip?: string) {
  const k = ringIndex(front);
  const moves = normalizeMoves(displayMoves).map((m) => rotY(m, k));
  const after = applyMoves(ctx.state, moves);
  let useTip: string | undefined;
  if (tipKey && tip) { ctx.seen[tipKey] = (ctx.seen[tipKey] ?? 0) + 1; if (ctx.seen[tipKey] === 2) useTip = tip; }
  ctx.steps.push({ stage, kind: 'solve', front, displayMoves: normalizeMoves(displayMoves), explanation, tip: useTip, highlightView, before: ctx.state, after });
  ctx.state = after;
}
function skip(ctx: Ctx, stage: StageId) {
  ctx.steps.push({ stage, kind: 'skip', front: 'F', displayMoves: [], explanation: `${STAGE_NAME[stage]} is already done.`, highlightView: [], before: ctx.state, after: ctx.state });
}
/** How many U turns move a U-layer edge from position `from` to `to`. U sends UB→UR→UF→UL (3→0→1→2). */
const U_ORDER = [3, 0, 1, 2]; // successive positions under U
function uTurnsEdge(from: number, to: number): number { const a = U_ORDER.indexOf(from), b = U_ORDER.indexOf(to); return ((b - a) % 4 + 4) % 4; }
/** U sends ULB→UBR→URF→UFL (2→3→0→1). */
const U_ORDER_C = [2, 3, 0, 1];
function uTurnsCorner(from: number, to: number): number { const a = U_ORDER_C.indexOf(from), b = U_ORDER_C.indexOf(to); return ((b - a) % 4 + 4) % 4; }
const uMoves = (n: number): Move[] => (n === 0 ? [] : n === 1 ? ['U'] : n === 2 ? ['U2'] : ["U'"]);

/* ------------------------------------------------------------------ stage 1: white cross */
function whiteCross(ctx: Ctx) {
  const done = (s: Facelets) => RING.every((x) => { const v = view(s, x); return v[28] === 'D' && v[25] === 'F'; });
  if (done(ctx.state)) { skip(ctx, 'white-cross'); return; }
  for (const x of RING) {
    let guard = 0;
    while (guard++ < 8) {
      const v = view(ctx.state, x);
      if (v[28] === 'D' && v[25] === 'F') break;
      const e = findEdge(v, ['D', 'F'])!;
      const name = `the white–${col(x)} edge`;
      const hl = e.facelets;
      if (e.pos >= 4 && e.pos <= 7) {
        // D layer: wrong slot or flipped → lift with a double turn of that slot's face
        const face: Face = (['R', 'F', 'L', 'B'] as Face[])[e.pos - 4]; // DR DF DL DB
        push(ctx, 'white-cross', x, [`${face}2` as Move], `Find ${name}. It's on the bottom but not where it belongs, so send it up to the top first.`, hl);
        continue;
      }
      if (e.pos >= 8) {
        // E layer: turn the face the white sticker is NOT on so the edge comes up to the top, spin the top, put the face back
        const [a, b] = EDGE_FACELET[e.pos].map((i) => faceOfIndex(i));
        const whiteOn = faceOfIndex(e.stickers['D']);
        const turnFace = whiteOn === a ? b : a;
        const up = ([turnFace, `${turnFace}'`] as Move[]).find((m) => { const t = applyMoves(v, [m]); const ee = findEdge(t, ['D', 'F'])!; return ee.pos <= 3; })!;
        push(ctx, 'white-cross', x, [up, 'U', invert(up)], `Find ${name}. It's in the middle layer. Turn the ${col(turnFace)} side to lift it to the top, spin the top once, and turn the ${col(turnFace)} side back.`, hl, 'cross-lift', "Same idea every time: lift it to the top, spin the top, put the side back.");
        continue;
      }
      // U layer
      const n = uTurnsEdge(e.pos, 1);
      const whiteUp = faceOfIndex(e.stickers['D']) === 'U';
      if (whiteUp) {
        push(ctx, 'white-cross', x, [...uMoves(n), 'F2'], `Find ${name}. Spin the top until it sits above the ${col(x)} centre, then turn the ${col(x)} side twice to bring it down.`, hl, 'cross-drop', "You'll do this for every cross piece: line it up on top, then two turns down.");
      } else {
        push(ctx, 'white-cross', x, [...uMoves(n), "U'", "R'", 'F', 'R'], `Find ${name}. Its white is facing sideways. Spin it above the ${col(x)} centre, then: top left, right down, ${col(x)} clockwise, right up.`, hl, 'cross-side', 'When white faces sideways, this little four-turn twist flips it into place.');
      }
    }
  }
}
function faceOfIndex(i: number): Face { return (['U', 'R', 'F', 'D', 'L', 'B'] as Face[])[Math.floor(i / 9)]; }

/* ------------------------------------------------------------------ stage 2: white corners */
function whiteCorners(ctx: Ctx) {
  const solvedAt = (v: Facelets) => v[29] === 'D' && v[26] === 'F' && v[15] === 'R';
  if (RING.every((x) => solvedAt(view(ctx.state, x)))) { skip(ctx, 'white-corners'); return; }
  for (const x of RING) {
    let guard = 0;
    while (guard++ < 6) {
      const v = view(ctx.state, x);
      if (solvedAt(v)) break;
      const y = RING[(ringIndex(x) + 1) % 4];
      const c = findCorner(v, ['D', 'F', 'R'])!;
      const name = `the white, ${col(x)} and ${col(y)} corner`;
      if (c.pos >= 4) {
        // in the bottom layer but wrong (or twisted): pop it up from its own slot
        const slotFront = RING[(ringIndex(x) + [0, 1, 2, 3][c.pos - 4]) % 4]; // DFR DLF DBL DRB → which front makes it DFR
        const frontFor: Record<number, number> = { 4: 0, 5: 3, 6: 2, 7: 1 };
        const f2 = RING[(ringIndex(x) + frontFor[c.pos]) % 4];
        void slotFront;
        push(ctx, 'white-corners', f2, alg("R U R'"), `Find ${name}. It's in the bottom layer but in the wrong place, so pop it up to the top first.`, c.facelets);
        continue;
      }
      const n = uTurnsCorner(c.pos, 0);
      const v2 = applyMoves(v, uMoves(n));
      const c2 = findCorner(v2, ['D', 'F', 'R'])!;
      const whiteAt = c2.stickers['D'];
      if (whiteAt === 9) push(ctx, 'white-corners', x, [...uMoves(n), ...alg("R U R'")], `Find ${name}. Spin the top so it sits above its corner. White faces right, so: right up, top left, right down.`, c.facelets, 'corner-right', 'Every corner works like this: park it above its home, then right up, top left, right down.');
      else if (whiteAt === 20) push(ctx, 'white-corners', x, [...uMoves(n), ...alg("F' U' F")], `Find ${name}. Spin the top so it sits above its corner. White faces you, so: ${col(x)} back, top right, ${col(x)} forward.`, c.facelets, 'corner-front', 'When white faces you, use the mirror: front back, top right, front forward.');
      else push(ctx, 'white-corners', x, [...uMoves(n), ...alg("R U2 R' U' R U R'")], `Find ${name}. Spin the top so it sits above its corner. White is on top, so it needs a longer dance: right up, top twice, right down, top right, right up, top left, right down.`, c.facelets, 'corner-top', 'White on top is the long one. It turns into the short one halfway through.');
    }
  }
}

/* ------------------------------------------------------------------ stage 3: middle edges */
function middleEdges(ctx: Ctx) {
  const solvedAt = (v: Facelets) => v[23] === 'F' && v[12] === 'R';
  if (RING.every((x) => solvedAt(view(ctx.state, x)))) { skip(ctx, 'middle-edges'); return; }
  const RIGHT = alg("U R U' R' U' F' U F");
  const LEFT = alg("U' L' U L U F U' F'");
  for (const x of RING) {
    let guard = 0;
    while (guard++ < 6) {
      const v = view(ctx.state, x);
      if (solvedAt(v)) break;
      const y = RING[(ringIndex(x) + 1) % 4];
      const e = findEdge(v, ['F', 'R'])!;
      const name = `the ${col(x)}–${col(y)} edge`;
      if (e.pos >= 8) {
        // stuck in the middle layer (wrong slot or flipped): pop it out with the right insert at that slot
        const slotFront = RING[(ringIndex(x) + [0, 3, 2, 1][e.pos - 8]) % 4]; // FR FL BL BR
        push(ctx, 'middle-edges', slotFront, RIGHT, `Find ${name}. It's in the middle layer but not home. Do the right-hand insert here to pop it up to the top.`, e.facelets);
        continue;
      }
      // in the U layer: which sticker is on the side, and what colour is it?
      const sideIdx = EDGE_FACELET[e.pos].find((i) => faceOfIndex(i) !== 'U')!;
      const sideColour = v[sideIdx] as Face; // 'F' or 'R' in this view
      if (sideColour === 'F') {
        const n = uTurnsEdge(e.pos, 1);
        push(ctx, 'middle-edges', x, [...uMoves(n), ...RIGHT], `Find ${name}. Spin the top so its ${col(x)} sticker sits over the ${col(x)} centre. Its top colour matches the right side, so use the right-hand insert.`, e.facelets, 'insert-right', 'Only two moves to learn in this layer: the right-hand insert and its mirror.');
      } else {
        // side sticker is the y colour: work from y's view, where the slot is on the left
        const vy = view(ctx.state, y);
        const ey = findEdge(vy, ['L', 'F'])!;
        const n = uTurnsEdge(ey.pos, 1);
        push(ctx, 'middle-edges', y, [...uMoves(n), ...LEFT], `Find ${name}. Spin the top so its ${col(y)} sticker sits over the ${col(y)} centre. Its top colour matches the left side, so use the left-hand insert.`, ey.facelets, 'insert-left', 'The left-hand insert is the right-hand one in a mirror.');
      }
    }
  }
}

/* ------------------------------------------------------------------ stage 4: yellow cross */
function yellowCross(ctx: Ctx) {
  const count = (s: Facelets) => [1, 3, 5, 7].filter((i) => s[i] === 'U').length;
  if (count(ctx.state) === 4) { skip(ctx, 'yellow-cross'); return; }
  const A = alg("F R U R' U' F'");
  const B = alg("F U R U' R' F'");
  let guard = 0;
  while (count(ctx.state) < 4 && guard++ < 4) {
    let best: { front: Face; moves: Move[]; score: number } | null = null;
    for (const front of RING) for (const moves of [A, B]) {
      const v = view(ctx.state, front);
      const c = count(applyMoves(v, moves));
      const score = c === 4 ? 10 : c;
      if (!best || score > best.score) best = { front, moves, score };
    }
    const n = count(ctx.state);
    const shape = n === 0 ? 'a yellow dot' : n === 2 && isLine(ctx.state) ? 'a yellow line' : 'a yellow L';
    const hl = [1, 3, 5, 7].filter((i) => ctx.state[i] === 'U');
    const v = view(ctx.state, best!.front);
    const hlView = [1, 3, 5, 7].filter((i) => v[i] === 'U');
    void hl;
    push(ctx, 'yellow-cross', best!.front, best!.moves, `Look only at the yellow edges on top: you have ${shape}. Hold the ${col(best!.front)} side toward you and do the six-turn cross move.`, hlView.length ? hlView : [4], 'yellow-cross', 'A dot becomes an L, an L becomes a cross. Same six turns.');
  }
}
const isLine = (s: Facelets) => (s[3] === 'U' && s[5] === 'U') || (s[1] === 'U' && s[7] === 'U');

/* ------------------------------------------------------------------ stage 5: yellow corners (orientation) */
function yellowCorners(ctx: Ctx) {
  const count = (s: Facelets) => [0, 2, 6, 8].filter((i) => s[i] === 'U').length;
  if (count(ctx.state) === 4) { skip(ctx, 'yellow-corners'); return; }
  const SUNE = alg("R U R' U R U2 R'");
  let guard = 0;
  while (count(ctx.state) < 4 && guard++ < 6) {
    let best: { front: Face; score: number } | null = null;
    for (const front of RING) {
      const v = view(ctx.state, front);
      const a = applyMoves(v, SUNE);
      const c = count(a);
      const score = c === 4 ? 10 : c === 1 && a[6] === 'U' && a[20] === 'U' ? 5 : c === 1 ? 2 : c === 2 ? 1 : 0;
      if (!best || score > best.score) best = { front, score };
    }
    const n = count(ctx.state);
    const hold = n === 1 ? 'the finished yellow corner at the front-left' : n === 0 ? 'a corner with yellow on its left face at the front-left' : 'a corner with yellow facing you at the front-left';
    const v = view(ctx.state, best!.front);
    const hlView = [0, 2, 6, 8].filter((i) => v[i] === 'U');
    push(ctx, 'yellow-corners', best!.front, SUNE, `Hold the ${col(best!.front)} side toward you, with ${hold}. Then the seven-turn move: right up, top left, right down, top left, right up, top twice, right down.`, hlView.length ? hlView : [4], 'sune', 'This is the only move in this stage. If the top is not all yellow yet, hold it the new way and do it again.');
  }
}

/* ------------------------------------------------------------------ stage 6: position corners */
function positionCorners(ctx: Ctx) {
  // With yellow up, a corner is home when its two side stickers match the centres. Checked at UFL in each view.
  const homeAt = (v: Facelets) => v[18] === 'F' && v[38] === 'L';
  const homeCount = (s: Facelets) => RING.filter((x) => homeAt(view(s, x))).length;
  const A = alg("R' F R' B2 R F' R' B2 R2"); // pure corner 3-cycle, keeps UFL, keeps yellow up, keeps edges
  if (homeCount(ctx.state) === 4) { skip(ctx, 'position-corners'); return; }
  // Corner parity: a 3-cycle is even, so if the top corners form an odd permutation we must spin the top once first.
  const cornerParity = (st: Facelets) => { const r = toCubies(st); return r.ok ? permutationParity(r.cube.cp.slice(0, 4)) : 0; };
  let guard = 0;
  while (guard++ < 6) {
    let bestN = -1, bestC = -1;
    for (let n = 0; n < 4; n++) {
      const st = applyMoves(ctx.state, uMoves(n));
      if (cornerParity(st) !== 0) continue;
      const c = homeCount(st);
      if (c > bestC) { bestC = c; bestN = n; }
    }
    if (bestN < 0) bestN = 0;
    if (bestC === 4) { if (bestN) push(ctx, 'position-corners', 'F', uMoves(bestN), 'Spin the top so every corner sits between its own two colours.', [0, 2, 6, 8]); break; }
    if (bestN) { push(ctx, 'position-corners', 'F', uMoves(bestN), 'Spin the top one click so the corners can cycle home.', [0, 2, 6, 8]); continue; }
    if (bestC === 1) {
      const front = RING.find((x) => homeAt(view(ctx.state, x)))!;
      push(ctx, 'position-corners', front, A, `One corner is already home. Hold the ${col(front)} side toward you so that corner is at the front-left, then do the nine-turn corner move; the other three cycle round.`, [6, 18, 38], 'corner-cycle', 'Not all home yet? Hold it the same way and do the move again.');
    } else {
      push(ctx, 'position-corners', 'F', A, 'No corner is home yet. Hold the green side toward you and do the nine-turn corner move once; afterwards one corner will be home.', [0, 2, 6, 8], 'corner-cycle', 'Not all home yet? Find the one that is, hold it front-left, and do it again.');
    }
  }
}

/* ------------------------------------------------------------------ stage 7: position edges */
function positionEdges(ctx: Ctx) {
  const correct = (s: Facelets) => U_EDGE_POS.filter((p) => { const i = EDGE_FACELET[p][1]; return s[i] === faceOfIndex(i); });
  const E = alg("R U' R U R U R U' R' U' R2");
  if (correct(ctx.state).length === 4) { skip(ctx, 'position-edges'); return; }
  let guard = 0;
  while (correct(ctx.state).length < 4 && guard++ < 4) {
    const ok = correct(ctx.state);
    if (ok.length === 1) {
      // hold the solved edge at the back: its face is opposite the front
      const edgeFace = faceOfIndex(EDGE_FACELET[ok[0]][1]);
      const front = RING[(ringIndex(edgeFace) + 2) % 4];
      push(ctx, 'position-edges', front, E, `One top edge is already home. Hold the cube with the ${col(front)} side toward you so that edge is at the back, then do the eleven-turn edge move.`, [1, 3, 5, 7].filter((i) => view(ctx.state, front)[i] === 'U'), 'edge-cycle', 'If the edges are not all home after one go, do the same move again.');
    } else {
      push(ctx, 'position-edges', 'F', E, 'No top edge is home yet. Hold the green side toward you and do the eleven-turn edge move once; then one edge will be home.', [1, 3, 5, 7], 'edge-cycle', 'If the edges are not all home after one go, do the same move again.');
    }
  }
}

/* ------------------------------------------------------------------ driver */
export class SolverError extends Error { constructor(msg: string, public facelets: string) { super(msg); } }

export function lbl(standardFacelets: Facelets): Plan {
  const ctx: Ctx = { state: rotateZ2(standardFacelets), steps: [], seen: {} };
  whiteCross(ctx); whiteCorners(ctx); middleEdges(ctx); yellowCross(ctx); yellowCorners(ctx); positionCorners(ctx); positionEdges(ctx);
  if (ctx.state !== SOLVED) throw new SolverError('did not reach solved', standardFacelets);
  return ctx.steps.map((s) => toStandard(s));
}

function toStandard(s: RawStep): Step {
  const k = ringIndex(s.front);
  const moves = s.displayMoves.map((m) => z2Relabel(rotY(m, k)));
  const viewMap = yIndexMap(k); // view index → solver index
  const highlight = s.highlightView.map((i) => Z2_INDEX.indexOf(viewMap[i]));
  return {
    stage: s.stage, kind: s.kind, moves, displayMoves: s.displayMoves,
    orientation: { top: 'D', front: Z2FACE[s.front] },
    explanation: s.explanation, tip: s.tip, highlight,
    before: rotateZ2(s.before), after: rotateZ2(s.after),
  };
}

/** Debug: run stages one by one and report the solver-frame state after each. */
export function lblTrace(standardFacelets: Facelets) {
  const ctx: Ctx = { state: rotateZ2(standardFacelets), steps: [], seen: {} };
  const out: Array<{ stage: StageId; state: Facelets; steps: number }> = [];
  const fns: Array<[StageId, (c: Ctx) => void]> = [['white-cross', whiteCross], ['white-corners', whiteCorners], ['middle-edges', middleEdges], ['yellow-cross', yellowCross], ['yellow-corners', yellowCorners], ['position-corners', positionCorners], ['position-edges', positionEdges]];
  for (const [id, fn] of fns) { try { fn(ctx); } catch (e) { out.push({ stage: id, state: 'ERR ' + (e as Error).message, steps: ctx.steps.length }); break; } out.push({ stage: id, state: ctx.state, steps: ctx.steps.length }); }
  return out;
}
export const planMoveCount = (plan: Plan) => plan.reduce((n, s) => n + s.moves.length, 0);
void CENTRE; void CORNER_FACELET;
