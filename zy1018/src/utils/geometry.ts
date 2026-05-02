import type { Vector3D, BoundingBox } from '../models/types';

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function floorToGrid(value: number, gridSize: number): number {
  return Math.floor(value / gridSize) * gridSize;
}

export function getObjectBoundingBox(
  position: Vector3D,
  dimensions: Vector3D,
  rotation: number
): BoundingBox {
  const halfX = dimensions.x / 2;
  const halfZ = dimensions.z / 2;
  
  const corners = [
    { x: -halfX, z: -halfZ },
    { x: halfX, z: -halfZ },
    { x: halfX, z: halfZ },
    { x: -halfX, z: halfZ },
  ];
  
  const rad = degToRad(rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  
  const rotatedCorners = corners.map(c => ({
    x: c.x * cos - c.z * sin,
    z: c.x * sin + c.z * cos,
  }));
  
  const worldCorners = rotatedCorners.map(c => ({
    x: c.x + position.x,
    z: c.z + position.z,
  }));
  
  const xs = worldCorners.map(c => c.x);
  const zs = worldCorners.map(c => c.z);
  
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

export function boxesOverlap2D(box1: BoundingBox, box2: BoundingBox): boolean {
  if (box1.maxX <= box2.minX) return false;
  if (box1.minX >= box2.maxX) return false;
  if (box1.maxZ <= box2.minZ) return false;
  if (box1.minZ >= box2.maxZ) return false;
  return true;
}

export function getBoxCenter(box: BoundingBox): { x: number; z: number } {
  return {
    x: (box.minX + box.maxX) / 2,
    z: (box.minZ + box.maxZ) / 2,
  };
}

export function distance2D(p1: { x: number; z: number }, p2: { x: number; z: number }): number {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function boxContainsPoint(box: BoundingBox, point: { x: number; z: number }): boolean {
  return (
    point.x >= box.minX &&
    point.x <= box.maxX &&
    point.z >= box.minZ &&
    point.z <= box.maxZ
  );
}

export function normalizeAngle(degrees: number): number {
  let angle = degrees % 360;
  if (angle < 0) angle += 360;
  return angle;
}

export function snapAngleTo90(degrees: number): number {
  const normalized = normalizeAngle(degrees);
  const snapped = Math.round(normalized / 90) * 90;
  return snapped % 360;
}
