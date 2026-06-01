import type { Position } from '../types';
import { BRIDGE_DIMENSIONS } from '../types';

export function toThreePosition(pos: Position): [number, number, number] {
  return [pos.x, pos.y, pos.z];
}

export function fromThreePosition(arr: [number, number, number]): Position {
  return { x: arr[0], y: arr[1], z: arr[2] };
}

export function formatPosition(pos: Position): string {
  return `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;
}

export function getFloorFromY(y: number): string {
  const { floorHeights } = BRIDGE_DIMENSIONS;
  for (let i = floorHeights.length - 1; i >= 0; i--) {
    if (y >= floorHeights[i]) {
      return `${i + 1}层`;
    }
  }
  return '1层';
}

export function isNearBoundary(pos: Position, tolerance: number = 0.5): boolean {
  const { length, width } = BRIDGE_DIMENSIONS;
  const halfLength = length / 2;
  const halfWidth = width / 2;
  
  return (
    Math.abs(pos.x + halfLength) < tolerance ||
    Math.abs(pos.x - halfLength) < tolerance ||
    Math.abs(pos.z + halfWidth) < tolerance ||
    Math.abs(pos.z - halfWidth) < tolerance
  );
}
