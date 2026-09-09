import { Color, Euler, Quaternion, Vector3, type Mesh, type MeshBasicMaterial, type MeshPhysicalMaterial, type PerspectiveCamera } from 'three';
import type { Move, BaseMove } from '@/cube/notation';
import { makeMove } from '@/cube/notation';
import { applyMove } from '@/cube/facelets';
import { APPARENT_RADIUS, CAMERA_ELEVATION, CAMERA_FOV, COLORS, FILL, GLASS_TINT, HIGHLIGHT_DAMP, LAYER_LIFT, LOW_GPU, MAX_RADIUS_PX, MOMENTUM_DECAY, MOMENTUM_STOP, SPRING, STICKER_MAT } from './constants';
import { MathUtils } from 'three';
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
  /** Test hook: commit turns immediately (set localStorage 'cube.fast' = '1'). */
  fast = typeof localStorage !== 'undefined' && localStorage.getItem('cube.fast') === '1';
  /** Learn mode: only this move may commit from a drag; anything else rubber-bands home. */
  gate: ((m: Move) => boolean) | null = null;
  onRejected: (() => void) | null = null;
  cue: Move | null = null;
  /** Which face is up in the user's hands (cube-local). The hidden-face arrow is drawn along its edge. */
  cueUp: BaseMove = 'U';
  cueOpacity = 0;
  cuePulse = new Spring(0, 260, 16);
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
  coreBright: number[] = STICKERS.map(() => 1);
  glassTint: Color[] = STICKERS.map(() => new Color('#ffffff'));
  dimmed: Color[] = STICKERS.map(() => new Color('#ffffff'));
  highlight: ReadonlySet<number> | null = null;
  squash = new Spring(0, SPRING.squash.k, SPRING.squash.c);
  squashAxis = new Vector3(0, 1, 0);
  private rippleTimers: number[] = [];

  floatY = 0;
  breath = 1;
  /** Celebration particles (read by the Sparkles mesh). */
  sparkles: Array<{ p: Vector3; v: Vector3; born: number; life: number }> = [];
  sparkleColor = new Color('#FFD54A');
  canvas: HTMLCanvasElement | null = null;
  /* ---------- the frame: where on the canvas the cube should sit (CSS px). Damped, so it glides between screens ---------- */
  viewport = { w: 0, h: 0 };
  frame = { x: 0, y: 0, w: 0, h: 0 };
  frameTarget = { x: 0, y: 0, w: 0, h: 0 };
  fill = FILL; fillTarget = FILL;
  targetY = -0.3;
  private frameSet = false;
  /** 0..1 presence: fades the object out when no screen owns it */
  presence = 1; presenceTarget = 1;
  bloomTarget = 0;
  bloomValue = 0;
  bloomT = -1;
  t = 0;
  cb: ControllerCallbacks = {};

  private tmpQ = new Quaternion();
  private tmpC = new Color();
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
        const s = f[i] === '.' ? STICKER_MAT.empty : STICKER_MAT.full;
        m.clearcoat = s.clearcoat; m.clearcoatRoughness = s.clearcoatRoughness; m.roughness = s.roughness; m.iridescence = s.iridescence; m.envMapIntensity = s.envMapIntensity;
        m.transmission = LOW_GPU ? 0 : s.transmission; m.thickness = s.thickness; m.attenuationDistance = s.attenuationDistance;
        m.attenuationColor.set(GLASS_TINT[f[i]] ?? GLASS_TINT['.']);
        this.glassTint[i].set(GLASS_TINT[f[i]] ?? GLASS_TINT['.']);
        m.color.copy(this.glassTint[i]);
        this.coreBright[i] = s.coreBright;
        const core = mesh.children[0] as Mesh | undefined;
        if (core) (core.material as MeshBasicMaterial).color.copy(this.baseColor[i]).multiplyScalar(s.coreBright);
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
    if (this.fast) spring.snap(def.angle);
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
    const q = Math.round(target / HALF_PI);
    if (q !== 0 && this.gate) {
      const candidate = makeMove(a.base, ((-q % 4) + 4) % 4);
      if (!candidate || !this.gate(candidate)) { target = 0; this.cuePulse.snap(0); this.cuePulse.kick(9); this.onRejected?.(); }
    }
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
    for (const i of a.stickerIds) { const m = this.stickers[i]; const p = STICKERS[i]; if (m) { m.position.copy(p.position); m.quaternion.copy(p.quaternion); (m.material as MeshPhysicalMaterial).opacity = LOW_GPU ? 0.55 : 1; (m.material as MeshPhysicalMaterial).transparent = LOW_GPU; const cm = (m.children[0] as Mesh | undefined)?.material as MeshBasicMaterial | undefined; if (cm) { cm.opacity = 1; cm.transparent = false; } } }
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
  ripple(from: number, sound = true) {
    this.rippleTimers.forEach(clearTimeout); this.rippleTimers = [];
    const origin = STICKERS[from].position;
    if (sound) sfx.ripplePlink();
    for (let i = 0; i < 54; i++) {
      const d = STICKERS[i].position.distanceTo(origin);
      const amp = -7 * Math.exp(-d / 1.6);
      if (Math.abs(amp) < 0.3) continue;
      this.rippleTimers.push(window.setTimeout(() => this.pressKick(i, amp), d * 38));
    }
  }

  /** Stage complete: a ripple from the top centre plus a handful of glossy sparkles in the stage colour. */
  celebrate(colorHex: string, originIndex = 31) {
    this.sparkleColor.set(colorHex);
    this.ripple(originIndex, false);
    const origin = STICKERS[originIndex].position;
    this.sparkles = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.6 + Math.random() * 0.9;
      return { p: origin.clone().add(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyQuaternion(this.tmpQ.setFromUnitVectors(new Vector3(0, 1, 0), STICKERS[originIndex].normal))), v: STICKERS[originIndex].normal.clone().multiplyScalar(0.9 + Math.random() * 0.6).addScaledVector(new Vector3(Math.cos(a), 0, Math.sin(a)), 0.25), born: this.t, life: 1.1 + Math.random() * 0.3 };
    });
    this.squashAxis.copy(STICKERS[originIndex].normal); this.squash.snap(0); this.squash.kick(1.2);
    this.invalidate();
  }
  /** Screen position (CSS px, relative to the canvas) of sticker i right now. */
  project(i: number): { x: number; y: number } | null {
    if (!this.camera || !this.canvas) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = STICKERS[i].position.clone().applyQuaternion(this.tmpQ.copy(this.qDrift).multiply(this.qOrientation)); p.y += this.floatY; p.project(this.camera);
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height };
  }

  /** Solved moment: iridescence sweeps to full, then relaxes to a memento level. */
  bloom() { this.bloomT = this.t; this.bloomTarget = 0.75; this.invalidate(); }
  setBloom(v: number) { this.bloomTarget = v; this.bloomT = -1; this.invalidate(); }
  private applyBloom(dt: number): boolean {
    if (this.bloomT >= 0 && this.t - this.bloomT > 2.6) { this.bloomTarget = 0.25; this.bloomT = -1; }
    if (Math.abs(this.bloomValue - this.bloomTarget) < 0.002) { if (this.bloomValue !== this.bloomTarget) { this.bloomValue = this.bloomTarget; this.writeBloom(); } return false; }
    this.bloomValue = damp(this.bloomValue, this.bloomTarget, this.bloomTarget > this.bloomValue ? 4.5 : 2.2, dt);
    this.writeBloom();
    return true;
  }
  private writeBloom() {
    const b = this.bloomValue;
    for (let i = 0; i < 54; i++) {
      const m = this.stickers[i]?.material as MeshPhysicalMaterial | undefined; if (!m) continue;
      if (this.displayFacelets[i] === '.') continue;
      // solved: the clay takes a glaze — clearcoat and a thin-film shimmer rise together, then relax
      m.iridescenceThicknessRange = [160 + 120 * b, 520 + 300 * b];
    }
  }

  /* ---------- camera fit ---------- */
  setViewport(w: number, h: number) { this.viewport = { w, h }; if (!this.frameSet) { this.frameTarget = { x: 0, y: 0, w, h }; this.frame = { ...this.frameTarget }; } this.fitCamera(); this.invalidate(); }
  setFrame(f: { x: number; y: number; w: number; h: number } | null, fill = FILL, animate = true) {
    if (!f) { this.presenceTarget = 0; this.invalidate(); return; }
    this.presenceTarget = 1;
    this.fillTarget = fill;
    this.frameTarget = { ...f };
    if (!this.frameSet || !animate || this.reduced) { this.frame = { ...f }; this.fill = fill; this.frameSet = true; this.fitCamera(); }
    this.frameSet = true;
    this.invalidate();
  }
  /** Distance from the frame's short side, projection shifted so the cube centres on the frame. */
  fitCamera() {
    const cam = this.camera; const { w: W, h: H } = this.viewport;
    if (!cam || !W || !H) return;
    const f = this.frame;
    const vHalf = Math.tan(MathUtils.degToRad(CAMERA_FOV) / 2);
    const short = Math.max(40, Math.min(f.w, f.h));
    const rPx = Math.min((this.fill * short) / 2, MAX_RADIUS_PX);
    const d = (APPARENT_RADIUS * (H / 2)) / (vHalf * rPx);
    const phi = MathUtils.degToRad(CAMERA_ELEVATION);
    cam.fov = CAMERA_FOV; cam.aspect = W / H; cam.near = 1; cam.far = 200;
    cam.position.set(0, d * Math.sin(phi) + this.targetY, d * Math.cos(phi));
    cam.lookAt(0, this.targetY, 0);
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    cam.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    cam.updateProjectionMatrix();
  }
  private stepFrame(dt: number): boolean {
    let moving = false;
    const k = 11;
    const near = (a: number, b: number, eps: number) => Math.abs(a - b) < eps;
    if (!near(this.frame.x, this.frameTarget.x, 0.25) || !near(this.frame.y, this.frameTarget.y, 0.25) || !near(this.frame.w, this.frameTarget.w, 0.25) || !near(this.frame.h, this.frameTarget.h, 0.25) || !near(this.fill, this.fillTarget, 0.001)) {
      this.frame.x = damp(this.frame.x, this.frameTarget.x, k, dt); this.frame.y = damp(this.frame.y, this.frameTarget.y, k, dt);
      this.frame.w = damp(this.frame.w, this.frameTarget.w, k, dt); this.frame.h = damp(this.frame.h, this.frameTarget.h, k, dt);
      this.fill = damp(this.fill, this.fillTarget, k, dt);
      if (near(this.frame.x, this.frameTarget.x, 0.25) && near(this.frame.y, this.frameTarget.y, 0.25) && near(this.frame.w, this.frameTarget.w, 0.25) && near(this.frame.h, this.frameTarget.h, 0.25)) { this.frame = { ...this.frameTarget }; this.fill = this.fillTarget; }
      this.fitCamera();
      moving = true;
    }
    if (!near(this.presence, this.presenceTarget, 0.004)) { this.presence = damp(this.presence, this.presenceTarget, 8, dt); moving = true; }
    else this.presence = this.presenceTarget;
    return moving;
  }

  /* ---------- master loop ---------- */
  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.t += dt;
    let moving = false;
    if (this.stepFrame(dt)) moving = true;

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
        if (a.ghost) { const mat = m.material as MeshPhysicalMaterial; mat.transparent = true; mat.opacity = this.ghostOpacity; const cm = (m.children[0] as Mesh | undefined)?.material as MeshBasicMaterial | undefined; if (cm) { cm.transparent = true; cm.opacity = this.ghostOpacity; } }
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
      const core = (m.children[0] as Mesh | undefined)?.material as MeshBasicMaterial | undefined;
      const isDim = !!this.highlight && !this.highlight.has(i);
      const target = isDim ? this.dimmed[i] : this.baseColor[i];
      const empty = this.displayFacelets[i] === '.';
      const envT = empty ? STICKER_MAT.empty.envMapIntensity : isDim ? 0.18 : STICKER_MAT.full.envMapIntensity + 1.2 * this.bloomValue;
      // a dimmed tile also goes matte and loses its shimmer, so it reads as "in shadow", not as dirty glass
      const roughT = empty ? STICKER_MAT.empty.roughness : isDim ? 0.6 : STICKER_MAT.full.roughness;
      const iridT = empty ? 0 : isDim ? 0 : STICKER_MAT.full.iridescence + 0.7 * this.bloomValue;
      // highlighted stickers breathe outward so the eye finds them even on a busy cube
      if (this.highlight && this.highlight.has(i) && !sp.moving && !this.active?.stickerIds.includes(i)) {
        const lift = 0.06 * (0.5 + 0.5 * Math.sin(this.t * 4));
        m.position.copy(p.position).addScaledVector(p.normal, lift);
        moving = true;
      } else if (!this.highlight && !sp.moving && !this.active && m.position.distanceToSquared(p.position) > 1e-8) m.position.copy(p.position);
      if (Math.abs(mat.envMapIntensity - envT) > 0.005) { mat.envMapIntensity = damp(mat.envMapIntensity, envT, HIGHLIGHT_DAMP, dt); moving = true; }
      if (Math.abs(mat.roughness - roughT) > 0.003) { mat.roughness = damp(mat.roughness, roughT, HIGHLIGHT_DAMP, dt); moving = true; }
      if (Math.abs(mat.iridescence - iridT) > 0.003) { mat.iridescence = damp(mat.iridescence, iridT, HIGHLIGHT_DAMP, dt); moving = true; }
      // in shadow the glass darkens too, or the light tint would wash the dimmed stone out
      const glassWant = this.tmpC.copy(this.glassTint[i]).multiplyScalar(isDim ? 0.3 : 1);
      if (!mat.color.equals(glassWant)) {
        mat.color.r = damp(mat.color.r, glassWant.r, HIGHLIGHT_DAMP, dt); mat.color.g = damp(mat.color.g, glassWant.g, HIGHLIGHT_DAMP, dt); mat.color.b = damp(mat.color.b, glassWant.b, HIGHLIGHT_DAMP, dt);
        if (Math.abs(mat.color.r - glassWant.r) + Math.abs(mat.color.g - glassWant.g) + Math.abs(mat.color.b - glassWant.b) < 0.006) mat.color.copy(glassWant);
        moving = true;
      }
      if (core) {
        // the core carries the stone's colour
        const want = this.tmpC.copy(target).multiplyScalar(this.coreBright[i]);
        const cc = core.color;
        if (!cc.equals(want)) {
          cc.r = damp(cc.r, want.r, HIGHLIGHT_DAMP, dt); cc.g = damp(cc.g, want.g, HIGHLIGHT_DAMP, dt); cc.b = damp(cc.b, want.b, HIGHLIGHT_DAMP, dt);
          if (Math.abs(cc.r - want.r) + Math.abs(cc.g - want.g) + Math.abs(cc.b - want.b) < 0.006) cc.copy(want);
          moving = true;
        }
      }
    }

    if (this.squash.moving) { this.squash.step(dt); moving = true; }
    if (this.applyBloom(dt)) moving = true;
    if (this.sparkles.length) { this.sparkles = this.sparkles.filter((sp) => this.t - sp.born < sp.life); for (const sp of this.sparkles) { sp.p.addScaledVector(sp.v, dt); sp.v.multiplyScalar(Math.exp(-1.6 * dt)); } moving = true; }
    if (this.cuePulse.moving) { this.cuePulse.step(dt); moving = true; }
    const cueTarget = this.cue && !this.active ? 1 : 0;
    if (Math.abs(this.cueOpacity - cueTarget) > 0.002) { this.cueOpacity = damp(this.cueOpacity, cueTarget, 14, dt); moving = true; } else this.cueOpacity = cueTarget;

    if (moving) this.invalidate();
    return moving;
  }

  dispose() { this.rippleTimers.forEach(clearTimeout); }
}

function rubber(over: number, c = 0.55, dim = 1.2) { return (over * dim * c) / (dim + c * Math.abs(over)); }

