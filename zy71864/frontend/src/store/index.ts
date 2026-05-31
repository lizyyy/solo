import { create } from 'zustand';
import type { FilterCondition, DiagnosisBatch, DiagnosisResult, DiagnosisSummary, EvaluationRecord, ErrorResponse } from '@/types';

interface AppState {
  currentUser: {
    id: string;
    name: string;
    role: 'teacher' | 'leader' | 'admin';
  };
  currentFilter: FilterCondition | null;
  selectedRecords: EvaluationRecord[];
  currentBatch: DiagnosisBatch | null;
  currentResults: DiagnosisResult[];
  currentSummary: DiagnosisSummary | null;
  notification: {
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
    contact?: string;
  } | null;
  isReusedBatch: boolean;
}

interface AppActions {
  setCurrentFilter: (filter: FilterCondition | null) => void;
  setSelectedRecords: (records: EvaluationRecord[]) => void;
  toggleRecordSelection: (record: EvaluationRecord) => void;
  clearSelection: () => void;
  setCurrentBatch: (batch: DiagnosisBatch | null) => void;
  setCurrentResults: (results: DiagnosisResult[]) => void;
  setCurrentSummary: (summary: DiagnosisSummary | null) => void;
  showNotification: (notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
    contact?: string;
  }) => void;
  hideNotification: () => void;
  showError: (error: ErrorResponse) => void;
  setIsReusedBatch: (isReused: boolean) => void;
  resetDiagnosis: () => void;
}

const initialState: AppState = {
  currentUser: {
    id: 'user_001',
    name: '张老师',
    role: 'teacher',
  },
  currentFilter: null,
  selectedRecords: [],
  currentBatch: null,
  currentResults: [],
  currentSummary: null,
  notification: null,
  isReusedBatch: false,
};

export const useAppStore = create<AppState & AppActions>((set, get) => ({
  ...initialState,

  setCurrentFilter: (filter) => set({ currentFilter: filter }),

  setSelectedRecords: (records) => set({ selectedRecords: records }),

  toggleRecordSelection: (record) => {
    const { selectedRecords } = get();
    const exists = selectedRecords.find((r) => r.id === record.id);
    if (exists) {
      set({ selectedRecords: selectedRecords.filter((r) => r.id !== record.id) });
    } else {
      set({ selectedRecords: [...selectedRecords, record] });
    }
  },

  clearSelection: () => set({ selectedRecords: [] }),

  setCurrentBatch: (batch) => set({ currentBatch: batch }),

  setCurrentResults: (results) => set({ currentResults: results }),

  setCurrentSummary: (summary) => set({ currentSummary: summary }),

  showNotification: (notification) => {
    set({ notification: { visible: true, ...notification } });
    setTimeout(() => {
      set({ notification: null });
    }, 5000);
  },

  hideNotification: () => set({ notification: null }),

  showError: (error) => {
    set({
      notification: {
        visible: true,
        type: 'error',
        message: error.message,
        suggestion: error.suggestion,
        contact: error.contact_person,
      },
    });
    setTimeout(() => {
      set({ notification: null });
    }, 8000);
  },

  setIsReusedBatch: (isReused) => set({ isReusedBatch: isReused }),

  resetDiagnosis: () =>
    set({
      currentBatch: null,
      currentResults: [],
      currentSummary: null,
      isReusedBatch: false,
    }),
}));
