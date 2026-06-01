import { create } from 'zustand';
import type { EstimationRecord, FilterState, RecordStatus } from '../types';
import { mockRecords, parameterVersions } from '../data/mockData';
import { PipeCapacityCalculator } from '../services/calculator';

interface AppState {
  records: EstimationRecord[];
  filters: FilterState;
  selectedRecordId: string | null;
  parameterVersions: typeof parameterVersions;

  setRecords: (records: EstimationRecord[]) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setSelectedRecordId: (id: string | null) => void;
  getFilteredRecords: () => EstimationRecord[];
  confirmRecord: (id: string) => void;
  rejectRecord: (id: string, reason: string) => void;
  getStatistics: () => {
    total: number; success: number; pending: number; legacy: number; error: number; };
  initializeRecords: () => void;
}

const initialFilters: FilterState = {
  status: [],
  area: [],
  dateRange: { start: '', end: '' },
  source: [],
};

export const useStore = create<AppState>((set, get) => ({
  records: [],
  filters: initialFilters,
  selectedRecordId: null,
  parameterVersions,

  setRecords: (records) => set({ records }),

  setFilters: (newFilters) => set(state => ({
    filters: { ...state.filters, ...newFilters },
  })),

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  getFilteredRecords: () => {
    const { records, filters } = get();
    return records.filter(record => {
      if (filters.status.length > 0 && !filters.status.includes(record.status)) return false;
      if (filters.area.length > 0 && !filters.area.includes(record.area)) return false;
      if (filters.source.length > 0 && !filters.source.includes(record.source)) return false;
      if (filters.dateRange.start && record.calculationDate < filters.dateRange.start) return false;
      if (filters.dateRange.end && record.calculationDate > filters.dateRange.end) return false;
      return true;
    });
  },

  confirmRecord: (id) => set(state => ({
    records: state.records.map(r =>
      r.id === id ? { ...r, status: 'success' as RecordStatus } : r
    ),
  })),

  rejectRecord: (id, reason) => set(state => ({
    records: state.records.map(r =>
      r.id === id ? { ...r, status: 'error' as RecordStatus, failureReason: reason } : r
    ),
  })),

  getStatistics: () => {
    const { records } = get();
    return {
      total: records.length,
      success: records.filter(r => r.status === 'success').length,
      pending: records.filter(r => r.status === 'pending').length,
      legacy: records.filter(r => r.status === 'legacy').length,
      error: records.filter(r => r.status === 'error').length,
    };
  },

  initializeRecords: () => {
    const calculator = new PipeCapacityCalculator();
    const processedRecords = mockRecords.map((record, _, array) => {
      return calculator.processRecord(record, array);
    });
    set({ records: processedRecords });
  },
}));
