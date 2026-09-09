/**
 * The autopilot: a small state machine that runs the solve without a tap.
 *   idle → speaking → waiting (the arrow sweeps, a ring drains for `pace` seconds) → playing (the on-screen cube turns)
 *   → breath → next card.
 * Pausing freezes it in place; resuming continues from the same phase. Pure: the page feeds it events and reads
 * back what to do, so it can be tested without a browser.
 */
export type Phase = 'idle' | 'speaking' | 'waiting' | 'playing' | 'breath' | 'paused' | 'done';

export interface Auto {
  phase: Phase;
  /** Phase we were in when paused, to resume there. */
  before: Exclude<Phase, 'paused'> | null;
  /** 0..1 progress of the wait. */
  progress: number;
  /** Seconds waited so far in this card. */
  waited: number;
  /** Consecutive replays on this card (used to slow the pace). */
  replays: number;
  card: number;
}

export type Event =
  | { type: 'card'; index: number }
  | { type: 'spoken' }
  | { type: 'tick'; dt: number; pace: number }
  | { type: 'played' }
  | { type: 'breathed' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'again' }
  | { type: 'finish' };

export type Effect = 'speak' | 'play' | 'advance' | 'sweep' | 'replay';

export const initial: Auto = { phase: 'idle', before: null, progress: 0, waited: 0, replays: 0, card: -1 };

export function reduce(a: Auto, e: Event): { state: Auto; effects: Effect[] } {
  const fx: Effect[] = [];
  let s = { ...a };
  switch (e.type) {
    case 'card':
      s = { ...s, phase: a.phase === 'paused' ? 'paused' : 'speaking', before: a.phase === 'paused' ? 'speaking' : null, progress: 0, waited: 0, replays: 0, card: e.index };
      if (a.phase !== 'paused') fx.push('speak');
      break;
    case 'spoken':
      if (s.phase === 'speaking') { s.phase = 'waiting'; s.progress = 0; s.waited = 0; fx.push('sweep'); }
      else if (s.phase === 'paused' && s.before === 'speaking') s.before = 'waiting';
      break;
    case 'tick':
      if (s.phase === 'waiting') {
        s.waited += e.dt;
        s.progress = Math.min(1, s.waited / e.pace);
        if (s.waited >= e.pace) { s.phase = 'playing'; fx.push('play'); }
      }
      break;
    case 'played':
      if (s.phase === 'playing') s.phase = 'breath';
      else if (s.phase === 'paused' && s.before === 'playing') s.before = 'breath';
      break;
    case 'breathed':
      if (s.phase === 'breath') { fx.push('advance'); }
      else if (s.phase === 'paused' && s.before === 'breath') s.before = 'speaking';
      break;
    case 'pause':
      if (s.phase !== 'paused' && s.phase !== 'done') { s.before = s.phase as Exclude<Phase, 'paused'>; s.phase = 'paused'; }
      break;
    case 'resume':
      if (s.phase === 'paused') {
        const b = s.before ?? 'speaking';
        s.phase = b; s.before = null;
        if (b === 'speaking') fx.push('speak');
        if (b === 'waiting') fx.push('sweep');
        if (b === 'playing') fx.push('play');
        if (b === 'breath') fx.push('advance');
      }
      break;
    case 'again':
      // say it once more and show the ghost turn; the wait restarts and grows a little
      if (s.phase === 'waiting' || s.phase === 'speaking' || s.phase === 'paused') {
        s.replays += 1; s.waited = 0; s.progress = 0;
        if (s.phase !== 'paused') { s.phase = 'speaking'; fx.push('replay', 'speak'); } else s.before = 'speaking';
      }
      break;
    case 'finish':
      s.phase = 'done';
      break;
  }
  return { state: s, effects: fx };
}

/** Seconds to wait on this card: the user's pace, longer for an orientation change or the first move of a step, and after replays. */
export function waitFor(pace: number, card: { type: 'hold' | 'move' | 'done'; firstOfStep?: boolean }, replays: number): number {
  if (card.type === 'hold') return Math.max(pace * 1.5, 5);
  let p = pace;
  if (card.firstOfStep) p += 1;
  p += replays * 1.5;
  return p;
}
