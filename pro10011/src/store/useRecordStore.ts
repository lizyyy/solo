import { create } from 'zustand';
import type { ValuationRecord, RecordStatus, FilterParams, JudgmentHistory } from '../types';
import { mockRecords } from '../data/mockData';
import { loadRecords, saveRecords, saveJudgment, loadJudgmentsByRecordId } from '../utils/storage';

interface RecordState {
  records: ValuationRecord[];
  filters: FilterParams;
  selectedRecordIds: string[];
  isLoading: boolean;
  initialized: boolean;
  
  initRecords: () => void;
  setFilters: (filters: Partial<FilterParams>) => void;
  resetFilters: () => void;
  addRecords: (newRecords: Partial<ValuationRecord>[]) => void;
  updateRecordStatus: (id: string, status: RecordStatus, remark: string, operator: string) => void;
  toggleRecordSelection: (id: string) => void;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  getFilteredRecords: () => ValuationRecord[];
  getRecordById: (id: string) => ValuationRecord | undefined;
  getStatistics: () => {
    total: number;
    pending: number;
    normal: number;
    abnormal: number;
    falsePositive: number;
  };
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  filters: {
    status: 'all',
    excludeFalsePositive: false,
    keyword: ''
  },
  selectedRecordIds: [],
  isLoading: false,
  initialized: false,

  initRecords: () => {
    if (get().initialized) return;
    
    const saved = loadRecords();
    if (saved && saved.length > 0) {
      const recordsWithJudgments = saved.map(record => ({
        ...record,
        judgments: loadJudgmentsByRecordId(record.id)
      }));
      set({ records: recordsWithJudgments, initialized: true });
    } else {
      set({ records: mockRecords, initialized: true });
      saveRecords(mockRecords);
    }
  },

  setFilters: (filters) => {
    set(state => ({
      filters: { ...state.filters, ...filters }
    }));
  },

  resetFilters: () => {
    set({
      filters: {
        status: 'all',
        excludeFalsePositive: false,
        keyword: ''
      }
    });
  },

  addRecords: (newRecords) => {
    const recordsToAdd = newRecords.map(r => ({
      ...r,
      id: r.id || generateId(),
      currentStatus: r.currentStatus || 'pending' as RecordStatus,
      currentRemark: r.currentRemark || '',
      isFalsePositive: false,
      versions: r.versions || [],
      judgments: [],
      createdAt: r.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) as ValuationRecord[];
    
    set(state => {
      const updated = [...recordsToAdd, ...state.records];
      saveRecords(updated);
      return { records: updated };
    });
  },

  updateRecordStatus: (id, status, remark, operator) => {
    set(state => {
      const record = state.records.find(r => r.id === id);
      if (!record) return state;

      const judgment: JudgmentHistory = {
        id: generateId(),
        recordId: id,
        oldStatus: record.currentStatus,
        newStatus: status,
        oldRemark: record.currentRemark,
        newRemark: remark,
        createdAt: new Date().toISOString(),
        operator
      };
      
      saveJudgment(judgment);
      
      const updatedRecords = state.records.map(r => {
        if (r.id === id) {
          const updated = {
            ...r,
            currentStatus: status,
            currentRemark: remark,
            isFalsePositive: status === 'false_positive',
            updatedAt: new Date().toISOString(),
            judgments: [...r.judgments, judgment]
          };
          return updated;
        }
        return r;
      });
      
      saveRecords(updatedRecords);
      return { records: updatedRecords };
    });
  },

  toggleRecordSelection: (id) => {
    set(state => ({
      selectedRecordIds: state.selectedRecordIds.includes(id)
        ? state.selectedRecordIds.filter(i => i !== id)
        : [...state.selectedRecordIds, id]
    }));
  },

  clearSelection: () => {
    set({ selectedRecordIds: [] });
  },

  selectAll: (ids) => {
    set({ selectedRecordIds: ids });
  },

  getFilteredRecords: () => {
    const { records, filters } = get();
    let filtered = [...records];
    
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(r => r.currentStatus === filters.status);
    }
    
    if (filters.excludeFalsePositive) {
      filtered = filtered.filter(r => !r.isFalsePositive);
    }
    
    if (filters.counterparty) {
      filtered = filtered.filter(r => r.counterparty.includes(filters.counterparty!));
    }
    
    if (filters.productType) {
      filtered = filtered.filter(r => r.productType.includes(filters.productType!));
    }
    
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      filtered = filtered.filter(r => 
        r.tradeId.toLowerCase().includes(keyword) ||
        r.counterparty.toLowerCase().includes(keyword) ||
        r.productType.toLowerCase().includes(keyword)
      );
    }
    
    if (filters.startDate) {
      filtered = filtered.filter(r => new Date(r.createdAt) >= new Date(filters.startDate!));
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate!);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(r => new Date(r.createdAt) <= endDate);
    }
    
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getRecordById: (id) => {
    return get().records.find(r => r.id === id);
  },

  getStatistics: () => {
    const { records } = get();
    return {
      total: records.length,
      pending: records.filter(r => r.currentStatus === 'pending').length,
      normal: records.filter(r => r.currentStatus === 'normal').length,
      abnormal: records.filter(r => r.currentStatus === 'abnormal').length,
      falsePositive: records.filter(r => r.currentStatus === 'false_positive').length
    };
  }
}));
