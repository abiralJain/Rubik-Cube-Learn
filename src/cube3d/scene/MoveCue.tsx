import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ConeGeometry, Curve, Group, Mesh, MeshBasicMaterial, TubeGeometry, Vector3 } from 'three';
import type { CubeController } from '../controller';
import type { Move, BaseMove } from '@/cube/notation';
import { turnsOf } from '@/cube/notation';
import { FACES, STICKERS } from '../placements';
import { moveDef } from '../moves';
import { PITCH, TILE_PROUD } from '../constants';

/** Arc in the plane of a face, drawn a little above its stickers. Increasing t goes clockwise seen from outside when sign = +1. */
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

const INK = new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthTest: true });

function buildArrow(move: Move, up: BaseMove): Group {
  const g = new Group();
  const base = move[0] as BaseMove;
  const t = turnsOf(move);
  const cw = t === 1, half = t === 2;
  const f = FACES[base];
  const n = new Vector3(...f.n), u = new Vector3(...f.u), v = new Vector3(...f.v);
  const tube = 0.075;
  if (base === 'B') {
    // The back face is hidden from the user: draw a straight arrow just above the edge it shares with the up face,
    // pointing the way that edge's stickers slide. Direction comes from rotating one of those stickers by the move.
    const nUp = new Vector3(...FACES[up].n);
    const edgeSticker = STICKERS.find((p) => p.face === up && p.slot[2] === -1 && p.slot[0] === 0)!; // up-face sticker next to B, centre column
    const def = moveDef(move);
    const rotated = edgeSticker.position.clone().applyAxisAngle(def.axis, cw ? -Math.PI / 2 : Math.PI / 2);
    const dir = rotated.sub(edgeSticker.position).setComponent(1, 0).normalize();
    if (dir.lengthSq() < 0.5) dir.set(cw ? -1 : 1, 0, 0);
    const c = nUp.clone().multiplyScalar(1.5 * PITCH + TILE_PROUD + 0.22).add(n.clone().multiplyScalar(1.5 * PITCH - 0.35));
    const len = half ? 1.25 : 1.0;
    const a = c.clone().addScaledVector(dir, -len), b = c.clone().addScaledVector(dir, len);
    g.add(new Mesh(new TubeGeometry(new Segment(a, b), 8, tube, 10), INK));
    g.add(head(b, dir));
    if (half) g.add(head(a, dir.clone().negate()));
    return g;
  }
  // u × v = -n, so increasing angle is clockwise seen from outside the face.
  const c = n.clone().multiplyScalar(1.5 * PITCH + TILE_PROUD + 0.18);
  const r = 1.18;
  const span = half ? Math.PI * 1.15 : Math.PI * 0.85;
  const a0 = -Math.PI / 2 - (cw ? span / 2 : -span / 2) + (cw ? 0 : 0);
  const a1 = cw ? a0 + span : a0 - span;
  const curve = new FaceArc(c, u, v, r, a0, a1);
  g.add(new Mesh(new TubeGeometry(curve, 40, tube, 10), INK));
  const end = curve.getPoint(1), tangent = curve.getPoint(1).sub(curve.getPoint(0.97)).normalize();
  g.add(head(end, tangent));
  if (half) { const start = curve.getPoint(0), t0 = curve.getPoint(0).sub(curve.getPoint(0.03)).normalize(); g.add(head(start, t0)); }
  return g;
}
function head(at: Vector3, dir: Vector3) {
  const m = new Mesh(new ConeGeometry(0.19, 0.34, 18), INK);
  m.position.copy(at).addScaledVector(dir, 0.1);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir);
  return m;
}

/** Draws the expected move on the cube. Fades with ctrl.cueOpacity, breathes, pulses when a turn is rejected. */
export function MoveCue({ ctrl }: { ctrl: CubeController }) {
  const holder = useRef<Group>(null);
  const built = useRef<{ move: Move | null; group: Group | null }>({ move: null, group: null });
  const mat = useMemo(() => INK, []);
  useEffect(() => () => { built.current.group?.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); }); }, []);
  useFrame(() => {
    const h = holder.current; if (!h) return;
    const key = ctrl.cue ? (`${ctrl.cue}|${ctrl.cueUp}` as Move) : null;
    if (key !== built.current.move) {
      if (built.current.group) { h.remove(built.current.group); built.current.group.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); }); }
      built.current = { move: key, group: ctrl.cue ? buildArrow(ctrl.cue, ctrl.cueUp) : null };
      if (built.current.group) h.add(built.current.group);
    }
    mat.opacity = ctrl.cueOpacity * 0.9;
    h.visible = ctrl.cueOpacity > 0.01;
    const breathe = 1 + 0.03 * Math.sin(ctrl.t * Math.PI) + ctrl.cuePulse.x * 0.05;
    h.scale.setScalar(breathe);
  });
  return <group ref={holder} />;
}

import { InstancedMesh, Matrix4, MeshBasicMaterial as MBM, SphereGeometry } from 'three';
/** Twelve glossy dots that rise and fade after a stage completes. One draw call. */
export function Sparkles({ ctrl }: { ctrl: CubeController }) {
  const ref = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new SphereGeometry(0.075, 10, 8), []);
  const mat = useMemo(() => new MBM({ color: '#ffffff', transparent: true, opacity: 0.95 }), []);
  const m4 = useMemo(() => new Matrix4(), []);
  useFrame(() => {
    const im = ref.current; if (!im) return;
    mat.color.copy(ctrl.sparkleColor);
    let n = 0;
    for (const sp of ctrl.sparkles) {
      const age = (ctrl.t - sp.born) / sp.life;
      const s = 0.5 + 0.9 * Math.sin(Math.PI * Math.min(1, age)); // grows then shrinks
      m4.makeScale(s, s, s).setPosition(sp.p);
      im.setMatrixAt(n++, m4);
    }
    im.count = n; im.instanceMatrix.needsUpdate = true; im.visible = n > 0;
  });
  return <instancedMesh ref={ref} args={[geo, mat, 12]} frustumCulled={false} />;
}
