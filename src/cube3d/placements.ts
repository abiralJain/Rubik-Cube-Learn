import { Quaternion, Vector3 } from 'three';
import { PITCH, STICKER_OFFSET } from './constants';
import type { Face } from '@/cube/facelets';

type V3 = [number, number, number];
export const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Outward normal and in-plane basis so index 0..8 reads left→right, top→bottom facing the face. Verified against Kociemba. */
export const FACES: Record<Face, { n: V3; u: V3; v: V3 }> = {
  U: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  D: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  F: { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] },
  B: { n: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] },
  R: { n: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
  L: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] },
};

export interface StickerPlacement {
  index: number; face: Face; row: number; col: number;
  slot: V3; slotId: number;
  position: Vector3; quaternion: Quaternion; normal: Vector3;
  u: Vector3; v: Vector3;
}

export const slotIdOf = (s: V3) => (s[0] + 1) + (s[1] + 1) * 3 + (s[2] + 1) * 9;

export const STICKERS: StickerPlacement[] = [];
for (let idx = 0; idx < 54; idx++) {
  const face = FACE_ORDER[Math.floor(idx / 9)];
  const i = idx % 9, row = Math.floor(i / 3), col = i % 3;
  const { n, u, v } = FACES[face];
  const slot: V3 = [
    n[0] + u[0] * (col - 1) + v[0] * (row - 1),
    n[1] + u[1] * (col - 1) + v[1] * (row - 1),
    n[2] + u[2] * (col - 1) + v[2] * (row - 1),
  ];
  const normal = new Vector3(...n);
  const position = new Vector3(...slot).multiplyScalar(PITCH).addScaledVector(normal, STICKER_OFFSET);
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
  STICKERS.push({ index: idx, face, row, col, slot, slotId: slotIdOf(slot), position, quaternion, normal, u: new Vector3(...u), v: new Vector3(...v) });
}

export interface Slot { id: number; pos: V3; rest: Vector3 }
export const SLOTS: Slot[] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (!x && !y && !z) continue;
  SLOTS.push({ id: slotIdOf([x, y, z]), pos: [x, y, z], rest: new Vector3(x, y, z).multiplyScalar(PITCH) });
}
export const slotById = new Map(SLOTS.map((s) => [s.id, s]));
