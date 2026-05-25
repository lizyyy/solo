import { create } from 'zustand';
import type { HistoryRecord, PlacedItem, Violation, SettlementResult } from '../types/game';
import { exportToJSON, exportToText, downloadFile } from '../utils/export/reportExporter';

interface HistoryState {
  records: HistoryRecord[];
  
  loadRecords: () => void;
  addRecord: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  getRecord: (id: string) => HistoryRecord | undefined;
  deleteRecord: (id: string) => void;
  clearAll: () => void;
  exportReport: (recordId: string, format: 'json' | 'text') => void;
}

const STORAGE_KEY = 'warehouse_packing_history';

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  
  loadRecords: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        set({ records: data });
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  },
  
  addRecord: (record) => {
    const newRecord: HistoryRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
    };
    
    set(state => {
      const records = [newRecord, ...state.records].slice(0, 50);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return { records };
    });
  },
  
  getRecord: (id: string) => {
    return get().records.find(r => r.id === id);
  },
  
  deleteRecord: (id: string) => {
    set(state => {
      const records = state.records.filter(r => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.error('Failed to save history:', e);
      }
      return { records };
    });
  },
  
  clearAll: () => {
    set({ records: [] });
    localStorage.removeItem(STORAGE_KEY);
  },
  
  exportReport: (recordId: string, format: 'json' | 'text') => {
    const record = get().getRecord(recordId);
    if (!record) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    if (format === 'json') {
      const content = exportToJSON(record);
      downloadFile(content, `packing-report-${timestamp}.json`, 'application/json');
    } else {
      const content = exportToText(record);
      downloadFile(content, `packing-report-${timestamp}.txt`, 'text/plain');
    }
  },
}));
