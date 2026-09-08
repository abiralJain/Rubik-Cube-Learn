/**
 * GAN smart cube adapter behind VITE_SMART_CUBE. Loaded with a dynamic import so the library never enters the main bundle.
 * The cube reports moves relative to its own centres (white = its U), which is the standard frame our facelets use.
 */
import type { Move } from '@/cube/notation';

export interface MoveSource { onMove(cb: (m: Move) => void): () => void; disconnect(): void; name: string }

export const smartCubeAvailable = () => import.meta.env.VITE_SMART_CUBE === '1' && typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export async function connectGan(): Promise<MoveSource> {
  const lib = await import('gan-web-bluetooth');
  const conn = await lib.connectGanCube();
  const listeners = new Set<(m: Move) => void>();
  const sub = conn.events$.subscribe((ev: { type: string; move?: string }) => {
    if (ev.type === 'MOVE' && ev.move) {
      const m = ev.move.trim() as Move;
      if (/^[URFDLB](2|')?$/.test(m)) listeners.forEach((cb) => cb(m));
    }
  });
  await conn.sendCubeCommand({ type: 'REQUEST_FACELETS' });
  return {
    name: conn.deviceName ?? 'GAN cube',
    onMove: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    disconnect: () => { sub.unsubscribe(); conn.disconnect(); },
  };
}
