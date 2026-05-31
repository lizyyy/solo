import { create } from 'zustand';
import {
  BeatRecord,
  ChangeLog,
  MismatchRecord,
  Student,
  Section,
  FriendlyError,
  FilterOptions,
  RecordStatus,
  DataSource,
  RehearsalSummary,
  ChangeType,
} from '../types';
import {
  mockRecords,
  mockStudents,
  mockSections,
  mockChangeLogs,
  mockMismatchRecords,
  generateId,
} from '../utils/mockData';

interface AppState {
  records: BeatRecord[];
  students: Student[];
  sections: Section[];
  changeLogs: ChangeLog[];
  mismatchRecords: MismatchRecord[];
  filters: FilterOptions;
  errors: FriendlyError[];
  selectedRecordIds: string[];
  currentSummary: RehearsalSummary | null;
  isLoading: boolean;

  setFilters: (filters: Partial<FilterOptions>) => void;
  addRecord: (record: Omit<BeatRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRecord: (id: string, updates: Partial<BeatRecord>, reason: string, changedBy: string) => void;
  updateRecordStatus: (id: string, status: RecordStatus) => void;
  batchUpdateStatus: (ids: string[], status: RecordStatus) => void;
  toggleSelectRecord: (id: string) => void;
  selectAllRecords: (ids: string[]) => void;
  clearSelection: () => void;
  addError: (error: FriendlyError) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  getFilteredRecords: () => BeatRecord[];
  getChangeLogsForRecord: (recordId: string) => ChangeLog[];
  getMismatchesForRecord: (recordId: string) => MismatchRecord[];
  updateMismatchStatus: (id: string, status: 'pending' | 'fixed' | 'ignored') => void;
  generateSummary: (date: string) => RehearsalSummary;
  addChangeLog: (log: Omit<ChangeLog, 'id' | 'changedAt'>) => void;
  addMismatchRecord: (mismatch: Omit<MismatchRecord, 'id' | 'detectedAt'>) => void;
}

const STORAGE_KEY = 'beat_records_data';

function loadFromStorage(): Partial<AppState> | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load from storage:', e);
  }
  return null;
}

function saveToStorage(state: Partial<AppState>) {
  try {
    const data = {
      records: state.records,
      changeLogs: state.changeLogs,
      mismatchRecords: state.mismatchRecords,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to storage:', e);
  }
}

const storedData = loadFromStorage();

export const useStore = create<AppState>((set, get) => ({
  records: storedData?.records || mockRecords,
  students: mockStudents,
  sections: mockSections,
  changeLogs: storedData?.changeLogs || mockChangeLogs,
  mismatchRecords: storedData?.mismatchRecords || mockMismatchRecords,
  filters: {},
  errors: [],
  selectedRecordIds: [],
  currentSummary: null,
  isLoading: false,

  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters },
    }));
  },

  addRecord: (record) => {
    const newRecord: BeatRecord = {
      ...record,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const newState = { records: [...state.records, newRecord] };
      saveToStorage(newState);
      return newState;
    });
  },

  updateRecord: (id, updates, reason, changedBy) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates, updatedAt: new Date().toISOString() };
          
          Object.entries(updates).forEach(([key, value]) => {
            const oldValue = String(r[key as keyof BeatRecord]);
            const newValue = String(value);
            if (oldValue !== newValue) {
              get().addChangeLog({
                recordId: id,
                fieldName: key,
                oldValue,
                newValue,
                changedBy,
                changeType: ChangeType.MANUAL,
                reason,
              });
            }
          });

          return updated;
        }
        return r;
      });
      const newState = { records };
      saveToStorage(newState);
      return newState;
    });
  },

  updateRecordStatus: (id, status) => {
    get().updateRecord(id, { status }, '状态更新', '系统');
  },

  batchUpdateStatus: (ids, status) => {
    ids.forEach((id) => get().updateRecordStatus(id, status));
  },

  toggleSelectRecord: (id) => {
    set((state) => ({
      selectedRecordIds: state.selectedRecordIds.includes(id)
        ? state.selectedRecordIds.filter((x) => x !== id)
        : [...state.selectedRecordIds, id],
    }));
  },

  selectAllRecords: (ids) => {
    set({ selectedRecordIds: ids });
  },

  clearSelection: () => {
    set({ selectedRecordIds: [] });
  },

  addError: (error) => {
    set((state) => ({
      errors: [...state.errors, error],
    }));
  },

  removeError: (id) => {
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
    }));
  },

  clearErrors: () => {
    set({ errors: [] });
  },

  getFilteredRecords: () => {
    const { records, filters } = get();
    return records.filter((r) => {
      if (filters.sectionId && r.sectionId !== filters.sectionId) return false;
      if (filters.studentId && r.studentId !== filters.studentId) return false;
      if (filters.date && r.rehearsalDate !== filters.date) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.source && r.source !== filters.source) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          r.studentName.toLowerCase().includes(searchLower) ||
          r.sectionName.toLowerCase().includes(searchLower) ||
          r.remarks.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  },

  getChangeLogsForRecord: (recordId) => {
    return get().changeLogs
      .filter((log) => log.recordId === recordId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  },

  getMismatchesForRecord: (recordId) => {
    return get().mismatchRecords.filter((m) => m.recordId === recordId);
  },

  updateMismatchStatus: (id, status) => {
    set((state) => {
      const mismatchRecords = state.mismatchRecords.map((m) =>
        m.id === id ? { ...m, status } : m
      );
      const newState = { mismatchRecords };
      saveToStorage(newState);
      return newState;
    });
  },

  generateSummary: (date) => {
    const { records } = get();
    const dayRecords = records.filter((r) => r.rehearsalDate === date);
    
    const confirmed = dayRecords.filter((r) => r.status === RecordStatus.CONFIRMED);
    const toFill = dayRecords.filter((r) => r.status === RecordStatus.TO_FILL);
    const manualEdited = dayRecords.filter((r) => r.status === RecordStatus.MANUAL_EDITED);

    const summary: RehearsalSummary = {
      id: generateId(),
      date,
      totalRecords: dayRecords.length,
      confirmedCount: confirmed.length,
      toFillCount: toFill.length,
      manualEditedCount: manualEdited.length,
      items: [],
      generatedAt: new Date().toISOString(),
    };

    set({ currentSummary: summary });
    return summary;
  },

  addChangeLog: (log) => {
    const newLog: ChangeLog = {
      ...log,
      id: generateId(),
      changedAt: new Date().toISOString(),
    };
    set((state) => {
      const newState = { changeLogs: [...state.changeLogs, newLog] };
      saveToStorage(newState);
      return newState;
    });
  },

  addMismatchRecord: (mismatch) => {
    const newMismatch: MismatchRecord = {
      ...mismatch,
      id: generateId(),
      detectedAt: new Date().toISOString(),
    };
    set((state) => {
      const newState = { mismatchRecords: [...state.mismatchRecords, newMismatch] };
      saveToStorage(newState);
      return newState;
    });
  },
}));
