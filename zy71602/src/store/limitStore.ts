import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  WalletLimit,
  LimitHistory,
  Transaction,
  WhitelistVersion,
  RiskMark,
  ExportRecord,
  LimitStatus,
  RiskLevel,
} from '../types';
import {
  mockWalletLimits,
  mockLimitHistories,
  mockTransactions,
  mockWhitelistVersions,
  mockRiskMarks,
  mockExportRecords,
} from '../data/mockData';

interface LimitState {
  walletLimits: WalletLimit[];
  limitHistories: LimitHistory[];
  transactions: Transaction[];
  whitelistVersions: WhitelistVersion[];
  riskMarks: RiskMark[];
  exportRecords: ExportRecord[];
  currentOperator: string;
  
  getWalletLimitById: (id: string) => WalletLimit | undefined;
  getHistoriesByWalletId: (id: string) => LimitHistory[];
  getTransactionsByWalletId: (id: string) => Transaction[];
  getWhitelistByWalletId: (id: string) => WhitelistVersion[];
  getRiskMarksByWalletId: (id: string) => RiskMark[];
  getExportRecordsByWalletId: (id: string) => ExportRecord[];
  
  updateWalletLimit: (
    id: string,
    updates: Partial<WalletLimit>,
    remark: string
  ) => void;
  
  updateLimitStatus: (
    id: string,
    newStatus: LimitStatus,
    remark: string
  ) => void;
  
  addWhitelistVersion: (
    walletLimitId: string,
    tempDailyLimit: number,
    tempSingleLimit: number,
    effectiveTime: string,
    expireTime: string
  ) => void;
  
  resolveRiskMark: (riskMarkId: string) => void;
  
  addExportRecord: (record: Omit<ExportRecord, 'id' | 'createdAt'>) => void;
  
  getStatusCounts: () => Record<LimitStatus, number>;
  
  calculateRiskLevel: (walletLimitId: string) => RiskLevel;
  
  checkAndMarkRisks: (walletLimitId: string) => void;
  
  getTransactionSummary: (walletLimitId: string) => {
    totalAmount: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
    duplicateCount: number;
    abnormalCount: number;
  };
  
  getEffectiveLimit: (walletLimitId: string) => {
    dailyLimit: number;
    singleLimit: number;
    isWhitelistActive: boolean;
    activeWhitelist?: WhitelistVersion;
  };
  
  resetToMockData: () => void;
}

