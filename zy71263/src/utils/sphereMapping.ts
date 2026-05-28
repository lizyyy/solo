import type { Quaternion } from '@/types';

export function quaternionToSphere(q: Quaternion, radius = 1): { x: number; y: number; z: number } {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
  if (len < 1e-10) {
    return { x: 0, y: radius, z: 0 };
  }
  return {
    x: (q.x / len) * radius,
    y: (q.y / len) * radius,
    z: (q.z / len) * radius,
  };
}

export function eulerToSphere(
  roll: number,
  pitch: number,
  yaw: number,
  radius = 1
): { x: number; y: number; z: number } {
  const theta = pitch;
  const phi = yaw;
  return {
    x: radius * Math.sin(theta) * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * Math.sin(theta) * Math.sin(phi),
  };
}
