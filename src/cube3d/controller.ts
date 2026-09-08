import { Color, Euler, Quaternion, Vector3, type Mesh, type MeshPhysicalMaterial, type PerspectiveCamera } from 'three';
import type { Move, BaseMove } from '@/cube/notation';
import { makeMove } from '@/cube/notation';
import { applyMove } from '@/cube/facelets';
import { COLORS, HIGHLIGHT_DAMP, LAYER_LIFT, MOMENTUM_DECAY, MOMENTUM_STOP, SPRING } from './constants';
import { Spring, damp } from './spring';
import { STICKERS, slotById } from './placements';
import { moveDef } from './moves';
import { dimColor } from './geometry';
import { resolveOrientation, type Orientation } from './orientation';
import * as sfx from '@/audio/sounds';

const HALF_PI = Math.PI / 2;
const FACE_NORMAL: Record<BaseMove, Vector3> = {
  U: new Vector3(0, 1, 0), D: new Vector3(0, -1, 0), R: new Vector3(1, 0, 0), L: new Vector3(-1, 0, 0), F: new Vector3(0, 0, 1), B: new Vector3(0, 0, -1),
};

interface ActiveTurn {
  base: BaseMove; nf: Vector3; slotIds: number[]; stickerIds: number[];
  spring: Spring; started: number; mode: 'play' | 'drag'; targetAngle: number;
  resolve?: () => void; replay?: boolean; ghost?: boolean; speed: number;
}
interface QueuedMove { move: Move; resolve: () => void; replay: boolean; ghost: boolean; speed: number }

export interface ControllerCallbacks {
  onMoveDone?: (move: Move, facelets: string, meta: { replay: boolean; user: boolean }) => void;
  onStickerTap?: (index: number) => void;
  onQueueIdle?: () => void;
}

export class CubeController {
  // scene objects registered by the rig
  bodies = new Map<number, Mesh>();
  stickers: Mesh[] = [];
  camera: PerspectiveCamera | null = null;
  invalidate: () => void = () => {};

  displayFacelets = '';
  ready = false;
  onReady: (() => void) | null = null;
  reduced = false;
  paused = false;
  interactive = true;
  layerTurns = false;
  ghostOpacity = 1;

  // orientation
  qOrientation = new Quaternion();
  qDrift = new Quaternion();
  omega = new Vector3();
  orientSpring = new Spring(1, SPRING.orient.k, SPRING.orient.c);
  private qStart = new Quaternion();
  private orientAxis = new Vector3(0, 1, 0);
  private orientAngle = 0;
  private orientResolve: (() => void) | null = null;
  dragging = false;

  // turns
  queue: QueuedMove[] = [];
  active: ActiveTurn | null = null;
  private snapshot: { facelets: string; moves: Move[] } | null = null;

  // per-sticker springs / colours
  press: Spring[] = STICKERS.map(() => new Spring(0, SPRING.press.k, SPRING.press.c));
  baseColor: Color[] = STICKERS.map(() => new Color('#ffffff'));
  dimmed: Color[] = STICKERS.map(() => new Color('#ffffff'));
  highlight: ReadonlySet<number> | null = null;
  squash = new Spring(0, SPRING.squash.k, SPRING.squash.c);
  squashAxis = new Vector3(0, 1, 0);
  private rippleTimers: number[] = [];

  floatY = 0;
  breath = 1;
  t = 0;
  cb: ControllerCallbacks = {};

  private tmpQ = new Quaternion();
  private tmpV = new Vector3();
  private tmpE = new Euler();

  constructor(initialFacelets: string) {
    this.adoptFacelets(initialFacelets, true);
  }

  /* ---------- facelets & colours ---------- */
  adoptFacelets(f: string, force = false) {
    if (!force && f === this.displayFacelets) return;
    this.displayFacelets = f;
    for (let i = 0; i < 54; i++) {
      this.baseColor[i].set(COLORS[f[i]] ?? COLORS['.']);
      dimColor(this.baseColor[i], this.dimmed[i]);
      const mesh = this.stickers[i];
      if (mesh) {
        const m = mesh.material as MeshPhysicalMaterial;
        const empty = f[i] === '.';
        m.clearcoat = empty ? 0.3 : 1; m.roughness = empty ? 0.6 : 0.28; m.iridescence = empty ? 0 : 0.12; m.envMapIntensity = empty ? 0.5 : 1.1;
      }
    }
    this.invalidate();
  }
  /** Parent pushed new facelets: adopt now if idle, else after the queue drains. */
  pendingFacelets: string | null = null;
  setFacelets(f: string) {
    if (this.active || this.queue.length) { this.pendingFacelets = f; return; }
    this.adoptFacelets(f);
  }

