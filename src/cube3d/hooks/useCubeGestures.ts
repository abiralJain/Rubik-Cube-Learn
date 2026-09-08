import { useEffect } from 'react';
import { Raycaster, Vector2, Vector3 } from 'three';
import type { CubeController } from '../controller';
import { LAYER_PX_PER_QUARTER, MOMENTUM_MAX, ROT_PER_PX, TAP_MAX_MS, TAP_MAX_PX } from '../constants';
import { STICKERS } from '../placements';
import { layerFor } from '../moves';
import { unlockAudio } from '@/audio/sounds';

type Sample = { x: number; y: number; t: number };
const dbg: string[] = [];
if (import.meta.env.DEV) (window as unknown as { __gest: string[] }).__gest = dbg;
const log = (m: string) => { if (import.meta.env.DEV) { dbg.push(m); if (dbg.length > 60) dbg.shift(); } };

/**
 * One recognizer on the canvas: tap (press + onStickerTap), orbit (drag on ground or when layer turns are off),
 * layer turn (drag that starts on a sticker). Intent is decided after 8px.
 */
export function useCubeGestures(canvas: HTMLCanvasElement | null, ctrl: CubeController, opts: { onTap?: (i: number) => void; onRipple?: boolean }) {
  useEffect(() => {
    if (!canvas) return;
    const ray = new Raycaster();
    const ndc = new Vector2();
    let pointerId: number | null = null;
    let start: Sample | null = null;
    let last: Sample | null = null;
    let samples: Sample[] = [];
    let mode: 'undecided' | 'orbit' | 'layer' | 'none' = 'none';
    let hitIndex = -1;
    let pressed = -1;
    // layer drag
    let dragAxisScreen = new Vector2();
    let dragSign = 1;
    let lastAngle = 0;
    let angVel = 0;
    let lastT = 0;

    const toNdc = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const pick = (e: PointerEvent) => {
      if (!ctrl.camera) return -1;
      toNdc(e);
      ray.setFromCamera(ndc, ctrl.camera);
      const hit = ray.intersectObjects(ctrl.stickers, false)[0];
      return hit ? (hit.object.userData.index as number) : -1;
    };
    const project = (v: Vector3) => {
      const r = canvas.getBoundingClientRect();
      const p = v.clone().project(ctrl.camera!);
      return new Vector2(((p.x + 1) / 2) * r.width, ((1 - p.y) / 2) * r.height);
    };
    /** world-space rig transform applied to a local vector */
    const rigQ = () => ctrl.qDrift.clone().multiply(ctrl.qOrientation);

    const down = (e: PointerEvent) => {
      log(`down id=${e.pointerId} cur=${pointerId} active=${!!ctrl.active}`);
      if (!ctrl.interactive || pointerId !== null) return;
      unlockAudio();
      pointerId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have no capture */ }
      start = last = { x: e.clientX, y: e.clientY, t: performance.now() };
      samples = [start];
      mode = 'undecided';
      ctrl.omega.set(0, 0, 0);
      ctrl.cancelOrientation();
      hitIndex = pick(e);
      log(`hit=${hitIndex}`);
      pressed = -1;
      if (hitIndex >= 0 && !ctrl.active) { pressed = hitIndex; ctrl.pressKick(hitIndex, -5); }
    };

    const beginLayer = (dx: number, dy: number): boolean => {
      if (hitIndex < 0 || !ctrl.layerTurns || ctrl.active) return false;
      const p = STICKERS[hitIndex];
      const q = rigQ();
      const origin = p.position.clone().applyQuaternion(q);
      const sc = project(origin);
      const eu = project(p.u.clone().applyQuaternion(q).multiplyScalar(0.5).add(origin)).sub(sc).normalize();
      const ev = project(p.v.clone().applyQuaternion(q).multiplyScalar(0.5).add(origin)).sub(sc).normalize();
      const d = new Vector2(dx, dy);
      const du = d.dot(eu), dv = d.dot(ev);
      const useU = Math.abs(du) >= Math.abs(dv);
      const dirLocal = (useU ? p.u : p.v).clone();               // in-plane drag direction (local)
      dragAxisScreen = useU ? eu : ev;
      // rotation axis = n × d ; positive rotation moves the sticker along d
      const axisLocal = new Vector3().crossVectors(p.normal, dirLocal).round();
      const axisIndex = (Math.abs(axisLocal.x) === 1 ? 0 : Math.abs(axisLocal.y) === 1 ? 1 : 2) as 0 | 1 | 2;
      const base = layerFor(p.slot, axisIndex);
      if (!base) return false;
      // the face normal nf is ±axisLocal; angle about nf = angle about axis × (axis·nf)
      const nfSign = axisLocal.getComponent(axisIndex) * (p.slot[axisIndex] > 0 ? 1 : -1);
      dragSign = nfSign;
      if (!ctrl.beginDrag(base)) return false;
      lastAngle = 0; angVel = 0; lastT = performance.now();
      return true;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !start || !last) return;
      const now = performance.now();
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      const tot = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (mode === 'undecided' && tot >= TAP_MAX_PX) {
        mode = beginLayer(e.clientX - start.x, e.clientY - start.y) ? 'layer' : 'orbit';
        ctrl.dragging = true;
        if (pressed >= 0) { pressed = -1; }
      }
      if (mode === 'orbit') {
        const cam = ctrl.camera!;
        const axis = new Vector3(dy, dx, 0).applyQuaternion(cam.quaternion).normalize();
        const ang = Math.hypot(dx, dy) * ROT_PER_PX;
        if (ang > 0) ctrl.rotateBy(axis, ang);
        samples.push({ x: e.clientX, y: e.clientY, t: now });
        if (samples.length > 5) samples.shift();
      } else if (mode === 'layer') {
        const along = (e.clientX - start.x) * dragAxisScreen.x + (e.clientY - start.y) * dragAxisScreen.y;
        const angle = (along / LAYER_PX_PER_QUARTER) * (Math.PI / 2) * dragSign;
        const dt = Math.max(1, now - lastT) / 1000;
        angVel = angVel * 0.6 + ((angle - lastAngle) / dt) * 0.4;
        lastAngle = angle; lastT = now;
        ctrl.updateDrag(angle);
      }
      last = { x: e.clientX, y: e.clientY, t: now };
    };

    const up = (e: PointerEvent) => {
      log(`up id=${e.pointerId} cur=${pointerId} mode=${mode} hit=${hitIndex}`);
      if (e.pointerId !== pointerId || !start) return;
      const dt = performance.now() - start.t;
      const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (mode === 'undecided' && dist < TAP_MAX_PX && dt < TAP_MAX_MS) {
        if (hitIndex >= 0) {
          if (opts.onTap) opts.onTap(hitIndex);
          else if (opts.onRipple) ctrl.ripple(hitIndex);
        }
      } else if (mode === 'orbit') {
        // velocity from the last samples
        const a = samples[0], b = samples[samples.length - 1];
        const span = Math.max(16, b.t - a.t) / 1000;
        const vx = (b.x - a.x) / span, vy = (b.y - a.y) / span;
        const cam = ctrl.camera!;
        const axis = new Vector3(vy, vx, 0).applyQuaternion(cam.quaternion);
        const w = Math.hypot(vx, vy) * ROT_PER_PX;
        if (w > 0.05 && !ctrl.reduced && performance.now() - b.t < 80) ctrl.omega.copy(axis.normalize()).multiplyScalar(Math.min(MOMENTUM_MAX, w));
      } else if (mode === 'layer') {
        ctrl.releaseDrag(Math.max(-14, Math.min(14, angVel)));
      }
      ctrl.dragging = false;
      pointerId = null; start = last = null; mode = 'none'; hitIndex = -1;
      ctrl.invalidate();
    };
    const cancel = (e: PointerEvent) => { if (e.pointerId === pointerId) { if (mode === 'layer') ctrl.releaseDrag(0); ctrl.dragging = false; pointerId = null; mode = 'none'; } };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
    };
  }, [canvas, ctrl, opts.onTap, opts.onRipple]);
}
