import type { Quaternion } from '@/types';

export function quatNorm(q: Quaternion): number {
  return Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
}

export function quatNormalize(q: Quaternion): Quaternion {
  const norm = quatNorm(q);
  if (norm < 1e-10) {
    return { w: 1, x: 0, y: 0, z: 0, source: 'computed' };
  }
  return {
    w: q.w / norm,
    x: q.x / norm,
    y: q.y / norm,
    z: q.z / norm,
    source: 'computed',
  };
}

export function quatDot(a: Quaternion, b: Quaternion): number {
  return a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    source: 'computed',
  };
}

export function quatConjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z, source: 'computed' };
}

export function quatNegate(q: Quaternion): Quaternion {
  return { w: -q.w, x: -q.x, y: -q.y, z: -q.z, source: q.source };
}

export function quatIsNormalized(q: Quaternion, epsilon = 0.001): boolean {
  const norm = quatNorm(q);
  return Math.abs(norm - 1.0) <= epsilon;
}

export function quatAngle(a: Quaternion, b: Quaternion): number {
  const d = quatDot(a, b);
  return Math.acos(Math.min(1, Math.max(-1, Math.abs(d)))) * 2;
}

export function quatToVector3(q: Quaternion): { x: number; y: number; z: number } {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
  if (len < 1e-10) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: q.x / len, y: q.y / len, z: q.z / len };
}

export function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quaternion {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);
  return {
    w: Math.cos(halfAngle),
    x: ax * s,
    y: ay * s,
    z: az * s,
    source: 'computed',
  };
}

export function quatIdentity(): Quaternion {
  return { w: 1, x: 0, y: 0, z: 0, source: 'raw' };
}
