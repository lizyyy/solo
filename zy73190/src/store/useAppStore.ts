import { create } from 'zustand';
import type {
  AppState,
  ParamVersion,
  Sample,
  Note,
  SampleStatus,
  FilterState,
} from '@/types';
import { paramVersions } from '@/data/paramVersions';
import { samples as initialSamples } from '@/data/samples';
import { notes as initialNotes } from '@/data/notes';
import { recalculateAllSamples } from '@/utils/calculator';

interface AppStore extends AppState {
  setCurrentParamVersion: (versionId: string) => void;
  setSelectedSample: (sampleId: string | null) => void;
  setTracePanelOpen: (open: boolean) => void;
  setActiveTraceTab: (tab: 'score' | 'formula' | 'clue') => void;
  updateSampleStatus: (sampleId: string, status: SampleStatus) => void;
  addNote: (sampleId: string, content: string, operator: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  getCurrentParamVersion: () => ParamVersion | undefined;
  getFilteredSamples: () => Sample[];
  getSampleNotes: (sampleId: string) => Note[];
}

const initialFilters: FilterState = {
  status: [],
  sampleCode: '',
  dateRange: null,
};

function calculateInitialSamples(): Sample[] {
  const defaultVersion = paramVersions[1];
  return recalculateAllSamples(initialSamples, defaultVersion);
}

export const useAppStore = create<AppStore>((set, get) => ({
  paramVersions,
  currentParamVersionId: 'v1.1',
  samples: calculateInitialSamples(),
  notes: initialNotes,
  clues: [],
  filters: initialFilters,
  selectedSampleId: null,
  tracePanelOpen: false,
  activeTraceTab: 'score',

  setCurrentParamVersion: (versionId: string) => {
    const version = get().paramVersions.find((v) => v.id === versionId);
    if (!version) return;

    const recalculatedSamples = recalculateAllSamples(get().samples, version);

    set({
      currentParamVersionId: versionId,
      samples: recalculatedSamples,
    });
  },

  setSelectedSample: (sampleId: string | null) => {
    set({
      selectedSampleId: sampleId,
      tracePanelOpen: sampleId !== null,
    });
  },

  setTracePanelOpen: (open: boolean) => {
    set({ tracePanelOpen: open });
  },

  setActiveTraceTab: (tab: 'score' | 'formula' | 'clue') => {
    set({ activeTraceTab: tab });
  },

  updateSampleStatus: (sampleId: string, status: SampleStatus) => {
    set((state) => ({
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? { ...s, status, updatedAt: new Date().toLocaleString('zh-CN') }
          : s
      ),
    }));
  },

  addNote: (sampleId: string, content: string, operator: string) => {
    const newNote: Note = {
      id: `n-${Date.now()}`,
      sampleId,
      type: 'supplement',
      content,
      operator,
      createdAt: new Date().toLocaleString('zh-CN'),
    };

    set((state) => ({
      notes: [...state.notes, newNote],
      samples: state.samples.map((s) =>
        s.id === sampleId
          ? { ...s, updatedAt: new Date().toLocaleString('zh-CN') }
          : s
      ),
    }));
  },

  setFilters: (filters: Partial<FilterState>) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  resetFilters: () => {
    set({ filters: initialFilters });
  },

  getCurrentParamVersion: () => {
    return get().paramVersions.find((v) => v.id === get().currentParamVersionId);
  },

  getFilteredSamples: () => {
    const { samples, filters } = get();
    return samples.filter((sample) => {
      if (filters.status.length > 0 && !filters.status.includes(sample.status)) {
        return false;
      }
      if (
        filters.sampleCode &&
        !sample.sampleCode.toLowerCase().includes(filters.sampleCode.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateRange) {
        const sampleDate = new Date(sample.createdAt);
        const startDate = new Date(filters.dateRange[0]);
        const endDate = new Date(filters.dateRange[1]);
        if (sampleDate < startDate || sampleDate > endDate) {
          return false;
        }
      }
      return true;
    });
  },

  getSampleNotes: (sampleId: string) => {
    return get().notes.filter((n) => n.sampleId === sampleId);
  },
}));
