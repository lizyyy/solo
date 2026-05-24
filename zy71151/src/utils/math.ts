import { Vector3 } from '../types';

export const distance = (a: Vector3, b: Vector3): number => {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2)
  );
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const lerpVector3 = (a: Vector3, b: Vector3, t: number): Vector3 => {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
};

export const normalizeAngle = (angle: number): number => {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
};

export const angleTo = (from: Vector3, to: Vector3): number => {
  return Math.atan2(to.x - from.x, to.z - from.z);
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const moveTowards = (
  current: Vector3,
  target: Vector3,
  maxDistance: number
): Vector3 => {
  const dist = distance(current, target);
  if (dist <= maxDistance) return target;
  const t = maxDistance / dist;
  return lerpVector3(current, target, t);
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};
