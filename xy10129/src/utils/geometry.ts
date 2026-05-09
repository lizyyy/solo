import { Vector3D } from '../types';

export const distance = (a: Vector3D, b: Vector3D): number => {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) +
    Math.pow(b.y - a.y, 2) +
    Math.pow(b.z - a.z, 2)
  );
};

export const lerp = (a: Vector3D, b: Vector3D, t: number): Vector3D => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t
});

export const pointInBox = (
  point: Vector3D,
  boxPos: Vector3D,
  boxW: number,
  boxL: number,
  boxH: number
): boolean => {
  const minX = boxPos.x - boxW / 2;
  const maxX = boxPos.x + boxW / 2;
  const minY = boxPos.y - boxH / 2;
  const maxY = boxPos.y + boxH / 2;
  const minZ = boxPos.z - boxL / 2;
  const maxZ = boxPos.z + boxL / 2;

  return (
    point.x >= minX && point.x <= maxX &&
    point.y >= minY && point.y <= maxY &&
    point.z >= minZ && point.z <= maxZ
  );
};

export const lineSegmentIntersectsBox = (
  p1: Vector3D,
  p2: Vector3D,
  boxPos: Vector3D,
  boxW: number,
  boxL: number,
  boxH: number
): boolean => {
  const minX = boxPos.x - boxW / 2;
  const maxX = boxPos.x + boxW / 2;
  const minY = boxPos.y - boxH / 2;
  const maxY = boxPos.y + boxH / 2;
  const minZ = boxPos.z - boxL / 2;
  const maxZ = boxPos.z + boxL / 2;

  const checkFace = (axis: 'x' | 'y' | 'z', min: number, max: number): boolean => {
    const getAxis = (v: Vector3D) => v[axis];
    const p1v = getAxis(p1);
    const p2v = getAxis(p2);

    if ((p1v < min && p2v < min) || (p1v > max && p2v > max)) {
      return false;
    }

    if (p1v >= min && p1v <= max) {
      return lineInBoxOnPlanes(p1, p2, boxPos, boxW, boxL, boxH, axis);
    }

    const t = p1v < min ? (min - p1v) / (p2v - p1v) : (max - p1v) / (p2v - p1v);
    if (t < 0 || t > 1) return false;

    const intersection = lerp(p1, p2, t);
    return pointInBox(intersection, boxPos, boxW, boxL, boxH);
  };

  return (
    checkFace('x', minX, maxX) ||
    checkFace('y', minY, maxY) ||
    checkFace('z', minZ, maxZ)
  );
};

const lineInBoxOnPlanes = (
  p1: Vector3D,
  p2: Vector3D,
  boxPos: Vector3D,
  boxW: number,
  boxL: number,
  boxH: number,
  excludeAxis: 'x' | 'y' | 'z'
): boolean => {
  const minX = boxPos.x - boxW / 2;
  const maxX = boxPos.x + boxW / 2;
  const minY = boxPos.y - boxH / 2;
  const maxY = boxPos.y + boxH / 2;
  const minZ = boxPos.z - boxL / 2;
  const maxZ = boxPos.z + boxL / 2;

  const xMin = Math.min(p1.x, p2.x);
  const xMax = Math.max(p1.x, p2.x);
  const yMin = Math.min(p1.y, p2.y);
  const yMax = Math.max(p1.y, p2.y);
  const zMin = Math.min(p1.z, p2.z);
  const zMax = Math.max(p1.z, p2.z);

  const xOverlap = xMax >= minX && xMin <= maxX;
  const yOverlap = yMax >= minY && yMin <= maxY;
  const zOverlap = zMax >= minZ && zMin <= maxZ;

  if (excludeAxis === 'x') return yOverlap && zOverlap;
  if (excludeAxis === 'y') return xOverlap && zOverlap;
  return xOverlap && yOverlap;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(2)} m`;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};
