import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeGeometry, Curve, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector3, InstancedMesh, Matrix4, SphereGeometry } from 'three';
import type { CubeController } from '../controller';
import type { Move, BaseMove } from '@/cube/notation';
import { turnsOf } from '@/cube/notation';
import { FACES, STICKERS } from '../placements';
import { moveDef } from '../moves';
import { PITCH, TILE_PROUD } from '../constants';

/** Arc in the plane of a face, drawn a little above its stickers. */
class FaceArc extends Curve<Vector3> {
  constructor(private c: Vector3, private e1: Vector3, private e2: Vector3, private r: number, private a0: number, private a1: number) { super(); }
  getPoint(t: number, target = new Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return target.copy(this.c).addScaledVector(this.e1, Math.cos(a) * this.r).addScaledVector(this.e2, Math.sin(a) * this.r);
  }
}
class Segment extends Curve<Vector3> {
  constructor(private a: Vector3, private b: Vector3) { super(); }
  getPoint(t: number, target = new Vector3()) { return target.copy(this.a).lerp(this.b, t); }
}
/** A window [a, b] of another curve. */
class Sub extends Curve<Vector3> {
  constructor(private base: Curve<Vector3>, private a: number, private b: number) { super(); }
  getPoint(t: number, target = new Vector3()) { return this.base.getPoint(this.a + (this.b - this.a) * t, target); }
}

const TUBE = 0.075;
const ALL: BaseMove[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const OPP: Record<BaseMove, BaseMove> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

/**
 * The path the arrow follows for a move, given which faces the viewer can see.
 * On a visible face: an arc in that face's plane. On a hidden face: a straight run above the edge it shares with
 * the most visible neighbouring face, pointing the way that edge's stickers slide.
 */
function pathFor(move: Move, visible: Record<BaseMove, number>): { curve: Curve<Vector3>; half: boolean } {
  const base = move[0] as BaseMove;
  const t = turnsOf(move);
  const cw = t === 1, half = t === 2;
  const f = FACES[base];
  const n = new Vector3(...f.n), u = new Vector3(...f.u), v = new Vector3(...f.v);
  if (visible[base] < 0.12) {
    const edgeFace = ALL.filter((x) => x !== base && x !== OPP[base]).sort((a, b) => visible[b] - visible[a])[0];
    const nE = new Vector3(...FACES[edgeFace].n);
    const nb = n.clone().round();
    const sticker = STICKERS.find((p) => p.face === edgeFace && Math.round(p.slot[0] * nb.x + p.slot[1] * nb.y + p.slot[2] * nb.z) === 1 && Math.abs(p.slot[0]) + Math.abs(p.slot[1]) + Math.abs(p.slot[2]) === 2)!;
    const def = moveDef(move);
    const rotated = sticker.position.clone().applyAxisAngle(def.axis, cw ? -Math.PI / 2 : Math.PI / 2);
    const dir = rotated.sub(sticker.position).addScaledVector(nE, -rotated.clone().sub(sticker.position).dot(nE)).normalize();
    const c = nE.clone().multiplyScalar(1.5 * PITCH + TILE_PROUD + 0.22).add(n.clone().multiplyScalar(1.5 * PITCH - 0.35));
    const len = half ? 1.25 : 1.0;
    return { curve: new Segment(c.clone().addScaledVector(dir, -len), c.clone().addScaledVector(dir, len)), half };
  }
  // u × v = -n, so increasing angle is clockwise seen from outside the face.
  const c = n.clone().multiplyScalar(1.5 * PITCH + TILE_PROUD + 0.18);
  const r = 1.18;
  const span = half ? Math.PI * 1.15 : Math.PI * 0.85;
  const a0 = -Math.PI / 2 - (cw ? span / 2 : -span / 2);
  const a1 = cw ? a0 + span : a0 - span;
  return { curve: new FaceArc(c, u, v, r, a0, a1), half };
}

function headMesh(mat: MeshBasicMaterial) { return new Mesh(new ConeGeometry(0.19, 0.34, 18), mat); }
function placeHead(m: Mesh, at: Vector3, dir: Vector3) { m.position.copy(at).addScaledVector(dir, 0.1); m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir); }

/**
 * Draws the expected move on the cube: a quiet full path, and a bright head that travels it when the controller
 * sweeps. Fades with ctrl.cueOpacity, pulses when a turn is rejected. Rebuilt when the move or the view changes.
 */
