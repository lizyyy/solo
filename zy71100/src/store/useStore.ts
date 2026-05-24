import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vector3Tuple, TimeRange } from '../data/types';
import { defaultTimeRange, viewModes } from '../data/mockData';

interface AppState {
  warehouseLoaded: boolean;
  selectedOrders: string[];
  timeRange: TimeRange;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  cameraPosition: Vector3Tuple;
  cameraTarget: Vector3Tuple;
  viewMode: 'perspective' | 'top' | 'front' | 'side';
  showHeatmap: boolean;
  showPaths: boolean;
  showShelves: boolean;
  heatmapIntensity: number;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  setTimeRange: (start: number, end: number) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  selectOrder: (id: string, multi?: boolean) => void;
  selectAllOrders: () => void;
  clearSelection: () => void;
  setViewMode: (mode: 'perspective' | 'top' | 'front' | 'side') => void;
  setCameraPosition: (pos: Vector3Tuple, target: Vector3Tuple) => void;
  toggleHeatmap: () => void;
  togglePaths: () => void;
  toggleShelves: () => void;
  setHeatmapIntensity: (intensity: number) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setWarehouseLoaded: (loaded: boolean) => void;
  resetState: () => void;
}

const initialState = {
  warehouseLoaded: false,
  selectedOrders: [],
  timeRange: defaultTimeRange,
  currentTime: defaultTimeRange.start,
  isPlaying: false,
  playbackSpeed: 1,
  cameraPosition: viewModes.perspective.position,
  cameraTarget: viewModes.perspective.target,
  viewMode: 'perspective' as const,
  showHeatmap: true,
  showPaths: true,
  showShelves: true,
  heatmapIntensity: 0.7,
  leftPanelOpen: true,
  rightPanelOpen: true,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,

      setTimeRange: (start, end) => set({ timeRange: { start, end } }),
      setCurrentTime: (time) =>
        set((state) => ({
          currentTime: typeof time === 'function' ? time(state.currentTime) : time,
        })),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

      selectOrder: (id, multi = false) =>
        set((state) => {
          if (multi) {
            const exists = state.selectedOrders.includes(id);
            return {
              selectedOrders: exists
                ? state.selectedOrders.filter((o) => o !== id)
                : [...state.selectedOrders, id],
            };
          }
          return { selectedOrders: [id] };
        }),

      selectAllOrders: () => set({ selectedOrders: [] }),
      clearSelection: () => set({ selectedOrders: [] }),

      setViewMode: (mode) =>
        set({
          viewMode: mode,
          cameraPosition: viewModes[mode].position,
          cameraTarget: viewModes[mode].target,
        }),

      setCameraPosition: (pos, target) =>
        set({ cameraPosition: pos, cameraTarget: target }),

      toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),
      togglePaths: () => set((state) => ({ showPaths: !state.showPaths })),
      toggleShelves: () => set((state) => ({ showShelves: !state.showShelves })),
      setHeatmapIntensity: (intensity) => set({ heatmapIntensity: intensity }),

      toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

      setWarehouseLoaded: (loaded) => set({ warehouseLoaded: loaded }),

      resetState: () => set(initialState),
    }),
    {
      name: 'warehouse-heatmap-storage',
      partialize: (state) => ({
        selectedOrders: state.selectedOrders,
        timeRange: state.timeRange,
        viewMode: state.viewMode,
        showHeatmap: state.showHeatmap,
        showPaths: state.showPaths,
        showShelves: state.showShelves,
        heatmapIntensity: state.heatmapIntensity,
        playbackSpeed: state.playbackSpeed,
        leftPanelOpen: state.leftPanelOpen,
        rightPanelOpen: state.rightPanelOpen,
      }),
    }
  )
);
