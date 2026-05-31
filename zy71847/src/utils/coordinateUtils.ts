import { Point, CableRecord } from '@/types';

export function flipCoordinateY(point: Point): Point {
  return {
    x: point.x,
    y: -point.y,
  };
}

export function flipCoordinateX(point: Point): Point {
  return {
    x: -point.x,
    y: point.y,
  };
}

export function flipBothCoordinates(point: Point): Point {
  return {
    x: -point.x,
    y: -point.y,
  };
}

export function isPointFlipped(p1: Point, p2: Point, axis: 'x' | 'y' | 'both' = 'both'): boolean {
  if (axis === 'x') return p1.x === -p2.x && p1.y === p2.y;
  if (axis === 'y') return p1.y === -p2.y && p1.x === p2.x;
  return p1.x === -p2.x && p1.y === -p2.y;
}

export function isRecordFlipped(r1: CableRecord, r2: CableRecord): boolean {
  return (
    isPointFlipped(r1.startPoint, r2.startPoint) &&
    isPointFlipped(r1.endPoint, r2.endPoint)
  );
}

export function formatCoordinate(point: Point): string {
  return `(${point.x}, ${point.y})`;
}

export function generatePathD(start: Point, end: Point): string {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2 + 10;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}