export function MoveCue({ ctrl }: { ctrl: CubeController }) {
  const holder = useRef<Group>(null);
  const quiet = useMemo(() => new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthTest: true }), []);
  const bright = useMemo(() => new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthTest: false }), []);
  const built = useRef<{ key: string; group: Group | null; curve: Curve<Vector3> | null; half: boolean; comet: Mesh | null; head: Mesh | null }>({ key: '', group: null, curve: null, half: false, comet: null, head: null });
  const camDir = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);
  useEffect(() => () => { built.current.group?.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); }); quiet.dispose(); bright.dispose(); }, [quiet, bright]);

  useFrame(() => {
    const h = holder.current; if (!h || !ctrl.camera) return;
    // which faces can the viewer see right now (cube-local normals against the camera direction)
    camDir.copy(ctrl.camera.position).normalize();
    const vis = {} as Record<BaseMove, number>;
    for (const b of ALL) vis[b] = tmp.set(...FACES[b].n).applyQuaternion(ctrl.qOrientation).dot(camDir);
    const hiddenKey = ctrl.cue ? (vis[ctrl.cue[0] as BaseMove] < 0.12 ? 'h' + ALL.filter((x) => x !== ctrl.cue![0] && x !== OPP[ctrl.cue![0] as BaseMove]).sort((a, b) => vis[b] - vis[a])[0] : 'v') : '';
    const key = ctrl.cue ? `${ctrl.cue}|${hiddenKey}` : '';
    if (key !== built.current.key) {
      const b = built.current;
      if (b.group) { h.remove(b.group); b.group.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); }); }
      b.key = key; b.group = null; b.curve = null; b.comet = null; b.head = null;
      if (ctrl.cue) {
        const { curve, half } = pathFor(ctrl.cue, vis);
        const g = new Group();
        g.add(new Mesh(new TubeGeometry(curve, 40, TUBE * 0.8, 10), quiet));
        const end = curve.getPoint(1), tan = curve.getPoint(1).sub(curve.getPoint(0.97)).normalize();
        const endHead = headMesh(quiet); placeHead(endHead, end, tan); g.add(endHead);
        if (half) { const start = curve.getPoint(0), t0 = curve.getPoint(0).sub(curve.getPoint(0.03)).normalize(); const sh = headMesh(quiet); placeHead(sh, start, t0); g.add(sh); }
        const comet = new Mesh(new TubeGeometry(new Sub(curve, 0, 0.001), 12, TUBE, 10), bright); comet.visible = false; g.add(comet);
        const head = headMesh(bright); head.visible = false; g.add(head);
        h.add(g);
        b.group = g; b.curve = curve; b.half = half; b.comet = comet; b.head = head;
      }
    }
    const b = built.current;
    quiet.opacity = ctrl.cueOpacity * 0.55;
    h.visible = ctrl.cueOpacity > 0.01;
    const breathe = 1 + 0.02 * Math.sin(ctrl.t * Math.PI) + ctrl.cuePulse.x * 0.05;
    h.scale.setScalar(breathe);
    // the travelling head
    if (b.curve && b.comet && b.head) {
      const k = ctrl.cueSweep;
      if (k >= 0) {
        const eased = 1 - Math.pow(1 - k, 2.2);
        const tail = Math.max(0, eased - 0.28);
        b.comet.geometry.dispose();
        b.comet.geometry = new TubeGeometry(new Sub(b.curve, tail, Math.max(tail + 0.001, eased)), 14, TUBE * 1.05, 10);
        const at = b.curve.getPoint(eased), dir = b.curve.getPoint(Math.min(1, eased + 0.01)).sub(b.curve.getPoint(Math.max(0, eased - 0.01))).normalize();
        placeHead(b.head, at, dir);
        const fade = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
        bright.opacity = ctrl.cueOpacity * fade;
        b.comet.visible = b.head.visible = true;
      } else { b.comet.visible = b.head.visible = false; }
    }
  });
  return <group ref={holder} />;
}

/** Twelve glossy dots that rise and fade after a stage completes. One draw call. */
export function Sparkles({ ctrl }: { ctrl: CubeController }) {
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new SphereGeometry(0.075, 10, 8), []);
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95 }), []);
  const m4 = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    const im = ref.current; if (!im) return;
    mat.color.copy(ctrl.sparkleColor);
    let n = 0;
    for (const sp of ctrl.sparkles) {
      const age = (ctrl.t - sp.born) / sp.life;
      const s = 0.5 + 0.9 * Math.sin(Math.PI * Math.min(1, age));
      m4.makeScale(s, s, s).setPosition(sp.p);
      im.setMatrixAt(n++, m4);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.visible = n > 0;
  });
  return <instancedMesh ref={ref} args={[geo, mat, 12]} frustumCulled={false} />;
}
