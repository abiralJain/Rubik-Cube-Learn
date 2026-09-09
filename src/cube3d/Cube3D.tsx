import './Cube3D.css';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import type { Move } from '@/cube/notation';
import { CubeController } from './controller';
import { CameraFit, CubeRig, GroundShadow, Lights, SceneEnvironment } from './scene/Scene';
import { MoveCue, Sparkles } from './scene/MoveCue';
import { useCubeGestures } from './hooks/useCubeGestures';
import { HERO, type Orientation } from './orientation';
import type { CubeStageProps } from './CubeStage';

export interface CubeHandle {
  play(moves: Move | Move[], opts?: { speed?: number }): Promise<void>;
  replay(): Promise<void>;
  setOrientation(o: Orientation, animate?: boolean): Promise<void>;
  cancel(): void;
  isBusy(): boolean;
  controller: CubeController;
}

export type Cube3DProps = CubeStageProps & {
  orientation?: Orientation;
  /** Where on the canvas the cube sits (CSS px, canvas-relative). Null fades the object out. */
  frame?: { x: number; y: number; w: number; h: number } | null;
  fill?: number;
  onMoveDone?: (move: Move, facelets: string, meta: { replay: boolean; user: boolean }) => void;
  onQueueIdle?: () => void;
  onBackgroundTap?: () => void;
  rippleOnTap?: boolean;
  /** Learn mode: the move to draw on the cube. */
  cue?: Move | null;
  /** Learn mode: which drag-produced moves may commit. */
  gate?: ((m: Move) => boolean) | null;
  onRejected?: () => void;
  onReady?: () => void;
};

const KEY_ROTATE: Record<string, [Vector3, number]> = {
  ArrowLeft: [new Vector3(0, 1, 0), -Math.PI / 2],
  ArrowRight: [new Vector3(0, 1, 0), Math.PI / 2],
  ArrowUp: [new Vector3(1, 0, 0), -Math.PI / 2],
  ArrowDown: [new Vector3(1, 0, 0), Math.PI / 2],
};

const Cube3D = forwardRef<CubeHandle, Cube3DProps>(function Cube3D(
  { facelets, interactive = true, layerTurns = false, highlight = null, onStickerTap, orientation = HERO, frame, fill, onMoveDone, onQueueIdle, onBackgroundTap, rippleOnTap = true, cue = null, gate = null, onRejected, onReady },
  ref,
) {
  const ctrl = useMemo(() => new CubeController(facelets), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { ctrl.onReady = () => { setReady(true); onReady?.(); }; if (ctrl.ready) { setReady(true); onReady?.(); } }, [ctrl, onReady]);
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => { ctrl.reduced = reduced; ctrl.interactive = interactive; ctrl.layerTurns = layerTurns; }, [ctrl, reduced, interactive, layerTurns]);
  useEffect(() => { ctrl.setFacelets(facelets); }, [ctrl, facelets]);
  useEffect(() => { if (frame !== undefined) ctrl.setFrame(frame, fill); }, [ctrl, frame, fill]);
  useEffect(() => { ctrl.highlight = highlight; ctrl.invalidate(); }, [ctrl, highlight]);
  useEffect(() => { ctrl.cue = cue; ctrl.invalidate(); }, [ctrl, cue]);
  useEffect(() => { ctrl.gate = gate; ctrl.onRejected = onRejected ?? null; }, [ctrl, gate, onRejected]);
  useEffect(() => { ctrl.cb = { onMoveDone, onStickerTap, onQueueIdle, onBackgroundTap }; }, [ctrl, onMoveDone, onStickerTap, onQueueIdle, onBackgroundTap]);

  const first = useRef(true);
  useEffect(() => {
    ctrl.setOrientation(orientation, !first.current);
    first.current = false;
  }, [ctrl, orientation]);

  // pause idle motion when offscreen or the tab is hidden
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { ctrl.paused = !e.isIntersecting || document.hidden; ctrl.invalidate(); }, { threshold: 0.05 });
    io.observe(el);
    const vis = () => { ctrl.paused = document.hidden; ctrl.invalidate(); };
    document.addEventListener('visibilitychange', vis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, [ctrl]);

  useCubeGestures(canvasEl, ctrl, { onTap: onStickerTap, onRipple: rippleOnTap && !onStickerTap });

  useImperativeHandle(ref, () => ({
    play: (m, o) => ctrl.play(m, o),
    replay: () => ctrl.replay(),
    setOrientation: (o, a = true) => ctrl.setOrientation(o, a),
    cancel: () => ctrl.cancel(),
    isBusy: () => ctrl.busy,
    controller: ctrl,
  }), [ctrl]);

  useEffect(() => () => ctrl.dispose(), [ctrl]);
  useEffect(() => { if (import.meta.env.DEV || localStorage.getItem('cube.debug') === '1') { (window as unknown as { __cube?: CubeController }).__cube = ctrl; import('three').then((T) => { (window as unknown as { __THREE?: unknown }).__THREE = T; }); } }, [ctrl]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!interactive) return;
    const hit = KEY_ROTATE[e.key];
    if (!hit) return;
    e.preventDefault();
    const target = ctrl.qOrientation.clone().premultiply(new Quaternion().setFromAxisAngle(hit[0], hit[1]));
    ctrl.setOrientation(target, !reduced);
  };

  return (
    <div
      ref={wrap}
      className="cube3d"
      tabIndex={interactive ? 0 : -1}
      role="img"
      aria-label="Rubik's cube. Drag to turn it; use the arrow keys to rotate."
      onKeyDown={onKey}
      data-ready={ready ? '' : undefined}
    >
      {!ready && <div className="cube-poster" aria-hidden />}
      <Canvas
        frameloop="demand"
        dpr={ctrl.fast ? 0.5 : [1, 1.75]}
        gl={{ antialias: true, alpha: true, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 32, near: 1, far: 200, position: [0, 4, 12], manual: true }}
        onCreated={({ gl }) => { ctrl.canvas = gl.domElement; setCanvasEl(gl.domElement); }}
        style={{ touchAction: 'none' }}
      >
        <SceneEnvironment />
        <Lights />
        <CameraFit ctrl={ctrl} />
        <CubeRig ctrl={ctrl}><MoveCue ctrl={ctrl} /><Sparkles ctrl={ctrl} /></CubeRig>
        <GroundShadow ctrl={ctrl} />
      </Canvas>
    </div>
  );
});

export default Cube3D;
