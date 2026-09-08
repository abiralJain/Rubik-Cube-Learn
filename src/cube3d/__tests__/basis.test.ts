import { describe, it, expect } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { STICKERS, FACES, FACE_ORDER } from '../placements';
import { moveDef } from '../moves';
import { PERM } from '@/cube/facelets';
import type { Move } from '@/cube/notation';

/** Rotate each sticker of the layer geometrically and re-read (face,row,col); must match the facelet cycle tables. */
describe('3D basis matches Kociemba facelet tables', () => {
  const faceOfNormal = (n: Vector3) => FACE_ORDER.find((f) => new Vector3(...FACES[f].n).distanceTo(n) < 1e-6)!;
  for (const m of ['U', 'R', 'F', 'D', 'L', 'B'] as Move[]) {
    it(`move ${m}`, () => {
      const def = moveDef(m);
      const R = new Matrix4().makeRotationAxis(def.axis, def.angle);
      const perm = Array.from({ length: 54 }, (_, i) => i);
      for (const src of def.stickerIds) {
        const p = STICKERS[src];
        const centre = new Vector3(...p.slot).addScaledVector(p.normal, 0.5).applyMatrix4(R);
        const n = p.normal.clone().applyMatrix4(R).round();
        const dstFace = faceOfNormal(n);
        const rel = centre.sub(n.clone().multiplyScalar(0.5));
        const col = Math.round(rel.dot(new Vector3(...FACES[dstFace].u))) + 1;
        const row = Math.round(rel.dot(new Vector3(...FACES[dstFace].v))) + 1;
        perm[FACE_ORDER.indexOf(dstFace) * 9 + row * 3 + col] = src;
      }
      expect(perm).toEqual(Array.from(PERM[m]));
    });
  }
  it('54 stickers cover 26 slots: 6 centres, 12 edges, 8 corners', () => {
    const count = new Map<number, number>();
    for (const p of STICKERS) count.set(p.slotId, (count.get(p.slotId) ?? 0) + 1);
    expect(count.size).toBe(26);
    const hist = [0, 0, 0, 0];
    for (const v of count.values()) hist[v]++;
    expect(hist).toEqual([0, 6, 12, 8]);
  });
});
