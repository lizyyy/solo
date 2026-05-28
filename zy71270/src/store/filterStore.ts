import { create } from 'zustand';
import type { FilterState } from '../types';

const now = Date.now();

interface FilterStore extends FilterState {
  setTimeRange: (range: { start: number; end: number }) => void;
  setSelectedWaveId: (waveId: string | null) => void;
  setSelectedRobotIds: (robotIds: string[]) => void;
  addSelectedRobotId: (robotId: string) => void;
  removeSelectedRobotId: (robotId: string) => void;
  toggleRobotId: (robotId: string) => void;
  setSelectedFloor: (floor: number | null) => void;
  setSelectedZone: (zone: string | null) => void;
  setShowPaths: (show: boolean) => void;
  toggleShowPaths: () => void;
  setShowHeatmap: (show: boolean) => void;
  toggleShowHeatmap: () => void;
  setShowQueue: (show: boolean) => void;
  toggleShowQueue: () => void;
  setDensityThreshold: (threshold: number) => void;
  resetFilters: () => void;
}

const getInitialState = (): FilterState => ({
  timeRange: {
    start: now - 8 * 3600000,
    end: now,
  },
  selectedWaveId: null,
  selectedRobotIds: [],
  selectedFloor: null,
  selectedZone: null,
  showPaths: true,
  showHeatmap: true,
  showQueue: true,
  densityThreshold: 0.3,
});

export const useFilterStore = create<FilterStore>((set) => ({
  ...getInitialState(),

  setTimeRange: (range) => set({ timeRange: range }),

  setSelectedWaveId: (waveId) => set({ selectedWaveId: waveId }),

  setSelectedRobotIds: (robotIds) => set({ selectedRobotIds: robotIds }),

  addSelectedRobotId: (robotId) =>
    set((state) => ({
      selectedRobotIds: state.selectedRobotIds.includes(robotId)
        ? state.selectedRobotIds
        : [...state.selectedRobotIds, robotId],
    })),

  removeSelectedRobotId: (robotId) =>
    set((state) => ({
      selectedRobotIds: state.selectedRobotIds.filter((id) => id !== robotId),
    })),

  toggleRobotId: (robotId) =>
    set((state) => ({
      selectedRobotIds: state.selectedRobotIds.includes(robotId)
        ? state.selectedRobotIds.filter((id) => id !== robotId)
        : [...state.selectedRobotIds, robotId],
    })),

  setSelectedFloor: (floor) => set({ selectedFloor: floor }),

  setSelectedZone: (zone) => set({ selectedZone: zone }),

  setShowPaths: (show) => set({ showPaths: show }),

  toggleShowPaths: () => set((state) => ({ showPaths: !state.showPaths })),

  setShowHeatmap: (show) => set({ showHeatmap: show }),

  toggleShowHeatmap: () => set((state) => ({ showHeatmap: !state.showHeatmap })),

  setShowQueue: (show) => set({ showQueue: show }),

  toggleShowQueue: () => set((state) => ({ showQueue: !state.showQueue })),

  setDensityThreshold: (threshold) => set({ densityThreshold: threshold }),

  resetFilters: () => set(getInitialState()),
}));
