import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FundRedemption, RedemptionStatus, Remark, OperationLog, FilterOptions } from '@/types';
import { mockRedemptions } from '@/data/mockData';
import { OPERATOR, STORAGE_KEY } from '@/data/constants';
import { generateId, formatDateTime } from '@/utils';

interface RedemptionState {
  redemptions: FundRedemption[];
  filters: FilterOptions;
  isInitialized: boolean;
  
  initialize: () => void;
  getById: (id: string) => FundRedemption | undefined;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  changeStatus: (id: string, newStatus: RedemptionStatus, reason: string) => void;
  rollbackStatus: (id: string, reason: string) => void;
  addRemark: (id: string, content: string) => void;
  refreshMockData: () => void;
}

const defaultFilters: FilterOptions = {
  status: 'all',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
  keyword: '',
};

export const useRedemptionStore = create<RedemptionState>()(
  persist(
    (set, get) => ({
      redemptions: [],
      filters: defaultFilters,
      isInitialized: false,

      initialize: () => {
        const state = get();
        if (!state.isInitialized && state.redemptions.length === 0) {
          set({ redemptions: mockRedemptions, isInitialized: true });
        } else if (state.redemptions.length > 0) {
          set({ isInitialized: true });
        }
      },

      getById: (id: string) => {
        return get().redemptions.find(r => r.id === id);
      },

      setFilters: (filters: Partial<FilterOptions>) => {
        set(state => ({ filters: { ...state.filters, ...filters } }));
      },

      resetFilters: () => {
        set({ filters: defaultFilters });
      },

      changeStatus: (id: string, newStatus: RedemptionStatus, reason: string) => {
        set(state => {
          const now = new Date().toISOString();
          const redemptions = state.redemptions.map(r => {
            if (r.id === id) {
              const log: OperationLog = {
                id: generateId(),
                action: newStatus,
                fromStatus: r.status,
                toStatus: newStatus,
                reason,
                operator: OPERATOR,
                createdAt: formatDateTime(now),
              };
              return {
                ...r,
                status: newStatus,
                previousStatus: r.status,
                operationLogs: [...r.operationLogs, log],
                updatedAt: formatDateTime(now),
              };
            }
            return r;
          });
          return { redemptions };
        });
      },

      rollbackStatus: (id: string, reason: string) => {
        set(state => {
          const redemption = state.redemptions.find(r => r.id === id);
          if (!redemption || !redemption.previousStatus) return state;

          const now = new Date().toISOString();
          const redemptions = state.redemptions.map(r => {
            if (r.id === id) {
              const log: OperationLog = {
                id: generateId(),
                action: 'rollback',
                fromStatus: r.status,
                toStatus: r.previousStatus!,
                reason,
                operator: OPERATOR,
                createdAt: formatDateTime(now),
              };
              return {
                ...r,
                status: r.previousStatus!,
                previousStatus: r.status,
                operationLogs: [...r.operationLogs, log],
                updatedAt: formatDateTime(now),
              };
            }
            return r;
          });
          return { redemptions };
        });
      },

      addRemark: (id: string, content: string) => {
        set(state => {
          const now = new Date().toISOString();
          const remark: Remark = {
            id: generateId(),
            content,
            operator: OPERATOR,
            createdAt: formatDateTime(now),
          };
          const redemptions = state.redemptions.map(r => {
            if (r.id === id) {
              return {
                ...r,
                remarks: [remark, ...r.remarks],
                updatedAt: formatDateTime(now),
              };
            }
            return r;
          });
          return { redemptions };
        });
      },

      refreshMockData: () => {
        set({ redemptions: mockRedemptions, isInitialized: true });
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
