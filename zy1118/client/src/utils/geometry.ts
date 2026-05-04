import type { Position, Size } from '../types';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBoothRect(position: Position, size: Size): Rectangle {
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.depth
  };
}

export function doRectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

export function expandRect(rect: Rectangle, amount: number): Rectangle {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2
  };
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPositionToGrid(
  position: Position,
  gridSize: number,
  size: Size,
  hallSize: Size
): Position {
  const maxX = hallSize.width - size.width;
  const maxY = hallSize.depth - size.depth;

  let x = snapToGrid(position.x, gridSize);
  let y = snapToGrid(position.y, gridSize);

  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));

  return { x, y, z: position.z };
}

export function getCenter(position: Position, size: Size): Position {
  return {
    x: position.x + size.width / 2,
    y: position.y + size.depth / 2,
    z: (position.z || 0) + (size.height || 0) / 2
  };
}

export function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const boothColors: Record<string, string> = {
  standard: '#60a5fa',
  corner: '#818cf8',
  island: '#a78bfa',
  double: '#f472b6',
  premium: '#fb923c',
  stage: '#fbbf24',
  info_desk: '#34d399',
  food: '#f87171',
  sponsor: '#38bdf8',
  other: '#94a3b8'
};

export const boothTypeLabels: Record<string, string> = {
  standard: '标准展位',
  corner: '转角展位',
  island: '岛型展位',
  double: '双开展位',
  premium: '豪华展位',
  stage: '舞台',
  info_desk: '服务台',
  food: '餐饮区',
  sponsor: '赞助商展位',
  other: '其他'
};

export const riskLevelColors: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d'
};

export const riskLevelLabels: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
};

export const categoryLabels: Record<string, string> = {
  safety: '安全',
  flow: '人流',
  power: '用电',
  layout: '布局',
  compliance: '合规'
};
