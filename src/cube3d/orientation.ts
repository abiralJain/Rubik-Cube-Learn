import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Face } from '@/cube/facelets';
import { FACES } from './placements';

/** Quaternion that puts `top`'s normal on world +y and `front`'s on world +z, then yaws to reveal the right side. */
export function quaternionForFaces(top: Face, front: Face, yaw = -0.5, pitch = 0): Quaternion {
  const up = new Vector3(...FACES[top].n), fwd = new Vector3(...FACES[front].n);
  const right = new Vector3().crossVectors(up, fwd);
  const m = new Matrix4().makeBasis(right, up, fwd);
  const q = new Quaternion().setFromRotationMatrix(m).invert();
  const yawQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  const pitchQ = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch);
  return pitchQ.multiply(yawQ).multiply(q);
}

export type Orientation = { top: Face; front: Face; yaw?: number; pitch?: number } | Quaternion;
export const HERO: Orientation = { top: 'U', front: 'F', yaw: -0.55, pitch: 0.12 };

export function resolveOrientation(o: Orientation): Quaternion {
  if (o instanceof Quaternion) return o.clone();
  return quaternionForFaces(o.top, o.front, o.yaw ?? -0.5, o.pitch ?? 0.1);
}
