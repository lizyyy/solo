import type { Position } from '@/types/game';

export const distance = (a: Position, b: Position): number => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};

export const manhattanDistance = (a: Position, b: Position): number => {
  return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
};

export const chebyshevDistance = (a: Position, b: Position): number => {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
};

export const angle = (from: Position, to: Position): number => {
  return Math.atan2(to.y - from.y, to.x - from.x);
};

export const angleToDirection = (angleRad: number): number => {
  const degrees = (angleRad * 180) / Math.PI;
  const normalized = ((degrees + 360) % 360) / 45;
  return Math.round(normalized) % 8;
};

export const directionToVector = (direction: number): Position => {
  const vectors: Position[] = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ];
  return vectors[((direction % 8) + 8) % 8];
};

export const isInFanShape = (
  center: Position,
  point: Position,
  direction: number,
  angleWidth: number,
  maxRange: number
): boolean => {
  const dist = distance(center, point);
  if (dist > maxRange) return false;

  const pointAngle = angle(center, point);
  const directionAngle = (direction * Math.PI) / 4;
  
  let angleDiff = pointAngle - directionAngle;
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  return Math.abs(angleDiff) <= angleWidth / 2;
};

export const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const positionsEqual = (a: Position | null, b: Position | null): boolean => {
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
};

export const positionToString = (pos: Position): string => {
  return `(${pos.x}, ${pos.y})`;
};

export const getBearingText = (from: Position, to: Position): string => {
  const ang = angle(from, to);
  const degrees = ((ang * 180) / Math.PI + 360) % 360;
  
  const bearings = [
    '正北', '东北', '正东', '东南',
    '正南', '西南', '正西', '西北'
  ];
  const index = Math.round(degrees / 45) % 8;
  const dist = distance(from, to).toFixed(1);
  
  return `${bearings[index]} ${dist}海里`;
};