const generateId = (prefix: string) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useLimitStore = create<LimitState>()(
  persist(
    (set, get) => ({
      walletLimits: mockWalletLimits,
      limitHistories: mockLimitHistories,
      transactions: mockTransactions,
      whitelistVersions: mockWhitelistVersions,
      riskMarks: mockRiskMarks,
      exportRecords: mockExportRecords,
      currentOperator: '当前操作员',

      getWalletLimitById: (id) => {
        return get().walletLimits.find((w) => w.id === id);
      },

      getHistoriesByWalletId: (id) => {
        return get()
          .limitHistories.filter((h) => h.walletLimitId === id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      getTransactionsByWalletId: (id) => {
        return get()
          .transactions.filter((t) => t.walletLimitId === id)
          .sort(
            (a, b) =>
              new Date(b.transactionTime).getTime() - new Date(a.transactionTime).getTime()
          );
      },

      getWhitelistByWalletId: (id) => {
        return get()
          .whitelistVersions.filter((w) => w.walletLimitId === id)
          .sort((a, b) => b.version - a.version);
      },

      getRiskMarksByWalletId: (id) => {
        return get()
          .riskMarks.filter((r) => r.walletLimitId === id)
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      },

      getExportRecordsByWalletId: (id) => {
        return get()
          .exportRecords.filter((e) => e.walletLimitId === id)
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      },

      updateWalletLimit: (id, updates, remark) => {
        const state = get();
        const walletLimit = state.walletLimits.find((w) => w.id === id);
        if (!walletLimit) return;

        const newHistory: LimitHistory = {
          id: generateId('lh'),
          walletLimitId: id,
          beforeDailyLimit: walletLimit.dailyLimit,
          afterDailyLimit: updates.dailyLimit ?? walletLimit.dailyLimit,
          beforeSingleLimit: walletLimit.singleLimit,
          afterSingleLimit: updates.singleLimit ?? walletLimit.singleLimit,
          beforeStatus: walletLimit.status,
          afterStatus: updates.status ?? walletLimit.status,
          operator: state.currentOperator,
          remark,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          walletLimits: state.walletLimits.map((w) =>
            w.id === id ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
          ),
          limitHistories: [...state.limitHistories, newHistory],
        }));

        get().checkAndMarkRisks(id);
      },

      updateLimitStatus: (id, newStatus, remark) => {
        get().updateWalletLimit(id, { status: newStatus }, remark);
      },

      addWhitelistVersion: (
        walletLimitId,
        tempDailyLimit,
        tempSingleLimit,
        effectiveTime,
        expireTime
      ) => {
        const state = get();
        const existingVersions = state.getWhitelistByWalletId(walletLimitId);
        const newVersion: WhitelistVersion = {
          id: generateId('wv'),
          walletLimitId,
          version: existingVersions.length + 1,
          tempDailyLimit,
          tempSingleLimit,
          effectiveTime,
          expireTime,
          status: 'pending',
          creator: state.currentOperator,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          whitelistVersions: [...state.whitelistVersions, newVersion],
        }));
      },

      resolveRiskMark: (riskMarkId) => {
        set((state) => ({
          riskMarks: state.riskMarks.map((r) =>
            r.id === riskMarkId ? { ...r, isResolved: true } : r
          ),
        }));
      },

      addExportRecord: (record) => {
        set((state) => ({
          exportRecords: [
            ...state.exportRecords,
            {
              ...record,
              id: generateId('er'),
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      getStatusCounts: () => {
        const counts: Record<LimitStatus, number> = {
          pending: 0,
          processing: 0,
          approved: 0,
          rejected: 0,
          to_confirm: 0,
        };

        get().walletLimits.forEach((w) => {
          counts[w.status]++;
        });

        return counts;
      },

      calculateRiskLevel: (walletLimitId): RiskLevel => {
        const state = get();
        const unresolvedRisks = state
          .getRiskMarksByWalletId(walletLimitId)
          .filter((r) => !r.isResolved);

        if (unresolvedRisks.some((r) => r.level === 'critical')) return 'critical';
        if (unresolvedRisks.some((r) => r.level === 'high')) return 'high';
        if (unresolvedRisks.some((r) => r.level === 'medium')) return 'medium';
        return 'low';
      },

      checkAndMarkRisks: (walletLimitId) => {
        const state = get();
        const walletLimit = state.getWalletLimitById(walletLimitId);
        if (!walletLimit) return;

        const transactions = state.getTransactionsByWalletId(walletLimitId);
        const whitelistVersions = state.getWhitelistByWalletId(walletLimitId);
        const now = new Date();

        const newRiskMarks: RiskMark[] = [];
        const existingRiskTypes = state
          .getRiskMarksByWalletId(walletLimitId)
          .filter((r) => !r.isResolved)
          .map((r) => r.type);

        const usedRatio = walletLimit.usedDailyLimit / walletLimit.dailyLimit;
        if (usedRatio >= 0.9 && !existingRiskTypes.includes('limit_exceeded')) {
          newRiskMarks.push({
            id: generateId('rm'),
            walletLimitId,
            type: 'limit_exceeded',
            level: usedRatio >= 0.99 ? 'critical' : 'high',
            description: `当日累计交易${walletLimit.usedDailyLimit.toLocaleString()}元，已达日限额${(usedRatio * 100).toFixed(1)}%`,
            isResolved: false,
            createdAt: now.toISOString(),
          });
        }

        const activeWhitelist = whitelistVersions.find((w) => w.status === 'active');
        if (activeWhitelist && new Date(activeWhitelist.expireTime) < now) {
          if (!existingRiskTypes.includes('whitelist_expired')) {
            newRiskMarks.push({
              id: generateId('rm'),
              walletLimitId,
              type: 'whitelist_expired',
              level: 'critical',
              description: '临时白名单已过期，请检查是否有超限交易通过',
              isResolved: false,
              createdAt: now.toISOString(),
            });
          }
        }

        const transactionNos = transactions.map((t) => t.transactionNo);
        const hasDuplicates = transactionNos.length !== new Set(transactionNos).size;
        if (hasDuplicates && !existingRiskTypes.includes('duplicate_transaction')) {
          newRiskMarks.push({
            id: generateId('rm'),
            walletLimitId,
            type: 'duplicate_transaction',
            level: 'high',
            description: '检测到重复交易，请核实交易真实性',
            isResolved: false,
            createdAt: now.toISOString(),
          });
        }

        if (newRiskMarks.length > 0) {
          set((state) => ({
            riskMarks: [...state.riskMarks, ...newRiskMarks],
            walletLimits: state.walletLimits.map((w) =>
              w.id === walletLimitId ? { ...w, status: 'to_confirm' } : w
            ),
          }));
        }
      },

      getTransactionSummary: (walletLimitId) => {
        const transactions = get().getTransactionsByWalletId(walletLimitId);
        return {
          totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
          successCount: transactions.filter((t) => t.status === 'success').length,
          failedCount: transactions.filter((t) => t.status === 'failed').length,
          pendingCount: transactions.filter((t) => t.status === 'pending').length,
          duplicateCount: transactions.filter((t) => t.isDuplicate).length,
          abnormalCount: transactions.filter((t) => t.isAbnormal).length,
        };
      },

      getEffectiveLimit: (walletLimitId) => {
        const state = get();
        const walletLimit = state.getWalletLimitById(walletLimitId);
        const whitelistVersions = state.getWhitelistByWalletId(walletLimitId);
        const now = new Date();

        const activeWhitelist = whitelistVersions.find((w) => {
          const effective = new Date(w.effectiveTime) <= now;
          const notExpired = new Date(w.expireTime) > now;
          return effective && notExpired;
        });

        if (activeWhitelist) {
          return {
            dailyLimit: activeWhitelist.tempDailyLimit,
            singleLimit: activeWhitelist.tempSingleLimit,
            isWhitelistActive: true,
            activeWhitelist,
          };
        }

        return {
          dailyLimit: walletLimit?.dailyLimit ?? 0,
          singleLimit: walletLimit?.singleLimit ?? 0,
          isWhitelistActive: false,
        };
      },

      resetToMockData: () => {
        set({
          walletLimits: mockWalletLimits,
          limitHistories: mockLimitHistories,
          transactions: mockTransactions,
          whitelistVersions: mockWhitelistVersions,
          riskMarks: mockRiskMarks,
          exportRecords: mockExportRecords,
        });
      },
    }),
    {
      name: 'limit-review-storage',
    }
  )
);
