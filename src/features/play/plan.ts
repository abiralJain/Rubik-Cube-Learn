import { useMemo } from 'react';
import type { Face, Facelets } from '@/cube/facelets';
import { FACE_COLOUR, applyMoves } from '@/cube/facelets';
import type { Move } from '@/cube/notation';
import { lbl, type Plan, type StageId, STAGES } from '@/cube/lbl';

export type Card =
  | { type: 'hold'; front: Face; stage: StageId; text: string }
  | { type: 'move'; stage: StageId; stepIndex: number; moveIndex: number; move: Move; display: Move; explanation: string; tip?: string; highlight: number[]; front: Face; firstOfStep: boolean; lastOfStage: boolean }
  | { type: 'done' };

export interface Flat { plan: Plan; cards: Card[]; totalMoves: number; stageFirstCard: Record<StageId, number>; stageLastCard: Record<StageId, number> }

export function flatten(plan: Plan): Flat {
  const cards: Card[] = [];
  let front: Face | null = null;
  let total = 0;
  const stageFirstCard = {} as Record<StageId, number>;
  const stageLastCard = {} as Record<StageId, number>;
  plan.forEach((step, si) => {
    if (step.kind === 'skip' || !step.moves.length) return;
    if (!(step.stage in stageFirstCard)) stageFirstCard[step.stage] = cards.length;
    if (step.orientation.front !== front) {
      front = step.orientation.front;
      cards.push({ type: 'hold', front, stage: step.stage, text: `Hold the cube with yellow on top and the ${FACE_COLOUR[front]} centre facing you.` });
    }
    step.moves.forEach((m, mi) => {
      total++;
      const lastOfStep = mi === step.moves.length - 1;
      const nextSolveStep = plan.slice(si + 1).find((s) => s.kind === 'solve' && s.moves.length);
      cards.push({ type: 'move', stage: step.stage, stepIndex: si, moveIndex: mi, move: m, display: step.displayMoves[mi], explanation: step.explanation, tip: step.tip, highlight: step.highlight, front: step.orientation.front, firstOfStep: mi === 0, lastOfStage: lastOfStep && (!nextSolveStep || nextSolveStep.stage !== step.stage) });
    });
    stageLastCard[step.stage] = cards.length - 1;
  });
  for (const st of STAGES) { if (!(st in stageFirstCard)) { stageFirstCard[st] = -1; stageLastCard[st] = -1; } }
  cards.push({ type: 'done' });
  return { plan, cards, totalMoves: total, stageFirstCard, stageLastCard };
}

/** The cube state before card `index`. */
export function stateAt(start: Facelets, cards: Card[], index: number): Facelets {
  const moves: Move[] = [];
  for (let i = 0; i < index && i < cards.length; i++) { const c = cards[i]; if (c.type === 'move') moves.push(c.move); }
  return applyMoves(start, moves);
}
export const movesBefore = (cards: Card[], index: number) => cards.slice(0, index).filter((c) => c.type === 'move').length;

export function usePlan(start: Facelets | null) {
  return useMemo(() => {
    if (!start) return null;
    try { return flatten(lbl(start)); } catch { return null; }
  }, [start]);
}
