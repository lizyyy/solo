import type { Quaternion } from '@/types';
import { quatDot, quatNormalize, quatNegate } from './quaternion';

export function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let qa = quatNormalize(a);
  let qb = quatNormalize(b);

  let dot = quatDot(qa, qb);

  if (dot < 0) {
    qb = quatNegate(qb);
    dot = -dot;
  }

  if (dot > 0.9995) {
    return lerp(qa, qb, t);
  }

  const theta = Math.acos(Math.min(1, Math.max(-1, dot)));
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return {
    w: wa * qa.w + wb * qb.w,
    x: wa * qa.x + wb * qb.x,
    y: wa * qa.y + wb * qb.y,
    z: wa * qa.z + wb * qb.z,
    source: 'computed',
  };
}

export function lerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  const qa = quatNormalize(a);
  const qb = quatNormalize(b);

  const result = {
    w: qa.w * (1 - t) + qb.w * t,
    x: qa.x * (1 - t) + qb.x * t,
    y: qa.y * (1 - t) + qb.y * t,
    z: qa.z * (1 - t) + qb.z * t,
    source: 'computed' as const,
  };

  return quatNormalize(result);
}

export function generateInterpolationPath(
  from: Quaternion,
  to: Quaternion,
  steps: number,
  method: 'slerp' | 'lerp' = 'slerp'
): Quaternion[] {
  const path: Quaternion[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push(method === 'slerp' ? slerp(from, to, t) : lerp(from, to, t));
  }
  return path;
}

export function isLongPath(a: Quaternion, b: Quaternion): boolean {
  const dot = quatDot(quatNormalize(a), quatNormalize(b));
  return dot < 0;
}
