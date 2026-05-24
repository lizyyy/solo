import { create } from 'zustand';
import { AppStore, IceData } from '../types';

const initialState = {
  data: null,
  currentTimeIndex: 0,
  isPlaying: false,
  playSpeed: 1,
  selectedGridIds: [],
  selectionBox: null,
  isSelecting: false,
  viewMode: 'thickness' as const,
  showHeatmap: true,
  showGrid: true,
  showProbes: true,
  showRepairAreas: true,
  showThreshold: true,
  hoveredPoint: null,
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  loadData: (data: IceData) => set({ data, currentTimeIndex: 0 }),

  setCurrentTimeIndex: (index: number) => {
    const { data } = get();
    if (data && index >= 0 && index < data.snapshots.length) {
      set({ currentTimeIndex: index });
    }
  },

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setPlaySpeed: (speed: number) => set({ playSpeed: speed }),

  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setSelectedGridIds: (ids: string[]) => set({ selectedGridIds: ids }),

  setSelectionBox: (box) => set({ selectionBox: box }),

  setIsSelecting: (selecting) => set({ isSelecting: selecting }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleProbes: () => set((state) => ({ showProbes: !state.showProbes })),
  toggleRepairAreas: () => set((state) => ({ showRepairAreas: !state.showRepairAreas })),
  toggleThreshold: () => set((state) => ({ showThreshold: !state.showThreshold })),

  setHoveredPoint: (id) => set({ hoveredPoint: id }),

  resetState: () => set({ ...initialState, data: get().data }),

  nextTimeStep: () => {
    const { data, currentTimeIndex } = get();
    if (data && currentTimeIndex < data.snapshots.length - 1) {
      set({ currentTimeIndex: currentTimeIndex + 1 });
    } else if (data) {
      set({ currentTimeIndex: 0, isPlaying: false });
    }
  },

  prevTimeStep: () => {
    const { data, currentTimeIndex } = get();
    if (data && currentTimeIndex > 0) {
      set({ currentTimeIndex: currentTimeIndex - 1 });
    }
  },
}));
