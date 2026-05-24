import type { PathPoint, PickingOrder } from '../data/types';

export function simplifyPath(points: PathPoint[], tolerance: number = 0.5): PathPoint[] {
  if (points.length <= 2) return points;

  const result: PathPoint[] = [points[0]];
  let lastKept = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[lastKept],
      points[i + 1]
    );

    if (distance > tolerance) {
      result.push(points[i]);
      lastKept = i;
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

function perpendicularDistance(
  point: PathPoint,
  lineStart: PathPoint,
  lineEnd: PathPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dz = lineEnd.z - lineStart.z;
  const len = Math.sqrt(dx * dx + dz * dz);

  if (len === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.z - lineStart.z, 2)
    );
  }

  const t =
    ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / (len * len);

  const projX = lineStart.x + t * dx;
  const projZ = lineStart.z + t * dz;

  return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.z - projZ, 2));
}

export function getPathPointsAtTime(
  order: PickingOrder,
  currentTime: number
): PathPoint[] {
  return order.path.filter((p) => p.timestamp <= currentTime);
}

export function interpolatePathPosition(
  order: PickingOrder,
  currentTime: number
): { x: number; y: number; z: number } | null {
  const { path } = order;
  if (path.length === 0) return null;
  if (currentTime < path[0].timestamp) return null;
  if (currentTime >= path[path.length - 1].timestamp) {
    return path[path.length - 1];
  }

  for (let i = 0; i < path.length - 1; i++) {
    if (currentTime >= path[i].timestamp && currentTime < path[i + 1].timestamp) {
      const t =
        (currentTime - path[i].timestamp) /
        (path[i + 1].timestamp - path[i].timestamp);
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * t,
        y: path[i].y + (path[i + 1].y - path[i].y) * t,
        z: path[i].z + (path[i + 1].z - path[i].z) * t,
      };
    }
  }

  return null;
}

export function calculateTotalDistance(orders: PickingOrder[]): number {
  let total = 0;
  for (const order of orders) {
    for (let i = 1; i < order.path.length; i++) {
      const dx = order.path[i].x - order.path[i - 1].x;
      const dz = order.path[i].z - order.path[i - 1].z;
      total += Math.sqrt(dx * dx + dz * dz);
    }
  }
  return total;
}

export function calculateAvgSpeed(orders: PickingOrder[]): number {
  let totalSpeed = 0;
  let count = 0;

  for (const order of orders) {
    for (const point of order.path) {
      totalSpeed += point.speed;
      count++;
    }
  }

  return count > 0 ? totalSpeed / count : 0;
}
