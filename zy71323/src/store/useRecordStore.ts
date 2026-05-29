import { create } from 'zustand';
import type { EstimationRecord, ComparisonScenario } from '@/types';
import { getAllRecords, deleteRecord, searchRecords } from '@/utils/storage';

interface RecordState {
  records: EstimationRecord[];
  comparisonScenarios: ComparisonScenario[];
  searchQuery: string;
  isLoading: boolean;
  
  loadRecords: () => Promise<void>;
  search: (query: string) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  addToComparison: (recordId: string, label: string) => void;
  removeFromComparison: (scenarioId: string) => void;
  clearComparison: () => void;
}

const COLORS = ['#00d4ff', '#ff6b35', '#00c896', '#a855f7'];

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  comparisonScenarios: [],
  searchQuery: '',
  isLoading: false,

  loadRecords: async () => {
    set({ isLoading: true });
    try {
      const records = await getAllRecords();
      set({ records, isLoading: false });
    } catch (error) {
      console.error('Load records error:', error);
      set({ isLoading: false });
    }
  },

  search: async (query) => {
    set({ searchQuery: query, isLoading: true });
    try {
      const records = await searchRecords(query);
      set({ records, isLoading: false });
    } catch (error) {
      console.error('Search error:', error);
      set({ isLoading: false });
    }
  },

  removeRecord: async (id) => {
    try {
      await deleteRecord(id);
      set(state => ({
        records: state.records.filter(r => r.id !== id),
        comparisonScenarios: state.comparisonScenarios.filter(s => s.recordId !== id),
      }));
    } catch (error) {
      console.error('Delete error:', error);
    }
  },

  addToComparison: (recordId, label) => {
    const { comparisonScenarios } = get();
    if (comparisonScenarios.length >= 4) {
      return;
    }
    if (comparisonScenarios.some(s => s.recordId === recordId)) {
      return;
    }
    
    const colorIndex = comparisonScenarios.length;
    set(state => ({
      comparisonScenarios: [
        ...state.comparisonScenarios,
        {
          id: Date.now().toString(),
          recordId,
          label,
          color: COLORS[colorIndex],
        },
      ],
    }));
  },

  removeFromComparison: (scenarioId) => {
    set(state => ({
      comparisonScenarios: state.comparisonScenarios.filter(s => s.id !== scenarioId),
    }));
  },

  clearComparison: () => {
    set({ comparisonScenarios: [] });
  },
}));
