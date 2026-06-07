import { create } from 'zustand';
import type { 
  ApprovalRecord, 
  HistoryEntry, 
  RecordStatus, 
  StepNumber,
  SamplingPoint,
  Summary,
  UserRole,
} from '@/types';
import { mockRecords, mockHistory } from '@/data/mockRecords';

interface AppState {
  records: ApprovalRecord[];
  history: Record<string, HistoryEntry[]>;
  currentUser: { name: string; role: UserRole };
  getRecordById: (id: string) => ApprovalRecord | undefined;
  getHistoryByRecordId: (id: string) => HistoryEntry[];
  updateRecordStatus: (recordId: string, status: RecordStatus, operator: string, remark?: string) => void;
  addSamplingPoint: (recordId: string, sampling: SamplingPoint) => void;
  updateSummary: (recordId: string, summary: Summary) => void;
  confirmFinalName: (recordId: string, finalName: string, operator: string) => void;
  rollbackToHistory: (recordId: string, historyId: string, operator: string) => void;
  setCurrentStep: (recordId: string, step: StepNumber) => void;
  calculateConsistencyHash: () => string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const calculateHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export const useAppStore = create<AppState>((set, get) => ({
  records: mockRecords,
  history: mockHistory,
  currentUser: { name: '阿宁', role: 'aning' },

  getRecordById: (id) => get().records.find(r => r.id === id),

  getHistoryByRecordId: (id) => get().history[id] || [],

  updateRecordStatus: (recordId, status, operator, remark) => {
    set((state) => {
      const record = state.records.find(r => r.id === recordId);
      if (!record) return state;

      const oldStatus = record.status;
      const newRecords = state.records.map(r => 
        r.id === recordId 
          ? { ...r, status, updatedAt: new Date() }
          : r
      );

      const historyEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'update_status',
        operator,
        operatorRole: get().currentUser.role,
        timestamp: new Date(),
        field: 'status',
        oldValue: oldStatus,
        newValue: status,
        remark: remark || `状态变更：${oldStatus} → ${status}`,
      };

      const newHistory = {
        ...state.history,
        [recordId]: [...(state.history[recordId] || []), historyEntry],
      };

      return { records: newRecords, history: newHistory };
    });
  },

  addSamplingPoint: (recordId, sampling) => {
    set((state) => {
      const record = state.records.find(r => r.id === recordId);
      if (!record) return state;

      const newRecords = state.records.map(r => 
        r.id === recordId 
          ? { 
              ...r, 
              samplingPoint: sampling, 
              status: 'sampling_reviewed' as const,
              currentStep: 2 as StepNumber,
              updatedAt: new Date(),
            }
          : r
      );

      const historyEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'add_sampling',
        operator: get().currentUser.name,
        operatorRole: get().currentUser.role,
        timestamp: new Date(),
        field: 'samplingPoint',
        oldValue: record.samplingPoint,
        newValue: sampling,
        remark: '阿宁补看夜间采样点',
      };

      const newHistory = {
        ...state.history,
        [recordId]: [...(state.history[recordId] || []), historyEntry],
      };

      return { records: newRecords, history: newHistory };
    });
  },

  updateSummary: (recordId, summary) => {
    set((state) => {
      const record = state.records.find(r => r.id === recordId);
      if (!record) return state;

      const newRecords = state.records.map(r => 
        r.id === recordId 
          ? { 
              ...r, 
              summary, 
              status: 'summary_updated' as const,
              currentStep: 3 as StepNumber,
              updatedAt: new Date(),
            }
          : r
      );

      const historyEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'update_summary',
        operator: get().currentUser.name,
        operatorRole: get().currentUser.role,
        timestamp: new Date(),
        field: 'summary',
        oldValue: record.summary,
        newValue: summary,
        remark: '更新街道会看摘要',
      };

      const newHistory = {
        ...state.history,
        [recordId]: [...(state.history[recordId] || []), historyEntry],
      };

      return { records: newRecords, history: newHistory };
    });
  },

  confirmFinalName: (recordId, finalName, operator) => {
    set((state) => {
      const record = state.records.find(r => r.id === recordId);
      if (!record) return state;

      const newRecords = state.records.map(r => 
        r.id === recordId 
          ? { 
              ...r, 
              communityFinalName: finalName, 
              updatedAt: new Date(),
            }
          : r
      );

      const historyEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'confirm_name',
        operator,
        operatorRole: 'inspector',
        timestamp: new Date(),
        field: 'communityFinalName',
        oldValue: record.communityFinalName,
        newValue: finalName,
        remark: `巡检员确认最终名称：${finalName}`,
      };

      const newHistory = {
        ...state.history,
        [recordId]: [...(state.history[recordId] || []), historyEntry],
      };

      return { records: newRecords, history: newHistory };
    });
  },

  rollbackToHistory: (recordId, historyId, operator) => {
    set((state) => {
      const recordHistory = state.history[recordId];
      if (!recordHistory) return state;

      const targetIndex = recordHistory.findIndex(h => h.id === historyId);
      if (targetIndex === -1) return state;

      const currentRecord = state.records.find(r => r.id === recordId);
      if (!currentRecord) return state;

      let restoredRecord = deepClone(currentRecord);
      for (let i = recordHistory.length - 1; i >= targetIndex; i--) {
        const entry = recordHistory[i];
        if (entry.field && entry.oldValue !== undefined) {
          (restoredRecord as unknown as Record<string, unknown>)[entry.field] = entry.oldValue;
        }
      }
      restoredRecord.updatedAt = new Date();

      const rollbackEntry: HistoryEntry = {
        id: `h-${generateId()}`,
        recordId,
        action: 'rollback',
        operator,
        operatorRole: get().currentUser.role,
        timestamp: new Date(),
        oldValue: currentRecord,
        newValue: restoredRecord,
        remark: `回滚到操作：${recordHistory[targetIndex].remark || recordHistory[targetIndex].action}`,
      };

      const newRecords = state.records.map(r => 
        r.id === recordId ? restoredRecord : r
      );

      const newHistory = {
        ...state.history,
        [recordId]: [...recordHistory, rollbackEntry],
      };

      return { records: newRecords, history: newHistory };
    });
  },

  setCurrentStep: (recordId, step) => {
    set((state) => ({
      records: state.records.map(r => 
        r.id === recordId 
          ? { ...r, currentStep: step, updatedAt: new Date() }
          : r
      ),
    }));
  },

  calculateConsistencyHash: () => {
    const { records } = get();
    const dataStr = JSON.stringify(records);
    return calculateHash(dataStr);
  },
}));
