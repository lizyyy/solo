import { create } from 'zustand';
import { BlindSpot, Filters, VisibilityResult, Vector3Tuple, BlindSpotType, Severity } from '@/types';

interface AnalysisState {
  blindSpots: BlindSpot[];
  activeBlindSpot: string | null;
  visibilityCheckEnabled: boolean;
  visibilityResults: VisibilityResult[];
  filters: Filters;
  viewerPosition: Vector3Tuple;
  setBlindSpots: (spots: BlindSpot[]) => void;
  addBlindSpot: (spot: Omit<BlindSpot, 'id'>) => void;
  removeBlindSpot: (id: string) => void;
  updateBlindSpot: (id: string, updates: Partial<BlindSpot>) => void;
  setActiveBlindSpot: (id: string | null) => void;
  setVisibilityCheckEnabled: (enabled: boolean) => void;
  setVisibilityResults: (results: VisibilityResult[]) => void;
  setFilters: (filters: Partial<Filters>) => void;
  toggleFilter: (key: keyof Filters) => void;
  setViewerPosition: (pos: Vector3Tuple) => void;
  resetAnalysis: () => void;
}

const initialFilters: Filters = {
  columns: true,
  signages: true,
  stores: true,
  barriers: true,
  paths: true,
};

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  blindSpots: [],
  activeBlindSpot: null,
  visibilityCheckEnabled: false,
  visibilityResults: [],
  filters: initialFilters,
  viewerPosition: [0, 1.7, 0],
  
  setBlindSpots: (spots) => set({ blindSpots: spots }),
  
  addBlindSpot: (spot) => {
    const newSpot: BlindSpot = {
      ...spot,
      id: `blindspot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set({ blindSpots: [...get().blindSpots, newSpot] });
  },
  
  removeBlindSpot: (id) => {
    set({
      blindSpots: get().blindSpots.filter(s => s.id !== id),
      activeBlindSpot: get().activeBlindSpot === id ? null : get().activeBlindSpot,
    });
  },
  
  updateBlindSpot: (id, updates) => {
    set({
      blindSpots: get().blindSpots.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  },
  
  setActiveBlindSpot: (id) => set({ activeBlindSpot: id }),
  
  setVisibilityCheckEnabled: (enabled) => set({ visibilityCheckEnabled: enabled }),
  
  setVisibilityResults: (results) => set({ visibilityResults: results }),
  
  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
  },
  
  toggleFilter: (key) => {
    set({
      filters: {
        ...get().filters,
        [key]: !get().filters[key],
      },
    });
  },
  
  setViewerPosition: (pos) => set({ viewerPosition: pos }),
  
  resetAnalysis: () => {
    set({
      blindSpots: [],
      activeBlindSpot: null,
      visibilityCheckEnabled: false,
      visibilityResults: [],
      filters: initialFilters,
      viewerPosition: [0, 1.7, 0],
    });
  },
}));
