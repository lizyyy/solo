import type { TrajectoryPoint } from '../types';
import { densityToColor } from './colors';
import type { RGB } from './colors';

export interface DensityCell {
  gridX: number;
  gridY: number;
  floor: number;
  count: number;
  density: number;
  color: RGB;
}

export interface DensityGrid {
  cellSize: number;
  cells: DensityCell[];
  maxCount: number;
}

const GRID_CELL_SIZE = 0.5;

export function calculatePathDensity(points: TrajectoryPoint[]): DensityGrid {
  const counter = new Map<string, { gridX: number; gridY: number; floor: number; count: number }>();

  for (const point of points) {
    if (point.isBreakpoint) continue;
    const gridX = Math.floor(point.position.x / GRID_CELL_SIZE);
    const gridY = Math.floor(point.position.y / GRID_CELL_SIZE);
    const key = `${gridX},${gridY},${point.floor}`;

    const existing = counter.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counter.set(key, { gridX, gridY, floor: point.floor, count: 1 });
    }
  }

  let maxCount = 0;
  for (const entry of counter.values()) {
    if (entry.count > maxCount) maxCount = entry.count;
  }

  const cells: DensityCell[] = [];
  for (const entry of counter.values()) {
    const density = maxCount > 0 ? entry.count / maxCount : 0;
    cells.push({
      gridX: entry.gridX,
      gridY: entry.gridY,
      floor: entry.floor,
      count: entry.count,
      density,
      color: densityToColor(density),
    });
  }

  return { cellSize: GRID_CELL_SIZE, cells, maxCount };
}

export function getDensityColor(density: number): RGB {
  return densityToColor(density);
}

export function filterByThreshold(grid: DensityGrid, threshold: number): DensityGrid {
  const filtered = grid.cells.filter(cell => cell.density >= threshold);
  return {
    cellSize: grid.cellSize,
    cells: filtered,
    maxCount: grid.maxCount,
  };
}
