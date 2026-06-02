import { create } from 'zustand';
import type { BikeRecord, RecordStatus, ImportResult } from '@shared/types';
import { api } from '../utils/api';

interface AppState {
  records: BikeRecord[];
  stats: {
    total: number;
    pending: number;
    processed: number;
    verify: number;
    onsite: number;
    withConflicts: number;
    oldCaliber: number;
  } | null;
  loading: boolean;
  error: string | null;
  lastImportResult: ImportResult | null;

  fetchRecords: (status?: RecordStatus) => Promise<void>;
  fetchStats: () => Promise<void>;
  updateRecordStatus: (id: string, status: RecordStatus, notes?: string) => Promise<void>;
  loadSampleData: () => Promise<void>;
  clearAll: () => Promise<void>;
  setImportResult: (result: ImportResult | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  stats: null,
  loading: false,
  error: null,
  lastImportResult: null,

  fetchRecords: async (status?: RecordStatus) => {
    set({ loading: true, error: null });
    try {
      const records = await api.records.getAll(status);
      set({ records, loading: false });
      await get().fetchStats();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '获取记录失败', loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.records.getStats();
      set({ stats });
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  },

  updateRecordStatus: async (id: string, status: RecordStatus, notes?: string) => {
    set({ loading: true, error: null });
    try {
      await api.records.updateStatus(id, status, notes);
      set({ loading: false });
      await get().fetchRecords();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '更新状态失败', loading: false });
      throw e;
    }
  },

  loadSampleData: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.sample.load();
      set({ lastImportResult: result.importResult, loading: false });
      await get().fetchRecords();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载样例数据失败', loading: false });
      throw e;
    }
  },

  clearAll: async () => {
    set({ loading: true, error: null });
    try {
      await api.records.clearAll();
      set({ records: [], loading: false, lastImportResult: null });
      await get().fetchStats();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '清空数据失败', loading: false });
      throw e;
    }
  },

  setImportResult: (result: ImportResult | null) => {
    set({ lastImportResult: result });
  },
}));
