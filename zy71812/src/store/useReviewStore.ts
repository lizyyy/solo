import { create } from 'zustand';
import { produce } from 'immer';
import { persist } from 'zustand/middleware';

import type {
  RateTable,
  RefundItem,
  OperationLog,
  ManualConfirmation,
  Anomaly,
  AnomalyStatus,
  FilterState,
  ConfirmationConclusion,
} from '../types';
import { generateMockData } from '../data/mockData';
import { runAnomalyDetection } from '../utils/anomalyDetector';
import { sha256, calculateEvidenceChainHash, calculateDataHash } from '../utils/hash';

interface ReviewState {
  rates: RateTable[];
  refunds: RefundItem[];
  operations: OperationLog[];
  selectedRefundId: string | null;
  filters: FilterState;
  isLoading: boolean;
  currentOperator: string;
  initialized: boolean;

  initializeData: () => Promise<void>;
  selectRefund: (id: string | null) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  addManualConfirmation: (
    refundId: string,
    anomalyId: string,
    conclusion: ConfirmationConclusion,
    explanation: string,
    reconciliationNote: string
  ) => Promise<void>;
  updateAnomalyStatus: (
    refundId: string,
    anomalyId: string,
    status: AnomalyStatus
  ) => void;
  addOperationLog: (
    refundId: string,
    action: OperationLog['action'],
    oldValue: any,
    newValue: any,
    remark: string
  ) => Promise<void>;
  getFilteredRefunds: () => RefundItem[];
  getRateById: (id: string) => RateTable | undefined;
  getPendingCount: () => number;
  getAnomalyCount: () => number;
  resetData: () => Promise<void>;
}

const initialFilters: FilterState = {
  supplierId: '',
  status: 'all',
  anomalyType: 'all',
  dateRange: {
    start: '',
    end: '',
  },
  searchKeyword: '',
};

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      rates: [],
      refunds: [],
      operations: [],
      selectedRefundId: null,
      filters: initialFilters,
      isLoading: false,
      currentOperator: '李复核员',
      initialized: false,

      initializeData: async () => {
        if (get().initialized) return;
        
        set({ isLoading: true });
        try {
          const { rates, refunds, operations } = await generateMockData();
          const processedRefunds = runAnomalyDetection(refunds);
          
          set({
            rates,
            refunds: processedRefunds,
            operations,
            initialized: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Failed to initialize data:', error);
          set({ isLoading: false });
        }
      },

      selectRefund: (id) => {
        set({ selectedRefundId: id });
      },

      setFilters: (newFilters) => {
        set(
          produce((state) => {
            state.filters = { ...state.filters, ...newFilters };
          })
        );
      },

      addManualConfirmation: async (
        refundId,
        anomalyId,
        conclusion,
        explanation,
        reconciliationNote
      ) => {
        const state = get();
        const refund = state.refunds.find((r) => r.id === refundId);
        if (!refund) return;

        const rate = state.getRateById(refund.rateId);
        const evidenceChainHash = await calculateEvidenceChainHash(
          rate,
          refund,
          refund.attachments,
          refund.confirmations
        );

        const confirmation: ManualConfirmation = {
          id: `conf_${refundId}_${Date.now()}`,
          refundId,
          operator: state.currentOperator,
          conclusion,
          explanation,
          reconciliationNote,
          confirmedAt: new Date().toISOString(),
          evidenceChainHash,
        };

        await state.addOperationLog(
          refundId,
          'confirm',
          { anomalyStatus: 'open' },
          { anomalyStatus: 'confirmed', conclusion },
          `人工确认：${conclusion === 'valid' ? '确认有效' : conclusion === 'invalid' ? '确认无效' : '已调整'}`
        );

        set(
          produce((state) => {
            const refundIndex = state.refunds.findIndex(
              (r: RefundItem) => r.id === refundId
            );
            if (refundIndex !== -1) {
              state.refunds[refundIndex].confirmations.push(confirmation);

              const anomalyIndex = state.refunds[
                refundIndex
              ].anomalies.findIndex((a: Anomaly) => a.id === anomalyId);
              if (anomalyIndex !== -1) {
                state.refunds[refundIndex].anomalies[anomalyIndex].status =
                  conclusion === 'invalid' ? 'rejected' : 'confirmed';
              }

              const hasOpenAnomalies = state.refunds[
                refundIndex
              ].anomalies.some((a: Anomaly) => a.status === 'open');
              state.refunds[refundIndex].status = hasOpenAnomalies
                ? 'pending'
                : 'normal';
            }
          })
        );
      },

      updateAnomalyStatus: (refundId, anomalyId, status) => {
        set(
          produce((state) => {
            const refund = state.refunds.find(
              (r: RefundItem) => r.id === refundId
            );
            if (refund) {
              const anomaly = refund.anomalies.find(
                (a: Anomaly) => a.id === anomalyId
              );
              if (anomaly) {
                anomaly.status = status;
              }

              const hasOpenAnomalies = refund.anomalies.some(
                (a: Anomaly) => a.status === 'open'
              );
              refund.status = hasOpenAnomalies ? 'pending' : 'normal';
            }
          })
        );
      },

      addOperationLog: async (refundId, action, oldValue, newValue, remark) => {
        const state = get();
        const snapshotData = {
          refunds: state.refunds,
          timestamp: Date.now(),
        };
        const snapshotHash = await sha256(JSON.stringify(snapshotData));

        const log: OperationLog = {
          id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          refundId,
          operator: state.currentOperator,
          action,
          oldValue,
          newValue,
          remark,
          operatedAt: new Date().toISOString(),
          snapshotHash,
        };

        set(
          produce((state) => {
            state.operations.unshift(log);
          })
        );
      },

      getFilteredRefunds: () => {
        const state = get();
        let filtered = [...state.refunds];

        if (state.filters.supplierId) {
          filtered = filtered.filter(
            (r) => r.supplierId === state.filters.supplierId
          );
        }

        if (state.filters.status !== 'all') {
          filtered = filtered.filter((r) => r.status === state.filters.status);
        }

        if (state.filters.anomalyType !== 'all') {
          filtered = filtered.filter((r) =>
            r.anomalies.some((a) => a.type === state.filters.anomalyType)
          );
        }

        if (state.filters.dateRange.start && state.filters.dateRange.end) {
          filtered = filtered.filter(
            (r) =>
              r.refundDate >= state.filters.dateRange.start &&
              r.refundDate <= state.filters.dateRange.end
          );
        }

        if (state.filters.searchKeyword) {
          const keyword = state.filters.searchKeyword.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.serialNo.toLowerCase().includes(keyword) ||
              r.supplierName.toLowerCase().includes(keyword)
          );
        }

        return filtered.sort(
          (a, b) =>
            new Date(b.refundDate).getTime() - new Date(a.refundDate).getTime()
        );
      },

      getRateById: (id) => {
        return get().rates.find((r) => r.id === id);
      },

      getPendingCount: () => {
        return get().refunds.filter((r) => r.status === 'pending').length;
      },

      getAnomalyCount: () => {
        return get().refunds.filter((r) => r.status === 'anomaly').length;
      },

      resetData: async () => {
        set({ initialized: false });
        await get().initializeData();
      },
    }),
    {
      name: 'review-store',
      partialize: (state) => ({
        refunds: state.refunds,
        operations: state.operations,
        initialized: state.initialized,
      }),
    }
  )
);

export { calculateDataHash };
