import type { Point3D, PathNode } from '../types';

export const distance3D = (a: Point3D, b: Point3D): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const calculateTotalLength = (nodes: PathNode[]): number => {
  if (nodes.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < nodes.length; i++) {
    total += distance3D(nodes[i - 1].position, nodes[i].position);
  }
  return total;
};

export const calculateVerticalHeight = (nodes: PathNode[]): number => {
  if (nodes.length < 2) return 0;
  const startY = nodes[0].position.y;
  const endY = nodes[nodes.length - 1].position.y;
  return Math.abs(endY - startY);
};

export const calculateAngle = (
  prev: Point3D,
  curr: Point3D,
  next: Point3D
): number => {
  const v1 = {
    x: prev.x - curr.x,
    y: prev.y - curr.y,
    z: prev.z - curr.z,
  };
  const v2 = {
    x: next.x - curr.x,
    y: next.y - curr.y,
    z: next.z - curr.z,
  };

  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (len1 === 0 || len2 === 0) return 0;

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const cos = dot / (len1 * len2);

  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
};

export const countCorners = (nodes: PathNode[], threshold: number = 30): number => {
  if (nodes.length < 3) return 0;
  let count = 0;
  for (let i = 1; i < nodes.length - 1; i++) {
    const angle = calculateAngle(
      nodes[i - 1].position,
      nodes[i].position,
      nodes[i + 1].position
    );
    if (angle > threshold && angle < 170) {
      count++;
      nodes[i].type = 'corner';
    }
  }
  return count;
};

export const countStairs = (nodes: PathNode[]): number => {
  return nodes.filter((n) => n.type === 'stairs').length;
};

export const getNodeType = (
  index: number,
  total: number,
  isStair: boolean = false
): PathNode['type'] => {
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  if (isStair) return 'stairs';
  return 'corner';
};

export const snapToGrid = (
  point: Point3D,
  gridSize: number = 1
): Point3D => ({
  x: Math.round(point.x / gridSize) * gridSize,
  y: point.y,
  z: Math.round(point.z / gridSize) * gridSize,
});

export const findNearestHydrant = (
  point: Point3D,
  hydrants: { position: Point3D }[],
  maxDistance: number = 3
): { position: Point3D; index: number } | null => {
  let nearest: { position: Point3D; index: number } | null = null;
  let minDist = maxDistance;

  hydrants.forEach((h, i) => {
    const dist = distance3D(point, h.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = { position: h.position, index: i };
    }
  });

  return nearest;
};
