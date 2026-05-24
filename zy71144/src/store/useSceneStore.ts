import { create } from 'zustand';
import type { ViewMode, SceneSettings, BuildingModel } from '../types';

interface SceneState {
  viewMode: ViewMode;
  settings: SceneSettings;
  currentBuilding: BuildingModel | null;
  buildings: BuildingModel[];
  isDragging: boolean;
  hoveredPosition: { x: number; z: number } | null;

  setViewMode: (mode: ViewMode) => void;
  setSettings: (settings: Partial<SceneSettings>) => void;
  setCurrentBuilding: (building: BuildingModel | null) => void;
  setBuildings: (buildings: BuildingModel[]) => void;
  setIsDragging: (dragging: boolean) => void;
  setHoveredPosition: (position: { x: number; z: number } | null) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  viewMode: 'free',
  settings: {
    showWalls: true,
    showHydrants: true,
    showStairs: true,
    showGrid: true,
  },
  currentBuilding: null,
  buildings: [],
  isDragging: false,
  hoveredPosition: null,

  setViewMode: (mode) => set({ viewMode: mode }),

  setSettings: (settings) =>
    set((state) => ({ settings: { ...state.settings, ...settings } })),

  setCurrentBuilding: (building) => set({ currentBuilding: building }),

  setBuildings: (buildings) => set({ buildings }),

  setIsDragging: (dragging) => set({ isDragging: dragging }),

  setHoveredPosition: (position) => set({ hoveredPosition: position }),
}));
