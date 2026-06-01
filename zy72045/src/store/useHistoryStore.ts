import { create } from 'zustand';
import type { HistoryRecord } from '../types/history';
import { loadHistoryRecords, deleteHistoryRecord, clearHistoryRecords, loadHistoryRecordById } from '../utils/storage';
import { sampleHistoryRecords } from '../data';

interface HistoryStore {
  records: HistoryRecord[];
  currentRecord: HistoryRecord | null;
  loading: boolean;
  loadRecords: () => void;
  loadRecordById: (id: string) => HistoryRecord | undefined;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
  setCurrentRecord: (record: HistoryRecord | null) => void;
  loadSampleData: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  records: [],
  currentRecord: null,
  loading: false,

  loadRecords: () => {
    set({ loading: true });
    const records = loadHistoryRecords();
    set({ records, loading: false });
  },

  loadRecordById: (id: string) => {
    const record = loadHistoryRecordById(id);
    if (record) {
      set({ currentRecord: record });
    }
    return record;
  },

  deleteRecord: (id: string) => {
    deleteHistoryRecord(id);
    const records = get().records.filter((r) => r.id !== id);
    set({ records });
    if (get().currentRecord?.id === id) {
      set({ currentRecord: null });
    }
  },

  clearAll: () => {
    clearHistoryRecords();
    set({ records: [], currentRecord: null });
  },

  setCurrentRecord: (record: HistoryRecord | null) => {
    set({ currentRecord: record });
  },

  loadSampleData: () => {
    const existingRecords = loadHistoryRecords();
    if (existingRecords.length === 0) {
      sampleHistoryRecords.forEach((record) => {
        // 使用storage.ts中的saveHistoryRecord会更合适，但为了避免循环依赖，这里直接操作
        const records = loadHistoryRecords();
        records.unshift(record);
        localStorage.setItem('stock-news-history', JSON.stringify(records.slice(0, 100)));
      });
      set({ records: sampleHistoryRecords });
    }
  },
}));
