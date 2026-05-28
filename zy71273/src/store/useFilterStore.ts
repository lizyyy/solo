import { create } from 'zustand';
import { FilterConfig, FilterState, FilterFailureInfo } from '../types/filter';
import { CLASSES } from '../data/artworks';
import { checkFilterFailure } from '../utils/qualityChecker';

interface FilterStore extends FilterState {
  filterFailure: FilterFailureInfo | null;
  
  toggleClass: (classId: string) => void;
  selectAllClasses: () => void;
  clearAllClasses: () => void;
  setHueRange: (range: [number, number]) => void;
  setLightnessRange: (range: [number, number]) => void;
  setSaturationRange: (range: [number, number]) => void;
  toggleQualityFlag: (flag: FilterState['showQualityFlags'][number]) => void;
  saveFilterConfig: (name: string) => void;
  loadFilterConfig: (configId: string) => void;
  deleteFilterConfig: (configId: string) => void;
  resetFilters: () => void;
  checkFilterFailure: (filteredCount: number) => void;
  clearFilterFailure: () => void;
  exportFilters: () => string;
  importFilters: (jsonString: string) => boolean;
}

const initialState: FilterState = {
  selectedClassIds: CLASSES.map(c => c.id),
  hueRange: [0, 360],
  lightnessRange: [0, 100],
  saturationRange: [0, 100],
  savedConfigs: [],
  showQualityFlags: []
};

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...initialState,
  filterFailure: null,

  toggleClass: (classId) => set(state => {
    const selected = state.selectedClassIds.includes(classId)
      ? state.selectedClassIds.filter(id => id !== classId)
      : [...state.selectedClassIds, classId];
    return { selectedClassIds: selected };
  }),

  selectAllClasses: () => set({
    selectedClassIds: CLASSES.map(c => c.id)
  }),

  clearAllClasses: () => set({
    selectedClassIds: []
  }),

  setHueRange: (range) => set({ hueRange: range }),
  setLightnessRange: (range) => set({ lightnessRange: range }),
  setSaturationRange: (range) => set({ saturationRange: range }),

  toggleQualityFlag: (flag) => set(state => {
    const flags = state.showQualityFlags.includes(flag)
      ? state.showQualityFlags.filter(f => f !== flag)
      : [...state.showQualityFlags, flag];
    return { showQualityFlags: flags };
  }),

  saveFilterConfig: (name) => {
    const state = get();
    const newConfig: FilterConfig = {
      id: `config-${Date.now()}`,
      name,
      classIds: [...state.selectedClassIds],
      hueRange: [...state.hueRange] as [number, number],
      lightnessRange: [...state.lightnessRange] as [number, number],
      saturationRange: [...state.saturationRange] as [number, number],
      savedAt: new Date().toISOString()
    };
    
    try {
      const saved = JSON.parse(localStorage.getItem('colorSpaceFilters') || '[]');
      saved.push(newConfig);
      localStorage.setItem('colorSpaceFilters', JSON.stringify(saved));
      set({ savedConfigs: saved });
    } catch (e) {
      console.error('Failed to save filter config:', e);
    }
  },

  loadFilterConfig: (configId) => {
    const config = get().savedConfigs.find(c => c.id === configId);
    if (config) {
      set({
        selectedClassIds: [...config.classIds],
        hueRange: [...config.hueRange] as [number, number],
        lightnessRange: [...config.lightnessRange] as [number, number],
        saturationRange: [...config.saturationRange] as [number, number]
      });
    }
  },

  deleteFilterConfig: (configId) => {
    const saved = get().savedConfigs.filter(c => c.id !== configId);
    try {
      localStorage.setItem('colorSpaceFilters', JSON.stringify(saved));
      set({ savedConfigs: saved });
    } catch (e) {
      console.error('Failed to delete filter config:', e);
    }
  },

  resetFilters: () => set({
    ...initialState,
    savedConfigs: get().savedConfigs
  }),

  checkFilterFailure: (filteredCount) => {
    const failure = checkFilterFailure(filteredCount, 2);
    if (failure.failed) {
      const allClassIds = CLASSES.map(c => c.id);
      const selected = get().selectedClassIds;
      const recommended = allClassIds.filter(id => !selected.includes(id)).slice(0, 3);
      failure.recommendedClassIds = recommended;
    }
    set({ filterFailure: failure.failed ? failure : null });
  },

  clearFilterFailure: () => set({ filterFailure: null }),

  exportFilters: () => {
    const state = get();
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      filters: {
        selectedClassIds: state.selectedClassIds,
        hueRange: state.hueRange,
        lightnessRange: state.lightnessRange,
        saturationRange: state.saturationRange
      },
      savedConfigs: state.savedConfigs
    };
    return JSON.stringify(exportData, null, 2);
  },

  importFilters: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.filters) {
        set({
          selectedClassIds: data.filters.selectedClassIds || initialState.selectedClassIds,
          hueRange: data.filters.hueRange || initialState.hueRange,
          lightnessRange: data.filters.lightnessRange || initialState.lightnessRange,
          saturationRange: data.filters.saturationRange || initialState.saturationRange,
          savedConfigs: data.savedConfigs || []
        });
        return true;
      }
    } catch (e) {
      console.error('Failed to import filters:', e);
    }
    return false;
  }
}));
