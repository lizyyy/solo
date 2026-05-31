import { create } from 'zustand';
import type { PlayerScore, LevelConfig, OperationHistory, ViewState } from '../types/data';

interface DataStore {
  scores: PlayerScore[];
  levels: LevelConfig[];
  operationHistory: OperationHistory[];
  isLoading: boolean;
  filters: ViewState['filters'];
  selectedScore: PlayerScore | null;

  setScores: (scores: PlayerScore[]) => void;
  setLevels: (levels: LevelConfig[]) => void;
  setOperationHistory: (history: OperationHistory[]) => void;
  setIsLoading: (loading: boolean) => void;
  setFilters: (filters: Partial<ViewState['filters']>) => void;
  setSelectedScore: (score: PlayerScore | null) => void;
  resetFilters: () => void;
}

const defaultFilters: ViewState['filters'] = {
  status: ['normal', 'pending', 'corrected', 'rejected'],
};

export const useDataStore = create<DataStore>((set) => ({
  scores: [],
  levels: [],
  operationHistory: [],
  isLoading: false,
  filters: defaultFilters,
  selectedScore: null,

  setScores: (scores) => set({ scores }),
  setLevels: (levels) => set({ levels }),
  setOperationHistory: (history) => set({ operationHistory: history }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  setSelectedScore: (score) => set({ selectedScore: score }),
  resetFilters: () => set({ filters: defaultFilters }),
}));
