import { Boundary, BoundaryVertex, Point3D } from '@/types';

export function pointInPolygon(point: { x: number; z: number }, vertices: BoundaryVertex[]): boolean {
  let inside = false;
  const n = vertices.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, zi = vertices[i].z;
    const xj = vertices[j].x, zj = vertices[j].z;

    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export function calculatePolygonArea(vertices: BoundaryVertex[]): number {
  let area = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].z;
    area -= vertices[j].x * vertices[i].z;
  }

  return Math.abs(area) / 2;
}

export function calculateCentroid(vertices: BoundaryVertex[]): { x: number; z: number } {
  let cx = 0, cz = 0;
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = vertices[i].x * vertices[j].z - vertices[j].x * vertices[i].z;
    cx += (vertices[i].x + vertices[j].x) * cross;
    cz += (vertices[i].z + vertices[j].z) * cross;
  }

  const area = calculatePolygonArea(vertices);
  const factor = 1 / (6 * area);

  return { x: cx * factor, z: cz * factor };
}

export interface VolumeResult {
  volume: number;
  surfaceArea: number;
  pointCount: number;
  avgHeight: number;
  maxHeight: number;
}

export function calculateVolumeForBoundary(
  boundary: Boundary,
  points: Point3D[],
  gridSize: number = 0.5
): VolumeResult {
  const { vertices, baseHeight } = boundary;

  const minX = Math.min(...vertices.map(v => v.x));
  const maxX = Math.max(...vertices.map(v => v.x));
  const minZ = Math.min(...vertices.map(v => v.z));
  const maxZ = Math.max(...vertices.map(v => v.z));

  const gridMap = new Map<string, number[]>();

  points.forEach(point => {
    if (point.y < baseHeight) return;
    if (point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ) return;
    if (!pointInPolygon({ x: point.x, z: point.z }, vertices)) return;

    const gridX = Math.floor((point.x - minX) / gridSize);
    const gridZ = Math.floor((point.z - minZ) / gridSize);
    const key = `${gridX},${gridZ}`;

    if (!gridMap.has(key)) {
      gridMap.set(key, []);
    }
    gridMap.get(key)!.push(point.y);
  });

  let volume = 0;
  let maxHeight = baseHeight;
  let totalHeight = 0;
  let validGrids = 0;

  gridMap.forEach(heights => {
    if (heights.length === 0) return;

    const avgHeightInGrid = heights.reduce((a, b) => a + b, 0) / heights.length;
    const heightAboveBase = Math.max(0, avgHeightInGrid - baseHeight);

    volume += heightAboveBase * gridSize * gridSize;

    const gridMax = Math.max(...heights);
    if (gridMax > maxHeight) maxHeight = gridMax;

    totalHeight += avgHeightInGrid;
    validGrids++;
  });

  const polygonArea = calculatePolygonArea(vertices);

  return {
    volume: Math.round(volume * 100) / 100,
    surfaceArea: Math.round(polygonArea * 100) / 100,
    pointCount: points.filter(p =>
      p.x >= minX && p.x <= maxX &&
      p.z >= minZ && p.z <= maxZ &&
      pointInPolygon({ x: p.x, z: p.z }, vertices)
    ).length,
    avgHeight: validGrids > 0 ? Math.round((totalHeight / validGrids - baseHeight) * 100) / 100 : 0,
    maxHeight: Math.round((maxHeight - baseHeight) * 100) / 100,
  };
}

export function calculateWeight(volume: number, density: number): number {
  return Math.round(volume * density * 100) / 100;
}

export function formatVolume(volume: number): string {
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + ' 万m³';
  }
  return volume.toFixed(2) + ' m³';
}

export function formatWeight(weight: number): string {
  if (weight >= 10000) {
    return (weight / 10000).toFixed(2) + ' 万吨';
  }
  return weight.toFixed(2) + ' 吨';
}
