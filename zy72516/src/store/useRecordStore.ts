import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AnnotationRecord, RecordStatus, JudgmentLog } from '../types';
import { generateMockRecords } from '../utils/mockData';
import { applyBoundaryRules } from '../utils/boundaryRules';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

interface RecordState {
  records: AnnotationRecord[];
  currentOperator: string;
  initialized: boolean;

  initMockData: () => void;
  addRecords: (newRecords: AnnotationRecord[]) => void;
  updateRecordStatus: (
    recordId: string,
    newStatus: RecordStatus,
    remark?: string
  ) => void;
  batchUpdateStatus: (
    recordIds: string[],
    newStatus: RecordStatus,
    remark?: string
  ) => void;
  getRecordById: (id: string) => AnnotationRecord | undefined;
  getRecordsByStatus: (status: RecordStatus) => AnnotationRecord[];
  getConflictSamples: () => AnnotationRecord[];
  clearAll: () => void;
  setOperator: (name: string) => void;
}

export const useRecordStore = create<RecordState>()(
  persist(
    (set, get) => ({
      records: [],
      currentOperator: '阿宁',
      initialized: false,

      initMockData: () => {
        if (get().initialized) return;
        const mockData = generateMockRecords(10);
        set({ records: mockData, initialized: true });
      },

      addRecords: (newRecords) => {
        const processed = newRecords.map(record => {
          const ruleResult = applyBoundaryRules(record, get().currentOperator);
          return {
            ...record,
            ...ruleResult
          };
        });
        set(state => ({
          records: [...state.records, ...processed]
        }));
      },

      updateRecordStatus: (recordId, newStatus, remark = '') => {
        set(state => ({
          records: state.records.map(record => {
            if (record.id !== recordId) return record;

            const log: JudgmentLog = {
              id: generateId(),
              recordId,
              operator: state.currentOperator,
              action: '状态变更',
              remark,
              fromStatus: record.currentStatus,
              toStatus: newStatus,
              operatedAt: new Date().toISOString()
            };

            return {
              ...record,
              currentStatus: newStatus,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      batchUpdateStatus: (recordIds, newStatus, remark = '') => {
        set(state => ({
          records: state.records.map(record => {
            if (!recordIds.includes(record.id)) return record;

            const log: JudgmentLog = {
              id: generateId(),
              recordId: record.id,
              operator: state.currentOperator,
              action: '批量状态变更',
              remark,
              fromStatus: record.currentStatus,
              toStatus: newStatus,
              operatedAt: new Date().toISOString()
            };

            return {
              ...record,
              currentStatus: newStatus,
              judgmentLogs: [...record.judgmentLogs, log],
              updatedAt: new Date().toISOString(),
              lastOperator: state.currentOperator
            };
          })
        }));
      },

      getRecordById: (id) => {
        return get().records.find(r => r.id === id);
      },

      getRecordsByStatus: (status) => {
        return get().records.filter(r => r.currentStatus === status);
      },

      getConflictSamples: () => {
        return get().records.filter(r =>
          r.currentStatus === RecordStatus.PM_REVIEW ||
          r.currentStatus === RecordStatus.WRONG_CRITERIA ||
          r.currentStatus === RecordStatus.REWORK
        );
      },

      clearAll: () => {
        set({ records: [], initialized: false });
      },

      setOperator: (name) => {
        set({ currentOperator: name });
      }
    }),
    {
      name: 'after-sales-robot-storage',
      partialize: (state) => ({
        records: state.records,
        currentOperator: state.currentOperator,
        initialized: state.initialized
      })
    }
  )
);
