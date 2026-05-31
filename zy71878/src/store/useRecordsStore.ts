import { create } from 'zustand';
import type { DataRecord, RecordStatus, Evidence } from '../types';
import { detectAnomalies } from '../logic/anomalyDetector';
import { updateRecordStatus } from '../logic/statusManager';
import { generateEvidenceId } from '../logic/evidenceChain';
import { getInitialProcessedData } from '../data/samplePacket';

interface RecordsStore {
  records: DataRecord[];
  selectedRecordId: string | null;
  filterStatus: RecordStatus | 'all';
  showAnomalyPanel: boolean;
  initialized: boolean;
  
  initRecords: () => void;
  setRecords: (records: DataRecord[]) => void;
  selectRecord: (id: string | null) => void;
  setFilter: (status: RecordStatus | 'all') => void;
  toggleAnomalyPanel: () => void;
  updateStatus: (id: string, status: RecordStatus, reason: string, operator: string) => void;
  addEvidence: (recordId: string, evidence: Omit<Evidence, 'id' | 'timestamp'>) => void;
  importPacket: (packet: DataRecord[]) => void;
  getSelectedRecord: () => DataRecord | undefined;
  getFilteredRecords: () => DataRecord[];
  getPendingRecords: () => DataRecord[];
  resetData: () => void;
}

const STORAGE_KEY = 'factory-bottleneck-records';

const loadFromStorage = (): DataRecord[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return null;
};

const saveToStorage = (records: DataRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
};

export const useRecordsStore = create<RecordsStore>((set, get) => ({
  records: [],
  selectedRecordId: null,
  filterStatus: 'all',
  showAnomalyPanel: false,
  initialized: false,

  initRecords: () => {
    if (get().initialized) return;
    
    const stored = loadFromStorage();
    let records: DataRecord[];
    
    if (stored && stored.length > 0) {
      records = stored;
    } else {
      const rawData = getInitialProcessedData();
      records = detectAnomalies(rawData);
      saveToStorage(records);
    }
    
    set({ records, initialized: true });
  },

  setRecords: (records) => {
    set({ records });
    saveToStorage(records);
  },

  selectRecord: (id) => {
    set({ selectedRecordId: id });
  },

  setFilter: (status) => {
    set({ filterStatus: status });
  },

  toggleAnomalyPanel: () => {
    set((state) => ({ showAnomalyPanel: !state.showAnomalyPanel }));
  },

  updateStatus: (id, status, reason, operator) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === id) {
          return updateRecordStatus(r, status, reason, operator);
        }
        return r;
      });
      saveToStorage(records);
      return { records };
    });
  },

  addEvidence: (recordId, evidence) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId) {
          const newEvidence: Evidence = {
            ...evidence,
            id: generateEvidenceId(),
            timestamp: new Date().toISOString(),
          };
          return {
            ...r,
            evidence: [...r.evidence, newEvidence],
          };
        }
        return r;
      });
      saveToStorage(records);
      return { records };
    });
  },

  importPacket: (packet) => {
    set((state) => {
      const processed = detectAnomalies(packet);
      const records = [...state.records, ...processed];
      saveToStorage(records);
      return { records };
    });
  },

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find((r) => r.id === selectedRecordId);
  },

  getFilteredRecords: () => {
    const { records, filterStatus } = get();
    if (filterStatus === 'all') {
      return [...records].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }
    return records
      .filter((r) => r.status === filterStatus)
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  },

  getPendingRecords: () => {
    return get().records.filter((r) => r.status === 'pending');
  },

  resetData: () => {
    const rawData = getInitialProcessedData();
    const records = detectAnomalies(rawData);
    saveToStorage(records);
    set({ records, selectedRecordId: null });
  },
}));
