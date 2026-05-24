import { create } from 'zustand';
import { AppState, Building, WindowUnit, ShadowRecord, Vector3Tuple } from '../types';
import { SAMPLE_BUILDINGS, SAMPLE_WINDOWS, COMPLAINT_WINDOWS } from '../data/sampleComplex';
import { calculateDailyShadowRecords } from '../utils/shadowDetection';

const DEFAULT_DATE = new Date('2024-12-22');
const DEFAULT_TIME = 9 * 60;

export const useAppStore = create<AppState>((set, get) => ({
  buildings: [],
  windows: [],
  currentDate: DEFAULT_DATE,
  currentTime: DEFAULT_TIME,
  isPlaying: false,
  playSpeed: 1,
  selectedWindows: [],
  selectedBuildings: [],
  highlightedBuilding: null,
  shadowRecords: [],
  cameraPosition: [60, 50, 60],
  cameraTarget: [0, 15, 0],
  isDataLoaded: false,
  leftPanelOpen: true,
  rightPanelOpen: true,

  setDate: (date: Date) => {
    set({ currentDate: date });
    const { isDataLoaded, buildings, windows, selectedWindows } = get();
    if (isDataLoaded && selectedWindows.length > 0) {
      const selectedWindowUnits = windows.filter(w => selectedWindows.includes(w.id));
      const allRecords: ShadowRecord[] = [];
      selectedWindowUnits.forEach(window => {
        const records = calculateDailyShadowRecords(window, buildings, date);
        allRecords.push(...records);
      });
      set({ shadowRecords: allRecords });
    }
  },

  setTime: (time: number) => set({ currentTime: Math.max(0, Math.min(1440, time)) }),

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setPlaySpeed: (speed: number) => set({ playSpeed: Math.max(0.5, Math.min(10, speed)) }),

  selectWindow: (id: string, multiSelect = false) => {
    set(state => {
      let newSelected: string[];
      if (multiSelect) {
        newSelected = state.selectedWindows.includes(id)
          ? state.selectedWindows.filter(w => w !== id)
          : [...state.selectedWindows, id];
      } else {
        newSelected = state.selectedWindows.includes(id) && state.selectedWindows.length === 1
          ? []
          : [id];
      }

      if (newSelected.length > 0) {
        const { buildings, windows, currentDate } = get();
        const selectedWindowUnits = windows.filter(w => newSelected.includes(w.id));
        const allRecords: ShadowRecord[] = [];
        selectedWindowUnits.forEach(window => {
          const records = calculateDailyShadowRecords(window, buildings, currentDate);
          allRecords.push(...records);
        });
        return { selectedWindows: newSelected, shadowRecords: allRecords };
      }

      return { selectedWindows: newSelected, shadowRecords: [] };
    });
  },

  deselectWindow: (id: string) => {
    set(state => ({
      selectedWindows: state.selectedWindows.filter(w => w !== id),
    }));
  },

  clearSelectedWindows: () => {
    set({ selectedWindows: [], shadowRecords: [] });
  },

  highlightBuilding: (id: string | null) => set({ highlightedBuilding: id }),

  setCameraPosition: (position: Vector3Tuple, target: Vector3Tuple) => {
    set({ cameraPosition: position, cameraTarget: target });
  },

  loadSampleData: () => {
    const buildings: Building[] = SAMPLE_BUILDINGS;
    const windows: WindowUnit[] = SAMPLE_WINDOWS;
    const selectedWindows = COMPLAINT_WINDOWS;
    
    const currentDate = get().currentDate;
    const selectedWindowUnits = windows.filter(w => selectedWindows.includes(w.id));
    const allRecords: ShadowRecord[] = [];
    
    selectedWindowUnits.forEach(window => {
      const records = calculateDailyShadowRecords(window, buildings, currentDate);
      allRecords.push(...records);
    });

    set({
      buildings,
      windows,
      selectedWindows,
      shadowRecords: allRecords,
      isDataLoaded: true,
    });
  },

  resetState: () => {
    set({
      currentDate: DEFAULT_DATE,
      currentTime: DEFAULT_TIME,
      isPlaying: false,
      playSpeed: 1,
      selectedWindows: [],
      selectedBuildings: [],
      highlightedBuilding: null,
      shadowRecords: [],
      cameraPosition: [60, 50, 60],
      cameraTarget: [0, 15, 0],
    });
  },

  calculateShadows: () => {
    const { buildings, windows, selectedWindows, currentDate } = get();
    const selectedWindowUnits = windows.filter(w => selectedWindows.includes(w.id));
    const allRecords: ShadowRecord[] = [];
    
    selectedWindowUnits.forEach(window => {
      const records = calculateDailyShadowRecords(window, buildings, currentDate);
      allRecords.push(...records);
    });
    
    set({ shadowRecords: allRecords });
  },

  toggleLeftPanel: () => set(state => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set(state => ({ rightPanelOpen: !state.rightPanelOpen })),
}));
