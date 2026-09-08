import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
export type Facelet = Face | '.';

/** 54 facelets in cubejs order U R F D L B, centres pre-filled and locked. */
export const EMPTY_FACELETS = (['U', 'R', 'F', 'D', 'L', 'B'] as Face[])
  .map((f) => '....' + f + '....')
  .join('');

export interface PaintEdit { index: number; from: Facelet; to: Facelet; auto?: boolean }

interface Session {
  facelets: string;
  paintHistory: PaintEdit[];
  lastInput: 'camera' | 'paint' | null;
  learn: { start: string; card: number; startedAt: number; elapsedMs: number } | null;
  solved: { ms: number; moves: number; at: number } | null;
  settings: { sound: boolean; voice: boolean; seenPaintHint: boolean; seenLearnHint: boolean };

  setFacelets: (f: string, input?: 'camera' | 'paint') => void;
  paint: (index: number, to: Facelet, auto?: boolean) => void;
  undoPaint: () => void;
  resetPaint: () => void;
  startLearn: (start: string) => void;
  setLearnCard: (card: number, facelets: string, elapsedMs: number) => void;
  finishLearn: (ms: number, moves: number) => void;
  clearSession: () => void;
  setSetting: <K extends keyof Session['settings']>(k: K, v: Session['settings'][K]) => void;
}

export const useSession = create<Session>()(
  persist(
    (set, get) => ({
      facelets: EMPTY_FACELETS,
      paintHistory: [],
      lastInput: null,
      learn: null,
      solved: null,
      settings: { sound: true, voice: true, seenPaintHint: false, seenLearnHint: false },

      setFacelets: (facelets, input) => set({ facelets, learn: null, lastInput: input ?? get().lastInput }),
      paint: (index, to, auto) => {
        const { facelets, paintHistory } = get();
        const from = facelets[index] as Facelet;
        if (from === to) return;
        set({
          facelets: facelets.slice(0, index) + to + facelets.slice(index + 1),
          paintHistory: [...paintHistory, { index, from, to, auto }],
          lastInput: 'paint',
          learn: null,
        });
      },
      undoPaint: () => {
        const { facelets, paintHistory } = get();
        if (!paintHistory.length) return;
        let hist = paintHistory.slice();
        let f = facelets;
        // an automatic fill is undone together with the paint that triggered it
        const pops = hist[hist.length - 1].auto ? 2 : 1;
        for (let i = 0; i < pops && hist.length; i++) {
          const e = hist.pop()!;
          f = f.slice(0, e.index) + e.from + f.slice(e.index + 1);
        }
        set({ facelets: f, paintHistory: hist });
      },
      resetPaint: () => set({ facelets: EMPTY_FACELETS, paintHistory: [], learn: null }),
      startLearn: (start) => set({ learn: { start, card: 0, startedAt: Date.now(), elapsedMs: 0 } }),
      setLearnCard: (card, facelets, elapsedMs) => {
        const l = get().learn;
        if (l) set({ learn: { ...l, card, elapsedMs }, facelets });
      },
      finishLearn: (ms, moves) => set({ solved: { ms, moves, at: Date.now() }, learn: null }),
      clearSession: () => set({ facelets: EMPTY_FACELETS, paintHistory: [], learn: null, solved: null }),
      setSetting: (k, v) => set({ settings: { ...get().settings, [k]: v } }),
    }),
    { name: 'cube.session.v1', version: 1 },
  ),
);

export const filledCount = (f: string) => f.split('').filter((c) => c !== '.').length;
