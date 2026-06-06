import { create } from 'zustand';
import type { TemperatureRecord, RecordHistory } from '@/types';
import { storage } from '@/utils/storage';
import { mockRecords, mockHistory } from '@/utils/mockData';
import { generateId, determineRecordStatus } from '@/utils/helpers';
import { useThresholdStore } from './useThresholdStore';

interface RecordState {
  records: TemperatureRecord[];
  history: RecordHistory[];
  selectedRecordId: string | null;
  init: () => void;
  addRecord: (record: Omit<TemperatureRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  updateRecord: (id: string, updates: Partial<TemperatureRecord>, userId: string, userName: string, changeReason?: string) => void;
  deleteRecord: (id: string) => void;
  getRecordById: (id: string) => TemperatureRecord | undefined;
  getHistoryByRecordId: (recordId: string) => RecordHistory[];
  selectRecord: (id: string | null) => void;
  updateStatuses: () => void;
  resetToMock: () => void;
}

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  history: [],
  selectedRecordId: null,

  init: () => {
    const savedRecords = storage.get<TemperatureRecord[]>('records', []);
    const savedHistory = storage.get<RecordHistory[]>('history', []);
    
    if (savedRecords.length === 0) {
      set({ records: mockRecords });
      storage.set('records', mockRecords);
    } else {
      set({ records: savedRecords });
    }

    if (savedHistory.length === 0) {
      set({ history: mockHistory });
      storage.set('history', mockHistory);
    } else {
      set({ history: savedHistory });
    }

    setTimeout(() => get().updateStatuses(), 0);
  },

  addRecord: (record) => {
    const now = new Date().toISOString();
    const newRecord: TemperatureRecord = {
      ...record,
      id: generateId(),
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };

    const threshold = useThresholdStore.getState().getThresholdById(record.thresholdId);
    newRecord.status = determineRecordStatus(newRecord, threshold);

    const newRecords = [...get().records, newRecord];
    set({ records: newRecords });
    storage.set('records', newRecords);
  },

  updateRecord: (id, updates, userId, userName, changeReason) => {
    const record = get().getRecordById(id);
    if (!record) return;

    const historyEntries: RecordHistory[] = [];
    const now = new Date().toISOString();

    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = String(record[key as keyof TemperatureRecord] ?? '');
      const newValue = String(value ?? '');
      
      if (oldValue !== newValue) {
        historyEntries.push({
          id: generateId(),
          recordId: id,
          userId,
          userName,
          fieldName: key,
          oldValue,
          newValue,
          changeReason,
          createdAt: now,
        });
      }
    });

    const updatedRecord = {
      ...record,
      ...updates,
      updatedAt: now,
    };

    const threshold = useThresholdStore.getState().getThresholdById(updatedRecord.thresholdId);
    updatedRecord.status = determineRecordStatus(updatedRecord, threshold);

    const newRecords = get().records.map(r => r.id === id ? updatedRecord : r);
    const newHistory = [...get().history, ...historyEntries];

    set({ records: newRecords, history: newHistory });
    storage.set('records', newRecords);
    storage.set('history', newHistory);
  },

  deleteRecord: (id) => {
    const newRecords = get().records.filter(r => r.id !== id);
    const newHistory = get().history.filter(h => h.recordId !== id);
    set({ records: newRecords, history: newHistory });
    storage.set('records', newRecords);
    storage.set('history', newHistory);
  },

  getRecordById: (id) => {
    return get().records.find(r => r.id === id);
  },

  getHistoryByRecordId: (recordId) => {
    return get().history.filter(h => h.recordId === recordId).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  selectRecord: (id) => {
    set({ selectedRecordId: id });
  },

  updateStatuses: () => {
    const { thresholds } = useThresholdStore.getState();
    const newRecords = get().records.map(record => {
      const threshold = thresholds.find(t => t.id === record.thresholdId);
      const newStatus = determineRecordStatus(record, threshold);
      if (newStatus !== record.status) {
        return { ...record, status: newStatus };
      }
      return record;
    });
    set({ records: newRecords });
    storage.set('records', newRecords);
  },

  resetToMock: () => {
    set({ records: mockRecords, history: mockHistory });
    storage.set('records', mockRecords);
    storage.set('history', mockHistory);
  },
}));
