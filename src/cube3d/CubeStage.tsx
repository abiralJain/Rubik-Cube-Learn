import { lazy, Suspense, useEffect, useState, type RefObject } from 'react';
import type { Cube3DProps, CubeHandle } from './Cube3D';

const Cube3D = lazy(() => import('./Cube3D'));

export type CubeStageProps = {
  facelets: string;
  interactive?: boolean;
  layerTurns?: boolean;
  highlight?: ReadonlySet<number> | null;
  onStickerTap?: (index: number) => void;
};

/**
 * Lazy wrapper so three.js never blocks first paint. With `defer`, a pre-rendered poster shows instantly and the live
 * cube boots on the first interaction or after a short idle, so the landing page stays responsive on slow phones.
 */
export function CubeStage({ cubeRef, defer, poster, ...props }: Cube3DProps & { cubeRef?: RefObject<CubeHandle | null>; defer?: boolean; poster?: string }) {
  const [live, setLive] = useState(!defer);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (live) return;
    const go = () => setLive(true);
    const opts = { once: true, passive: true } as AddEventListenerOptions;
    for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel']) window.addEventListener(ev, go, opts);
    const t = setTimeout(go, 3800);
    return () => { for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel']) window.removeEventListener(ev, go); clearTimeout(t); };
  }, [live]);
  return (
    <>
      {poster && !shown && <img className="cube-poster-img" src={`${poster}-540.webp`} srcSet={`${poster}-540.webp 540w, ${poster}-810.webp 810w, ${poster}-1080.webp 1080w`} sizes="(max-width: 599px) 100vw, 60vw" alt="" aria-hidden decoding="async" fetchPriority="high" />}
      {live && (
        <Suspense fallback={poster ? null : <div className="cube-poster" aria-hidden />}>
          <Cube3D ref={cubeRef} {...props} onReady={() => { props.onReady?.(); setTimeout(() => setShown(true), 420); }} />
        </Suspense>
      )}
    </>
  );
}
