import { create } from 'zustand';
import type { FilterRange, Point3D } from '../types/surface';

interface FilterStore {
  filterRange: FilterRange;
  screenViewport: { width: number; height: number };
  locked: boolean;

  setFilterRange: (range: Partial<FilterRange>) => void;
  setScreenViewport: (width: number, height: number) => void;
  setLocked: (locked: boolean) => void;
  isPointInRange: (point: Point3D) => boolean;
  getEffectiveRange: (allPoints: Point3D[]) => Required<FilterRange>;
  resetFilter: () => void;
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  filterRange: {},
  screenViewport: { width: 800, height: 600 },
  locked: false,

  setFilterRange: (range) => {
    if (get().locked) return;
    set((state) => ({
      filterRange: { ...state.filterRange, ...range },
    }));
  },

  setScreenViewport: (width, height) =>
    set({ screenViewport: { width, height } }),

  setLocked: (locked) => set({ locked }),

  isPointInRange: (point) => {
    const { filterRange } = get();
    const { x, y, z } = point;

    if (filterRange.x && (x < filterRange.x[0] || x > filterRange.x[1])) return false;
    if (filterRange.y && (y < filterRange.y[0] || y > filterRange.y[1])) return false;
    if (filterRange.z && (z < filterRange.z[0] || z > filterRange.z[1])) return false;

    return true;
  },

  getEffectiveRange: (allPoints) => {
    const { filterRange } = get();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    allPoints.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });

    return {
      x: filterRange.x || [minX, maxX],
      y: filterRange.y || [minY, maxY],
      z: filterRange.z || [minZ, maxZ],
    };
  },

  resetFilter: () => {
    if (get().locked) return;
    set({ filterRange: {} });
  },
}));
