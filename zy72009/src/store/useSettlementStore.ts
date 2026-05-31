import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Settlement,
  SettlementFilters,
  SettlementStatus,
  ImportStrategy,
  ImportResult,
  OperationLog,
  Note,
} from '../types';
import { mockSettlements } from '../data/mockData';
import { generateSuggestion, getOperatorName } from '../utils/suggestion';
import { validateSettlementData, hasCriticalIssues } from '../utils/validator';
import { parseExcelFile, transformToSettlements, processImport, exportToExcel } from '../utils/excel';
import { now } from '../utils/date';
import { isDateInRange } from '../utils/date';

interface SettlementStore {
  settlements: Settlement[];
  filters: SettlementFilters;
  loading: boolean;
  initialized: boolean;

  init: () => void;
  getSettlementById: (id: string) => Settlement | undefined;
  getFilteredSettlements: () => Settlement[];
  setFilters: (filters: Partial<SettlementFilters>) => void;

  confirmSettlement: (id: string) => void;
  requestMaterial: (id: string, reason: string) => void;
  manualAdjust: (id: string, newAmount: number, reason: string) => void;
  rollback: (id: string, reason: string, targetStatus: SettlementStatus) => void;

  addNote: (id: string, content: string) => void;

  importData: (file: File, strategy: ImportStrategy) => Promise<ImportResult>;
  exportData: (status?: SettlementStatus | 'all') => void;

  validateSettlement: (id: string) => ReturnType<typeof validateSettlementData>;
  getProcessingSuggestion: (id: string) => string;

  getStats: () => {
    confirmed: number;
    needMaterial: number;
    manualAdjust: number;
    pending: number;
    conflict: number;
  };
}

const STORAGE_KEY = 'settlement_data_v1';
const INIT_FLAG = 'settlement_initialized_v1';

function createOperationLog(
  action: string,
  reason: string,
  fromStatus: SettlementStatus | null,
  toStatus: SettlementStatus
): OperationLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    operator: getOperatorName(),
    operatedAt: now(),
    reason,
    fromStatus,
    toStatus,
  };
}

export const useSettlementStore = create<SettlementStore>()(
  persist(
    (set, get) => ({
      settlements: [],
      filters: {
        status: 'all',
        keyword: '',
        dateRange: null,
      },
      loading: false,
      initialized: false,

      init: () => {
        const initFlag = localStorage.getItem(INIT_FLAG);
        if (!initFlag) {
          set({ settlements: mockSettlements, initialized: true });
          localStorage.setItem(INIT_FLAG, 'true');
        } else {
          set({ initialized: true });
        }
      },

      getSettlementById: (id: string) => {
        return get().settlements.find(s => s.id === id);
      },

      getFilteredSettlements: () => {
        const { settlements, filters } = get();
        return settlements.filter(s => {
          if (filters.status !== 'all' && s.status !== filters.status) return false;
          if (filters.keyword) {
            const kw = filters.keyword.toLowerCase();
            if (
              !s.id.toLowerCase().includes(kw) &&
              !s.merchantName.toLowerCase().includes(kw)
            ) {
              return false;
            }
          }
          if (filters.dateRange && !isDateInRange(s.createdAt, filters.dateRange)) {
            return false;
          }
          return true;
        });
      },

      setFilters: (filters) => {
        set(state => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      confirmSettlement: (id: string) => {
        const settlement = get().getSettlementById(id);
        if (!settlement) return;

        const issues = validateSettlementData(settlement);
        if (hasCriticalIssues(issues)) {
          throw new Error('存在数据错误，请先修正后再确认');
        }

        set(state => ({
          settlements: state.settlements.map(s => {
            if (s.id !== id) return s;
            const log = createOperationLog('确认通过', '三单核对一致', s.status, 'confirmed');
            return {
              ...s,
              status: 'confirmed',
              updatedAt: now(),
              operator: getOperatorName(),
              operationLogs: [...s.operationLogs, log],
            };
          }),
        }));
      },

      requestMaterial: (id: string, reason: string) => {
        set(state => ({
          settlements: state.settlements.map(s => {
            if (s.id !== id) return s;
            const log = createOperationLog('退回补材料', reason, s.status, 'need_material');
            return {
              ...s,
              status: 'need_material',
              updatedAt: now(),
              operator: getOperatorName(),
              operationLogs: [...s.operationLogs, log],
            };
          }),
        }));
      },

      manualAdjust: (id: string, newAmount: number, reason: string) => {
        set(state => ({
          settlements: state.settlements.map(s => {
            if (s.id !== id) return s;
            const log = createOperationLog('人工改判', reason, s.status, 'manual_adjust');
            return {
              ...s,
              originalAmount: s.amount,
              amount: newAmount,
              status: 'manual_adjust',
              adjustmentReason: reason,
              updatedAt: now(),
              operator: getOperatorName(),
              operationLogs: [...s.operationLogs, log],
            };
          }),
        }));
      },

      rollback: (id: string, reason: string, targetStatus: SettlementStatus) => {
        set(state => ({
          settlements: state.settlements.map(s => {
            if (s.id !== id) return s;
            const log = createOperationLog('回退', reason, s.status, targetStatus);
            return {
              ...s,
              status: targetStatus,
              updatedAt: now(),
              operator: getOperatorName(),
              operationLogs: [...s.operationLogs, log],
            };
          }),
        }));
      },

      addNote: (id: string, content: string) => {
        const note: Note = {
          id: `note-${Date.now()}`,
          content,
          author: getOperatorName(),
          createdAt: now(),
        };
        set(state => ({
          settlements: state.settlements.map(s => {
            if (s.id !== id) return s;
            return {
              ...s,
              notes: [...s.notes, note],
            };
          }),
        }));
      },

      importData: async (file: File, strategy: ImportStrategy): Promise<ImportResult> => {
        set({ loading: true });
        try {
          const rawData = await parseExcelFile(file);
          const { settlements: parsed, errors } = transformToSettlements(rawData);
          const { result, finalSettlements } = processImport(
            parsed,
            get().settlements,
            strategy
          );
          result.errors = [...result.errors, ...errors];
          set({ settlements: finalSettlements });
          return result;
        } finally {
          set({ loading: false });
        }
      },

      exportData: (status?: SettlementStatus | 'all') => {
        exportToExcel(get().settlements, status);
      },

      validateSettlement: (id: string) => {
        const s = get().getSettlementById(id);
        if (!s) return [];
        return validateSettlementData(s);
      },

      getProcessingSuggestion: (id: string) => {
        const s = get().getSettlementById(id);
        if (!s) return '';
        return generateSuggestion(s);
      },

      getStats: () => {
        const { settlements } = get();
        return {
          confirmed: settlements.filter(s => s.status === 'confirmed').length,
          needMaterial: settlements.filter(s => s.status === 'need_material').length,
          manualAdjust: settlements.filter(s => s.status === 'manual_adjust').length,
          pending: settlements.filter(s => s.status === 'pending').length,
          conflict: settlements.filter(s => s.status === 'conflict').length,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        settlements: state.settlements,
      }),
    }
  )
);
