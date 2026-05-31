import { create } from 'zustand';
import { InvestmentRecord, RecordStatus, OperationType, OperationLog, Note } from '../types';
import { loadInitialData, saveData } from '../utils/mockData';
import { generateSuggestion } from '../utils/suggestionGenerator';

interface RecordState {
  records: InvestmentRecord[];
  selectedRecordId: string | null;
  statusFilter: RecordStatus | 'all';
  searchQuery: string;
  loadRecords: () => void;
  selectRecord: (id: string | null) => void;
  setStatusFilter: (status: RecordStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  confirmRecord: (recordId: string, diffNote: string) => void;
  suspendRecord: (recordId: string, diffNote: string) => void;
  adjustRecord: (recordId: string, newAmount: number, newSuggestion: string, diffNote: string) => void;
  rollbackRecord: (recordId: string) => void;
  addNote: (recordId: string, content: string) => void;
  getFilteredRecords: () => InvestmentRecord[];
  getSelectedRecord: () => InvestmentRecord | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 10);
const formatDate = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

const createOperationLog = (
  recordId: string,
  type: OperationType,
  operator: string,
  diffNote: string,
  overrides: Partial<OperationLog> = {}
): OperationLog => ({
  id: generateId(),
  recordId,
  type,
  operator,
  diffNote,
  createdAt: formatDate(),
  ...overrides,
});

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  selectedRecordId: null,
  statusFilter: 'all',
  searchQuery: '',

  loadRecords: () => {
    const records = loadInitialData();
    set({ records });
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  setStatusFilter: (status) => set({ statusFilter: status }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  confirmRecord: (recordId, diffNote) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId) {
          const newLog = createOperationLog(
            recordId,
            OperationType.CONFIRM,
            '老曹',
            diffNote,
            { oldStatus: r.status, newStatus: RecordStatus.CONFIRMED }
          );
          return {
            ...r,
            status: RecordStatus.CONFIRMED,
            previousStatus: r.status,
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: formatDate(),
          };
        }
        return r;
      });
      saveData(records);
      return { records };
    });
  },

  suspendRecord: (recordId, diffNote) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId) {
          const newLog = createOperationLog(
            recordId,
            OperationType.SUSPEND,
            '老曹',
            diffNote,
            { oldStatus: r.status, newStatus: RecordStatus.PENDING_MATERIAL }
          );
          return {
            ...r,
            status: RecordStatus.PENDING_MATERIAL,
            previousStatus: r.status,
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: formatDate(),
          };
        }
        return r;
      });
      saveData(records);
      return { records };
    });
  },

  adjustRecord: (recordId, newAmount, newSuggestion, diffNote) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId) {
          const newLog = createOperationLog(
            recordId,
            OperationType.ADJUST,
            '老曹',
            diffNote,
            {
              oldStatus: r.status,
              newStatus: RecordStatus.MANUAL_ADJUSTED,
              oldAmount: r.amount,
              newAmount,
              oldSuggestion: r.suggestion,
              newSuggestion,
            }
          );
          return {
            ...r,
            amount: newAmount,
            status: RecordStatus.MANUAL_ADJUSTED,
            previousStatus: r.status,
            suggestion: newSuggestion,
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: formatDate(),
          };
        }
        return r;
      });
      saveData(records);
      return { records };
    });
  },

  rollbackRecord: (recordId) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId && r.previousStatus) {
          const newLog = createOperationLog(
            recordId,
            OperationType.ROLLBACK,
            '老曹',
            `从当前状态回退至之前状态`,
            { oldStatus: r.status, newStatus: r.previousStatus }
          );
          const previousLog = r.operationLogs[r.operationLogs.length - 2];
          let rolledBackAmount = r.amount;
          let rolledBackSuggestion = r.suggestion;
          if (previousLog?.oldAmount !== undefined) {
            rolledBackAmount = previousLog.oldAmount;
          }
          if (previousLog?.oldSuggestion) {
            rolledBackSuggestion = previousLog.oldSuggestion;
          }
          return {
            ...r,
            amount: rolledBackAmount,
            status: r.previousStatus,
            previousStatus: undefined,
            suggestion: rolledBackSuggestion,
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: formatDate(),
          };
        }
        return r;
      });
      saveData(records);
      return { records };
    });
  },

  addNote: (recordId, content) => {
    set((state) => {
      const records = state.records.map((r) => {
        if (r.id === recordId) {
          const newNote: Note = {
            id: generateId(),
            recordId,
            content,
            author: '老曹',
            createdAt: formatDate(),
          };
          const newLog = createOperationLog(
            recordId,
            OperationType.ADD_NOTE,
            '老曹',
            `添加备注: ${content.slice(0, 30)}...`
          );
          return {
            ...r,
            notes: [...r.notes, newNote],
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: formatDate(),
          };
        }
        return r;
      });
      saveData(records);
      return { records };
    });
  },

  getFilteredRecords: () => {
    const { records, statusFilter, searchQuery } = get();
    return records.filter((r) => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch =
        r.investorName.includes(searchQuery) ||
        r.amount.toString().includes(searchQuery);
      return matchStatus && matchSearch;
    });
  },

  getSelectedRecord: () => {
    const { records, selectedRecordId } = get();
    return records.find((r) => r.id === selectedRecordId);
  },
}));
