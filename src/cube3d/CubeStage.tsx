import { lazy, Suspense, type RefObject } from 'react';
import type { Cube3DProps, CubeHandle } from './Cube3D';

const Cube3D = lazy(() => import('./Cube3D'));

export type CubeStageProps = {
  facelets: string;
  interactive?: boolean;
  layerTurns?: boolean;
  highlight?: ReadonlySet<number> | null;
  onStickerTap?: (index: number) => void;
};

/** Lazy wrapper so three.js never blocks first paint. */
export function CubeStage({ cubeRef, ...props }: Cube3DProps & { cubeRef?: RefObject<CubeHandle | null> }) {
  return (
    <Suspense fallback={<div className="cube-poster" aria-hidden />}>
      <Cube3D ref={cubeRef} {...props} />
    </Suspense>
  );
}
