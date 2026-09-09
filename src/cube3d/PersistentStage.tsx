import './PersistentStage.css';
import { useCallback, useEffect, useRef } from 'react';
import { CubeStage } from './CubeStage';
import type { CubeHandle } from './Cube3D';
import { useStageStore } from './scene/stage';
import { HERO } from './orientation';

/**
 * The one cube. Mounted by the Shell behind every screen; screens claim it with `useStage()` and it glides to
 * their placeholder. The canvas is the full viewport so nothing ever resizes mid-flight: the controller shifts the
 * projection instead.
 */
export function PersistentStage() {
  const { frame, props, owner, setHandle, setReady } = useStageStore();
  const ref = useRef<CubeHandle>(null);
  useEffect(() => { setHandle(ref.current); return () => setHandle(null); }, [setHandle]);
  const onReady = useCallback(() => { const st = useStageStore.getState(); if (st.handle !== ref.current) setHandle(ref.current); if (!st.ready) setReady(true); }, [setHandle, setReady]);
  const shown = !!owner && !!frame;
  return (
    <div className="stage-layer" data-shown={shown ? '' : undefined} aria-hidden={!shown}>
      <CubeStage
        cubeRef={ref}
        facelets={props.facelets}
        orientation={props.orientation ?? HERO}
        highlight={props.highlight ?? null}
        cue={props.cue ?? null}
        gate={props.gate ?? null}
        interactive={props.interactive ?? true}
        layerTurns={props.layerTurns ?? false}
        rippleOnTap={props.rippleOnTap ?? true}
        onStickerTap={props.onStickerTap}
        onMoveDone={props.onMoveDone}
        onQueueIdle={props.onQueueIdle}
        onRejected={props.onRejected}
        frame={shown ? frame : null}
        fill={props.fill}
        onReady={onReady}
      />
    </div>
  );
}
