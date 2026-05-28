import type { Shelf, TrajectoryPoint } from '../types';
import { congestionToColor } from './colors';
import type { RGB } from './colors';

export interface ShelfHeatmapItem {
  shelfId: string;
  position: { x: number; y: number; z: number };
  congestion: number;
  color: RGB;
  nearbyPointCount: number;
}

export interface HeatmapVoxel {
  x: number;
  y: number;
  z: number;
  size: number;
  congestion: number;
  color: RGB;
}

export function calculateShelfHeatmap(
  shelves: Shelf[],
  points: TrajectoryPoint[],
  radius: number = 3
): ShelfHeatmapItem[] {
  const FLOOR_HEIGHT = 4;

  return shelves.map(shelf => {
    const shelfFloor = parseInt(shelf.floorId.replace('floor-', ''), 10);
    const nearbyCount = points.filter(p => {
      if (p.isBreakpoint) return false;
      if (p.floor !== shelfFloor) return false;
      const dx = p.position.x - shelf.position.x;
      const dy = p.position.y - shelf.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    }).length;

    const rawCongestion = shelf.congestionLevel ?? 0;
    const congestion = Math.min(1, rawCongestion / 4);

    return {
      shelfId: shelf.id,
      position: {
        x: shelf.position.x,
        y: shelf.position.y,
        z: (shelfFloor - 1) * FLOOR_HEIGHT,
      },
      congestion,
      color: congestionToColor(congestion),
      nearbyPointCount: nearbyCount,
    };
  });
}

export function generateHeatmapVoxels(
  heatmapItems: ShelfHeatmapItem[],
  voxelSize: number = 1
): HeatmapVoxel[] {
  const voxels: HeatmapVoxel[] = [];

  for (const item of heatmapItems) {
    voxels.push({
      x: item.position.x,
      y: item.position.y,
      z: item.position.z,
      size: voxelSize,
      congestion: item.congestion,
      color: item.color,
    });
  }

  return voxels;
}

export function getHeatmapColor(congestion: number): RGB {
  return congestionToColor(congestion);
}