  /* ---------- orientation ---------- */
  setOrientation(o: Orientation, animate = true): Promise<void> {
    const target = resolveOrientation(o);
    this.omega.set(0, 0, 0);
    if (!animate) { this.qOrientation.copy(target); this.orientSpring.snap(1); this.invalidate(); return Promise.resolve(); }
    if (target.dot(this.qOrientation) < 0) target.set(-target.x, -target.y, -target.z, -target.w);
    this.qStart.copy(this.qOrientation);
    const delta = target.clone().multiply(this.qStart.clone().invert()).normalize();
    this.orientAngle = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
    const s = Math.sqrt(Math.max(0, 1 - delta.w * delta.w));
    this.orientAxis.set(delta.x, delta.y, delta.z);
    if (s < 1e-5) { this.qOrientation.copy(target); return Promise.resolve(); }
    this.orientAxis.divideScalar(s);
    if (delta.w < 0) { this.orientAngle = -this.orientAngle; }
    const k = this.reduced ? SPRING.orientReduced : SPRING.orient;
    this.orientSpring.set(k.k, k.c); this.orientSpring.snap(0); this.orientSpring.target = 1;
    this.invalidate();
    return new Promise((r) => { this.orientResolve = r; });
  }
  cancelOrientation() { if (this.orientSpring.moving) { this.orientSpring.snap(1); this.orientResolve?.(); this.orientResolve = null; } }

  rotateBy(axis: Vector3, angle: number) {
    this.qOrientation.premultiply(this.tmpQ.setFromAxisAngle(axis, angle)).normalize();
    this.invalidate();
  }

  /* ---------- queue ---------- */
  play(moves: Move | Move[], opts: { speed?: number; replay?: boolean; ghost?: boolean } = {}): Promise<void> {
    const list = Array.isArray(moves) ? moves : [moves];
    if (!opts.replay) this.snapshot = { facelets: this.displayFacelets, moves: list.slice() };
    return new Promise((resolve) => {
      list.forEach((m, i) => this.queue.push({ move: m, resolve: i === list.length - 1 ? resolve : () => {}, replay: !!opts.replay, ghost: !!opts.ghost, speed: opts.speed ?? 1 }));
      if (!list.length) resolve();
      this.invalidate();
    });
  }
  /** Rewind to before the last play() batch and play it again as a translucent ghost, then restore. */
  async replay(speed = 0.6): Promise<void> {
    if (!this.snapshot) return;
    const after = this.displayFacelets;
    const { facelets, moves } = this.snapshot;
    this.cancel();
    this.adoptFacelets(facelets, true);
    await this.play(moves, { speed, replay: true, ghost: true });
    await new Promise((r) => setTimeout(r, 350));
    this.adoptFacelets(after, true);
  }
  cancel() {
    if (this.active) { this.active.spring.snap(this.active.targetAngle); this.commit(); }
    for (const q of this.queue) q.resolve();
    this.queue = [];
  }
  get busy() { return !!this.active || this.queue.length > 0; }

  private startQueued(q: QueuedMove) {
    const def = moveDef(q.move);
    const k = this.reduced ? SPRING.turnReduced : SPRING.turn;
    const spring = new Spring(0, k.k * q.speed * q.speed, k.c * q.speed);
    spring.target = def.angle;
    this.active = { base: def.base, nf: FACE_NORMAL[def.base], slotIds: def.slotIds, stickerIds: def.stickerIds, spring, started: this.t, mode: 'play', targetAngle: def.angle, resolve: q.resolve, replay: q.replay, ghost: q.ghost, speed: q.speed };
    this.ghostOpacity = q.ghost ? 0.55 : 1;
  }

