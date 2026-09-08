import { Vector3 } from 'three';
import type { Move, BaseMove } from '@/cube/notation';
import { turnsOf } from '@/cube/notation';
import { SLOTS, STICKERS } from './placements';

type V3 = [number, number, number];
const AXIS: Record<BaseMove, V3> = {
  R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1],
};

export interface MoveDef {
  move: Move; base: BaseMove; axis: Vector3; angle: number; quarterTurns: number;
  slotIds: number[]; stickerIds: number[];
}

const cache = new Map<Move, MoveDef>();

/** Clockwise seen from outside the face = negative rotation about its outward normal. */
export function moveDef(m: Move): MoveDef {
  const hit = cache.get(m);
  if (hit) return hit;
  const base = m[0] as BaseMove;
  const t = turnsOf(m);
  const quarterTurns = t === 2 ? 2 : 1;
  const sign = t === 3 ? 1 : -1;
  const axis = new Vector3(...AXIS[base]);
  const slotIds = SLOTS.filter((s) => s.pos[0] * axis.x + s.pos[1] * axis.y + s.pos[2] * axis.z === 1).map((s) => s.id);
  const slotSet = new Set(slotIds);
  const stickerIds = STICKERS.filter((p) => slotSet.has(p.slotId)).map((p) => p.index);
  const def: MoveDef = { move: m, base, axis, angle: sign * quarterTurns * Math.PI / 2, quarterTurns, slotIds, stickerIds };
  cache.set(m, def);
  return def;
}

/** Layer through a slot perpendicular to `axisIndex` (0=x,1=y,2=z): returns the face move base and whether the slot's layer is an outer one. */
export function layerFor(slotPos: V3, axisIndex: 0 | 1 | 2): BaseMove | null {
  const c = slotPos[axisIndex];
  if (c === 0) return null; // slices not taught
  if (axisIndex === 0) return c > 0 ? 'R' : 'L';
  if (axisIndex === 1) return c > 0 ? 'U' : 'D';
  return c > 0 ? 'F' : 'B';
}
