import { lazy, Suspense } from 'react';

const Cube3D = lazy(() => import('./Cube3D'));

export type CubeStageProps = {
  facelets: string;
  interactive?: boolean;
  layerTurns?: boolean;
  highlight?: ReadonlySet<number> | null;
  onStickerTap?: (index: number) => void;
};

/** Lazy wrapper so three.js never blocks first paint. */
export function CubeStage(props: CubeStageProps) {
  return (
    <Suspense fallback={<div className="cube-poster" aria-hidden />}>
      <Cube3D {...props} />
    </Suspense>
  );
}