  /* ---------- layer drag (direct manipulation) ---------- */
  beginDrag(base: BaseMove): boolean {
    if (this.active) return false;
    const def = moveDef(base as Move);
    const nf = FACE_NORMAL[base];
    const spring = new Spring(0, SPRING.turn.k, SPRING.turn.c);
    this.active = { base, nf, slotIds: def.slotIds, stickerIds: def.stickerIds, spring, started: this.t, mode: 'drag', targetAngle: 0, speed: 1 };
    this.ghostOpacity = 1;
    this.invalidate();
    return true;
  }
  /** angle is about the face normal nf (positive = counter-clockwise seen from outside). */
  updateDrag(angle: number) {
    if (!this.active || this.active.mode !== 'drag') return;
    const limit = Math.PI * 1.05;
    const over = Math.abs(angle) - limit;
    const a = over > 0 ? Math.sign(angle) * (limit + rubber(over, 0.9)) : angle;
    this.active.spring.snap(a);
    this.invalidate();
  }
  releaseDrag(angularVelocity: number) {
    const a = this.active;
    if (!a || a.mode !== 'drag') return;
    const projected = a.spring.x + angularVelocity * 0.22;
    let target = Math.round(projected / HALF_PI) * HALF_PI;
    // never more than one detent beyond where the finger left it
    const here = Math.round(a.spring.x / HALF_PI) * HALF_PI;
    target = Math.max(here - HALF_PI, Math.min(here + HALF_PI, target));
    target = Math.max(-Math.PI, Math.min(Math.PI, target));
    a.targetAngle = target;
    a.spring.target = target;
    a.spring.v = this.reduced ? 0 : angularVelocity;
    a.mode = 'play';
    a.started = this.t;
    (a as ActiveTurn & { user?: boolean }).user = true;
    this.invalidate();
  }

  private commit() {
    const a = this.active;
    if (!a) return;
    const quarters = Math.round(a.spring.x / HALF_PI);
    // reset transforms
    for (const id of a.slotIds) { const b = this.bodies.get(id); const s = slotById.get(id)!; if (b) { b.position.copy(s.rest); b.quaternion.identity(); } }
    for (const i of a.stickerIds) { const m = this.stickers[i]; const p = STICKERS[i]; if (m) { m.position.copy(p.position); m.quaternion.copy(p.quaternion); (m.material as MeshPhysicalMaterial).opacity = 1; (m.material as MeshPhysicalMaterial).transparent = false; } }
    this.ghostOpacity = 1;
    let move: Move | null = null;
    if (quarters !== 0) {
      // rotation about nf by +quarters*90° is counter-clockwise from outside; clockwise quarter turns = -quarters
      move = makeMove(a.base, ((-quarters % 4) + 4) % 4);
    }
    const user = !!(a as ActiveTurn & { user?: boolean }).user;
    if (move) {
      this.displayFacelets = applyMove(this.displayFacelets, move);
      this.adoptFacelets(this.displayFacelets, true);
      if (!a.ghost) {
        sfx.tok(0.95 + Math.random() * 0.1);
        if (navigator.vibrate && user) navigator.vibrate(8);
        this.squashAxis.copy(a.nf); this.squash.snap(0); this.squash.kick(1.6);
      }
      this.cb.onMoveDone?.(move, this.displayFacelets, { replay: !!a.replay, user });
    } else if (user) {
      sfx.bloop();
    }
    a.resolve?.();
    this.active = null;
    if (this.queue.length) this.startQueued(this.queue.shift()!);
    else {
      if (this.pendingFacelets) { this.adoptFacelets(this.pendingFacelets); this.pendingFacelets = null; }
      this.cb.onQueueIdle?.();
    }
  }

  /* ---------- press / ripple ---------- */
  pressKick(i: number, v = -6) { this.press[i].kick(v); this.invalidate(); }
  ripple(from: number) {
    this.rippleTimers.forEach(clearTimeout); this.rippleTimers = [];
    const origin = STICKERS[from].position;
    sfx.ripplePlink();
    for (let i = 0; i < 54; i++) {
      const d = STICKERS[i].position.distanceTo(origin);
      const amp = -7 * Math.exp(-d / 1.6);
      if (Math.abs(amp) < 0.3) continue;
      this.rippleTimers.push(window.setTimeout(() => this.pressKick(i, amp), d * 38));
    }
  }

  /* ---------- master loop ---------- */
  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.t += dt;
    let moving = false;

    // idle drift & float
    if (!this.reduced && !this.paused && !this.dragging && this.omega.lengthSq() < 1e-6) {
      this.floatY = 0.04 * Math.sin(this.t * 0.6);
      this.breath = 1 + 0.006 * Math.sin((this.t / 5.5) * Math.PI * 2);
      this.qDrift.setFromEuler(this.tmpE.set(0.03 * Math.sin(this.t * 0.37), 0.035 * Math.sin(this.t * 0.29), 0));
      moving = true;
    } else if (this.reduced) { this.floatY = 0; this.breath = 1; this.qDrift.identity(); }

