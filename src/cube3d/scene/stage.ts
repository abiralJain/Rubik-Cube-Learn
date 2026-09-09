/**
 * The persistent cube. One WebGL canvas lives in the Shell for the whole session; screens do not mount their own.
 * A screen claims the cube with `useStage(props)`, hands back a ref for an empty placeholder element, and the cube
 * glides into that element's rectangle. When no screen owns it the cube fades out and stops rendering.
 */
import { useCallback, useEffect, useId, useRef } from 'react';
import { create } from 'zustand';
import type { Move } from '@/cube/notation';
import type { Orientation } from '../orientation';
import { HERO } from '../orientation';
import type { CubeHandle } from '../Cube3D';

export interface Rect { x: number; y: number; w: number; h: number }

export interface StageProps {
  facelets: string;
  orientation?: Orientation;
  highlight?: ReadonlySet<number> | null;
  /** The move to draw on the cube. */
  cue?: Move | null;
  /** Which drag-produced moves may commit. */
  gate?: ((m: Move) => boolean) | null;
  interactive?: boolean;
  layerTurns?: boolean;
  rippleOnTap?: boolean;
  /** Fraction of the frame's short side the cube may fill (default 0.68). */
  fill?: number;
  onStickerTap?: (index: number) => void;
  onMoveDone?: (move: Move, facelets: string, meta: { replay: boolean; user: boolean }) => void;
  onQueueIdle?: () => void;
  onBackgroundTap?: () => void;
  onRejected?: () => void;
}

interface StageState {
  owner: string | null;
  frame: Rect | null;
  props: StageProps;
  handle: CubeHandle | null;
  ready: boolean;
  claim: (owner: string, props: StageProps) => void;
  update: (owner: string, props: StageProps) => void;
  setFrame: (owner: string, frame: Rect | null) => void;
  release: (owner: string) => void;
  setHandle: (h: CubeHandle | null) => void;
  setReady: (r: boolean) => void;
}

export const IDLE_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const DEFAULT_PROPS: StageProps = { facelets: IDLE_FACELETS, orientation: HERO, interactive: false };

export const useStageStore = create<StageState>((set, get) => ({
  owner: null,
  frame: null,
  props: DEFAULT_PROPS,
  handle: null,
  ready: false,
  claim: (owner, props) => set({ owner, props }),
  update: (owner, props) => { if (get().owner === owner) set({ props }); },
  setFrame: (owner, frame) => { const st = get(); if (st.owner !== owner) return; const f = st.frame; if (f && frame && f.x === frame.x && f.y === frame.y && f.w === frame.w && f.h === frame.h) return; if (!f && !frame) return; set({ frame }); },
  release: (owner) => { if (get().owner === owner) set({ owner: null, frame: null }); },
  setHandle: (handle) => set({ handle }),
  setReady: (ready) => set({ ready }),
}));

/** The controller/handle of the shared cube, for imperative work (play a move, turn to a face, celebrate). */
export const cubeHandle = () => useStageStore.getState().handle;

/**
 * Claim the shared cube for this screen. Returns a ref callback for the placeholder element the cube should fill.
 * Props are re-published whenever they change; the frame follows the element through resizes and scrolls.
 */
export function useStage(props: StageProps) {
  const id = useId();
  const store = useStageStore;
  const el = useRef<HTMLElement | null>(null);
  const ro = useRef<ResizeObserver | null>(null);
  const claimed = useRef(false);

  // claim once, release on unmount (a later claimant wins during route transitions)
  useEffect(() => {
    store.getState().claim(id, props);
    claimed.current = true;
    return () => { claimed.current = false; store.getState().release(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { if (claimed.current) store.getState().update(id, props); });

  const measure = useCallback(() => {
    const e = el.current; if (!e) { store.getState().setFrame(id, null); return; }
    const r = e.getBoundingClientRect();
    store.getState().setFrame(id, { x: r.left, y: r.top, w: r.width, h: r.height });
  }, [id, store]);

  useEffect(() => {
    const onScroll = () => measure();
    addEventListener('resize', measure); addEventListener('scroll', onScroll, true);
    const vv = window.visualViewport; vv?.addEventListener('resize', measure);
    // a ResizeObserver misses pure moves (a sibling grew, a font loaded), so also re-measure a few times a second
    let raf = 0, last = 0;
    const tick = (t: number) => { raf = requestAnimationFrame(tick); if (t - last > 180) { last = t; measure(); } };
    raf = requestAnimationFrame(tick);
    return () => { removeEventListener('resize', measure); removeEventListener('scroll', onScroll, true); vv?.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, [measure]);

  return useCallback((node: HTMLElement | null) => {
    ro.current?.disconnect(); ro.current = null;
    el.current = node;
    if (node) {
      ro.current = new ResizeObserver(() => measure());
      ro.current.observe(node);
      // measure after layout so the first frame is right
      requestAnimationFrame(measure);
    }
    measure();
  }, [measure]);
}
