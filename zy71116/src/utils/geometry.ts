import { Vector3 } from '../types';

export const distance = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const horizontalDistance = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const calculateSlope = (a: Vector3, b: Vector3): number => {
  const horizDist = horizontalDistance(a, b);
  if (horizDist === 0) return 0;
  const heightDiff = Math.abs(b.y - a.y);
  return (heightDiff / horizDist) * 100;
};

export const lerp = (a: Vector3, b: Vector3, t: number): Vector3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

export const getPointOnPath = (path: Vector3[], progress: number): Vector3 => {
  if (path.length < 2) return path[0] || { x: 0, y: 0, z: 0 };
  
  const totalLength = path.reduce((sum, point, i) => 
    i === 0 ? 0 : sum + distance(path[i - 1], point), 0);
  
  const targetDistance = totalLength * Math.max(0, Math.min(1, progress));
  
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const segmentLength = distance(path[i - 1], path[i]);
    if (accumulated + segmentLength >= targetDistance) {
      const segmentProgress = (targetDistance - accumulated) / segmentLength;
      return lerp(path[i - 1], path[i], segmentProgress);
    }
    accumulated += segmentLength;
  }
  
  return path[path.length - 1];
};

export const boxContainsPoint = (
  boxPosition: Vector3,
  boxSize: Vector3,
  point: Vector3
): boolean => {
  const halfSize = {
    x: boxSize.x / 2,
    y: boxSize.y / 2,
    z: boxSize.z / 2,
  };
  
  return (
    point.x >= boxPosition.x - halfSize.x &&
    point.x <= boxPosition.x + halfSize.x &&
    point.y >= boxPosition.y - halfSize.y &&
    point.y <= boxPosition.y + halfSize.y &&
    point.z >= boxPosition.z - halfSize.z &&
    point.z <= boxPosition.z + halfSize.z
  );
};

export const lineIntersectsBox = (
  start: Vector3,
  end: Vector3,
  boxPosition: Vector3,
  boxSize: Vector3
): boolean => {
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = lerp(start, end, t);
    if (boxContainsPoint(boxPosition, boxSize, point)) {
      return true;
    }
  }
  return false;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};
