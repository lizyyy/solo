import { create } from 'zustand';
import type {
  AppState,
  Loan,
  RiskReport,
  AnomalyMark,
  FilterConditions,
  AuditLog,
  DataSnapshot,
  GuaranteeType,
  ViewMode,
} from '@/types';
import { generateAllMockData } from '@/data/mockData';

function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substr(2, 6)}`;
}

const initialMockData = generateAllMockData();

const initialFilters: FilterConditions = {
  industries: [],
  maturityBuckets: [],
  riskRatings: [],
  guaranteeTypes: [],
  hasAnomaly: null,
  principalRange: [0, 500000000],
};

export const useAppStore = create<
  AppState & {
    setFilters: (filters: Partial<FilterConditions>) => void;
    resetFilters: () => void;
    selectLoan: (loanId: string | null) => void;
    selectSnapshot: (snapshotId: string | null) => void;
    selectCompareSnapshot: (snapshotId: string | null) => void;
    setViewMode: (mode: ViewMode) => void;
    updateLoanRiskRating: (loanId: string, newRating: string, reason: string) => void;
    updateRiskReport: (loanId: string, adjustedValue: string, conclusion: string, adjustReason: string) => void;
    resolveAnomaly: (anomalyId: string) => void;
    createSnapshot: (name: string) => void;
    addAuditLog: (log: Omit<AuditLog, 'id' | 'changedAt'>) => void;
    getFilteredLoans: () => Loan[];
    getLoanAnomalies: (loanId: string) => AnomalyMark[];
    getLoanReport: (loanId: string) => RiskReport | undefined;
    getLoanGuaranteeTypes: (loanId: string) => GuaranteeType[];
  }
>((set, get) => ({
  ...initialMockData,
  filters: initialFilters,
  selectedLoanId: null,
  selectedSnapshotId: null,
  compareSnapshotId: null,
  viewMode: 'terrain',

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () => set({ filters: initialFilters }),

  selectLoan: (loanId) => set({ selectedLoanId: loanId }),

  selectSnapshot: (snapshotId) => set({ selectedSnapshotId: snapshotId }),

  selectCompareSnapshot: (snapshotId) => set({ compareSnapshotId: snapshotId }),

  setViewMode: (mode) => set({ viewMode: mode }),

  updateLoanRiskRating: (loanId, newRating, reason) => {
    const state = get();
    const loan = state.loans.find((l) => l.id === loanId);
    if (!loan) return;

    const oldRating = loan.riskRatingCode;

    set({
      loans: state.loans.map((l) =>
        l.id === loanId ? { ...l, riskRatingCode: newRating, updatedAt: new Date().toISOString() } : l
      ),
    });

    get().addAuditLog({
      loanId,
      fieldName: 'riskRatingCode',
      oldValue: oldRating,
      newValue: newRating,
      changeReason: reason,
      changedBy: '风控分析师',
    });
  },

  updateRiskReport: (loanId, adjustedValue, conclusion, adjustReason) => {
    const state = get();
    const existingReport = state.reports.find((r) => r.loanId === loanId);

    if (existingReport) {
      const oldAdjusted = existingReport.adjustedValue;
      const oldConclusion = existingReport.conclusion;

      const hasConflict = existingReport.conclusion && existingReport.conclusion !== conclusion;

      if (hasConflict) {
        let confirmed = true;
        if (typeof window !== 'undefined' && window.confirm) {
          try {
            confirmed = window.confirm(
              '检测到已有结论被修改。旧结论将被保留在审计日志中，是否继续？'
            );
          } catch {
            confirmed = true;
          }
        }
        if (!confirmed) return;
      }

      set({
        reports: state.reports.map((r) =>
          r.loanId === loanId
            ? {
                ...r,
                adjustedValue,
                conclusion,
                adjustReason,
                createdAt: new Date().toISOString(),
              }
            : r
        ),
      });

      if (oldAdjusted !== adjustedValue) {
        get().addAuditLog({
          loanId,
          fieldName: 'report.adjustedValue',
          oldValue: oldAdjusted,
          newValue: adjustedValue,
          changeReason: adjustReason,
          changedBy: '风控分析师',
        });
      }

      if (oldConclusion !== conclusion) {
        get().addAuditLog({
          loanId,
          fieldName: 'report.conclusion',
          oldValue: oldConclusion,
          newValue: conclusion,
          changeReason: adjustReason,
          changedBy: '风控分析师',
        });
      }
    }
  },

  resolveAnomaly: (anomalyId) => {
    const state = get();
    set({
      anomalies: state.anomalies.map((a) =>
        a.id === anomalyId ? { ...a, resolved: true } : a
      ),
    });
  },

  createSnapshot: (name) => {
    const state = get();
    const newSnapshot: DataSnapshot = {
      id: generateId('SNAP'),
      name,
      createdAt: new Date().toISOString(),
      data: {
        loans: JSON.parse(JSON.stringify(state.loans)),
        reports: JSON.parse(JSON.stringify(state.reports)),
        anomalies: JSON.parse(JSON.stringify(state.anomalies)),
      },
      createdBy: '风控分析师',
    };

    set({
      snapshots: [...state.snapshots, newSnapshot],
    });
  },

  addAuditLog: (log) => {
    const state = get();
    const newLog: AuditLog = {
      ...log,
      id: generateId('AUDIT'),
      changedAt: new Date().toISOString(),
    };

    set({
      auditLogs: [...state.auditLogs, newLog],
    });
  },

  getFilteredLoans: () => {
    const state = get();
    const { filters, loans, guarantees, anomalies } = state;

    return loans.filter((loan) => {
      if (filters.industries.length > 0 && !filters.industries.includes(loan.industryCode)) {
        return false;
      }

      if (filters.maturityBuckets.length > 0 && !filters.maturityBuckets.includes(loan.maturityBucketCode)) {
        return false;
      }

      if (filters.riskRatings.length > 0 && !filters.riskRatings.includes(loan.riskRatingCode)) {
        return false;
      }

      if (filters.guaranteeTypes.length > 0) {
        const loanGuaranteeTypes = guarantees
          .filter((g) => g.loanId === loan.id)
          .map((g) => g.type);
        if (!loanGuaranteeTypes.some((t) => filters.guaranteeTypes.includes(t))) {
          return false;
        }
      }

      if (filters.hasAnomaly !== null) {
        const hasAnomaly = anomalies.some((a) => a.loanId === loan.id && !a.resolved);
        if (filters.hasAnomaly !== hasAnomaly) {
          return false;
        }
      }

      if (loan.principal < filters.principalRange[0] || loan.principal > filters.principalRange[1]) {
        return false;
      }

      return true;
    });
  },

  getLoanAnomalies: (loanId) => {
    return get().anomalies.filter((a) => a.loanId === loanId);
  },

  getLoanReport: (loanId) => {
    return get().reports.find((r) => r.loanId === loanId);
  },

  getLoanGuaranteeTypes: (loanId) => {
    return get().guarantees.filter((g) => g.loanId === loanId).map((g) => g.type);
  },
}));
