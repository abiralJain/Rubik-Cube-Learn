import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Face, Facelet } from '@/cube/facelets';
import type { StageId } from '@/cube/lbl';

export type { Face, Facelet };

/** 54 facelets in cubejs order U R F D L B, centres pre-filled and locked. */
export const EMPTY_FACELETS = (['U', 'R', 'F', 'D', 'L', 'B'] as Face[])
  .map((f) => '....' + f + '....')
  .join('');

export interface PaintEdit { index: number; from: Facelet; to: Facelet; auto?: boolean }
export interface SolveRecord { at: number; ms: number; moves: number; start: string }

export interface Settings {
  sound: boolean;
  voice: boolean;
  /** Seconds the autopilot waits after saying a turn before it plays it on screen. */
  pace: number;
  /** Preferred speech voice, by `voiceURI`; null = the ranked default. */
  voiceURI: string | null;
  seenPaintHint: boolean;
  seenHold: boolean;
}

interface Session {
  facelets: string;
  paintHistory: PaintEdit[];
  lastInput: 'camera' | 'paint' | null;
  /** The solve in progress: the start state, the current card, timing. */
  learn: { start: string; card: number; startedAt: number; elapsedMs: number } | null;
  /** The last finished solve (drives the Solved screen). */
  solved: { ms: number; moves: number; at: number; start: string } | null;
  /** Stage stones, keyed by stage, valued by unlock time. */
  unlocked: Partial<Record<StageId, number>>;
  history: SolveRecord[];
  settings: Settings;

  setFacelets: (f: string, input?: 'camera' | 'paint') => void;
  paint: (index: number, to: Facelet, auto?: boolean) => void;
  undoPaint: () => void;
  resetPaint: () => void;
  startLearn: (start: string) => void;
  setLearnCard: (card: number, facelets: string, elapsedMs: number) => void;
  /** Re-plan from a freshly read cube mid-solve: same timer, new start. */
  replan: (facelets: string, elapsedMs: number) => void;
  finishLearn: (ms: number, moves: number, facelets: string) => void;
  unlock: (stage: StageId) => void;
  clearSession: () => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
}

const DEFAULT_SETTINGS: Settings = { sound: true, voice: true, pace: 4, voiceURI: null, seenPaintHint: false, seenHold: false };

export const useSession = create<Session>()(
  persist(
    (set, get) => ({
      facelets: EMPTY_FACELETS,
      paintHistory: [],
      lastInput: null,
      learn: null,
      solved: null,
      unlocked: {},
      history: [],
      settings: DEFAULT_SETTINGS,

      setFacelets: (facelets, input) => set({ facelets, learn: null, paintHistory: [], lastInput: input ?? get().lastInput }),
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
        const hist = paintHistory.slice();
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
      startLearn: (start) => set({ learn: { start, card: 0, startedAt: Date.now(), elapsedMs: 0 }, facelets: start }),
      setLearnCard: (card, facelets, elapsedMs) => {
        const l = get().learn;
        if (l) set({ learn: { ...l, card, elapsedMs }, facelets });
      },
      replan: (facelets, elapsedMs) => {
        const l = get().learn;
        set({ facelets, learn: { start: facelets, card: 0, startedAt: l?.startedAt ?? Date.now(), elapsedMs } });
      },
      finishLearn: (ms, moves, facelets) => {
        const l = get().learn;
        const rec: SolveRecord = { at: Date.now(), ms, moves, start: l?.start ?? facelets };
        set({ solved: { ms, moves, at: rec.at, start: rec.start }, learn: null, facelets, history: [...get().history, rec].slice(-50), unlocked: { ...get().unlocked, 'position-edges': get().unlocked['position-edges'] ?? rec.at } });
      },
      unlock: (stage) => { if (!get().unlocked[stage]) set({ unlocked: { ...get().unlocked, [stage]: Date.now() } }); },
      clearSession: () => set({ facelets: EMPTY_FACELETS, paintHistory: [], learn: null, solved: null }),
      setSetting: (k, v) => set({ settings: { ...get().settings, [k]: v } }),
    }),
    {
      name: 'cube.session.v1',
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<Session>;
        return { ...p, unlocked: p.unlocked ?? {}, history: p.history ?? [], settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } } as Session;
      },
    },
  ),
);

export const filledCount = (f: string) => f.split('').filter((c) => c !== '.').length;