    // momentum
    if (this.omega.lengthSq() > 0) {
      const w = this.omega.length();
      this.rotateBy(this.tmpV.copy(this.omega).normalize(), w * dt);
      this.omega.multiplyScalar(Math.exp(-MOMENTUM_DECAY * dt));
      if (this.omega.length() < MOMENTUM_STOP) this.omega.set(0, 0, 0);
      moving = true;
    }

    // orientation spring
    if (this.orientSpring.moving) {
      const still = this.orientSpring.step(dt);
      this.qOrientation.copy(this.qStart).premultiply(this.tmpQ.setFromAxisAngle(this.orientAxis, this.orientAngle * this.orientSpring.x)).normalize();
      if (!still) { this.orientResolve?.(); this.orientResolve = null; }
      moving = true;
    }

    // turns
    if (!this.active && this.queue.length) this.startQueued(this.queue.shift()!);
    if (this.active) {
      const a = this.active;
      const stepping = a.mode === 'drag' ? true : a.spring.step(dt);
      const angle = a.spring.x;
      const frac = a.mode === 'drag' ? (Math.abs(angle) / HALF_PI) % 1 : Math.min(1, Math.abs(angle / (a.targetAngle || HALF_PI)));
      const lift = LAYER_LIFT * Math.sin(Math.PI * frac);
      const qLayer = this.tmpQ.setFromAxisAngle(a.nf, angle);
      for (const id of a.slotIds) {
        const b = this.bodies.get(id); const s = slotById.get(id)!;
        if (!b) continue;
        b.position.copy(s.rest).applyQuaternion(qLayer).addScaledVector(a.nf, lift);
        b.quaternion.copy(qLayer);
      }
      for (const i of a.stickerIds) {
        const m = this.stickers[i]; const p = STICKERS[i];
        if (!m) continue;
        m.position.copy(p.position).applyQuaternion(qLayer).addScaledVector(a.nf, lift);
        m.quaternion.copy(qLayer).multiply(p.quaternion);
        if (a.ghost) { const mat = m.material as MeshPhysicalMaterial; mat.transparent = true; mat.opacity = this.ghostOpacity; }
      }
      const timedOut = a.mode === 'play' && this.t - a.started > 0.7 / Math.max(0.3, a.speed);
      if (a.mode === 'play' && (!stepping || timedOut)) this.commit();
      moving = true;
    }

    // press springs, highlight colours
    for (let i = 0; i < 54; i++) {
      const m = this.stickers[i]; if (!m) continue;
      const p = STICKERS[i];
      const sp = this.press[i];
      if (sp.moving) {
        sp.step(dt);
        const k = sp.x;
        const inLayer = this.active?.stickerIds.includes(i);
        if (!inLayer) {
          m.position.copy(p.position).addScaledVector(p.normal, -0.045 * k);
          m.scale.set(1 - 0.08 * k, 1 - 0.08 * k, 1);
        }
        moving = true;
      } else if (m.scale.x !== 1) { m.scale.set(1, 1, 1); if (!this.active?.stickerIds.includes(i)) m.position.copy(p.position); }
      const mat = m.material as MeshPhysicalMaterial;
      const target = this.highlight && !this.highlight.has(i) ? this.dimmed[i] : this.baseColor[i];
      if (!mat.color.equals(target)) {
        mat.color.r = damp(mat.color.r, target.r, HIGHLIGHT_DAMP, dt);
        mat.color.g = damp(mat.color.g, target.g, HIGHLIGHT_DAMP, dt);
        mat.color.b = damp(mat.color.b, target.b, HIGHLIGHT_DAMP, dt);
        if (Math.abs(mat.color.r - target.r) + Math.abs(mat.color.g - target.g) + Math.abs(mat.color.b - target.b) < 0.004) mat.color.copy(target);
        moving = true;
      }
    }

    if (this.squash.moving) { this.squash.step(dt); moving = true; }

    if (moving) this.invalidate();
    return moving;
  }

  dispose() { this.rippleTimers.forEach(clearTimeout); }
}

function rubber(over: number, c = 0.55, dim = 1.2) { return (over * dim * c) / (dim + c * Math.abs(over)); }

