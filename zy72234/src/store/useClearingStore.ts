import { create } from 'zustand';
import type {
  TailAdjustment,
  CustodyConfirmation,
  ProcessNode,
  OverviewStats,
  ChartDataPoint,
  PieChartData,
  UserRole,
  ExecutiveSummaryItem,
  ReviewRequest,
  CustodyCreateResult,
  CustodyDiffSnapshot,
} from '@shared/types';
import { generateSummary, isZeroReversed } from '@shared/types';
import { api } from '@/services/api';

interface ClearingState {
  adjustments: TailAdjustment[];
  custodyConfirmations: CustodyConfirmation[];
  processNodes: ProcessNode[];
  chart3DData: ChartDataPoint[];
  pieChartData: PieChartData[];
  diffSnapshots: CustodyDiffSnapshot[];
  currentUser: string;
  currentRole: UserRole;
  loading: boolean;
  error: string | null;

  setCurrentUser: (user: string, role: UserRole) => void;
  fetchAllData: () => Promise<void>;
  getAdjustmentById: (id: string) => TailAdjustment | undefined;
  getCustodyById: (id: string) => CustodyConfirmation | undefined;
  getCustodyByAdjustmentId: (adjustmentId: string) => CustodyConfirmation | undefined;
  getProcessNodesByAdjustmentId: (adjustmentId: string) => ProcessNode[];
  getOverviewStats: () => OverviewStats;
  getExecutiveSummary: () => ExecutiveSummaryItem[];
  getDiffSnapshotByAdjustmentId: (adjustmentId: string) => CustodyDiffSnapshot | undefined;
  updateAdjustmentStatus: (id: string, status: TailAdjustment['status']) => void;
  addProcessNode: (node: Omit<ProcessNode, 'id'>) => void;
  submitReview: (adjustmentId: string, request: ReviewRequest) => void;
  updateCustody: (custody: CustodyConfirmation) => void;
  applyCustodyCreateResult: (result: CustodyCreateResult) => void;
  addAdjustments: (adjustments: TailAdjustment[]) => void;
  navigateToAdjustmentOrCustody: (adjustmentId: string, navigate: (path: string) => void) => void;
}

export const useClearingStore = create<ClearingState>((set, get) => ({
  adjustments: [],
  custodyConfirmations: [],
  processNodes: [],
  chart3DData: [],
  pieChartData: [],
  diffSnapshots: [],
  currentUser: '小周',
  currentRole: 'assistant',
  loading: false,
  error: null,

  setCurrentUser: (user, role) => {
    set({ currentUser: user, currentRole: role });
  },

  fetchAllData: async () => {
    set({ loading: true, error: null });
    try {
      const [adjustments, custodyConfirmations, processNodes, chart3DData, pieChartData] = await Promise.all([
        api.getAdjustments(),
        api.getCustodyConfirmations(),
        api.getProcessNodes(),
        api.get3DChartData(),
        api.getPieChartData(),
      ]);
      set({
        adjustments,
        custodyConfirmations,
        processNodes,
        chart3DData,
        pieChartData,
        loading: false,
      });
    } catch {
      set({ error: '数据加载失败，请刷新页面重试', loading: false });
    }
  },

  getAdjustmentById: (id) => {
    return get().adjustments.find((a) => a.id === id);
  },

  getCustodyById: (id) => {
    return get().custodyConfirmations.find((c) => c.id === id);
  },

  getCustodyByAdjustmentId: (adjustmentId) => {
    return get().custodyConfirmations.find((c) => c.adjustmentId === adjustmentId);
  },

  getProcessNodesByAdjustmentId: (adjustmentId) => {
    return get()
      .processNodes.filter((n) => n.adjustmentId === adjustmentId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  getOverviewStats: () => {
    const adjustments = get().adjustments;
    return {
      total: adjustments.length,
      pendingCustody: adjustments.filter((a) => a.status === 'pending_custody').length,
      pendingReview: adjustments.filter((a) => a.status === 'pending_review').length,
      completed: adjustments.filter((a) => a.status === 'reviewed_normal').length,
      flagged: adjustments.filter((a) => isZeroReversed(a.amount, a.remark)).length,
    };
  },

  getExecutiveSummary: () => {
    const { adjustments, custodyConfirmations } = get();
    return adjustments
      .filter((a) => isZeroReversed(a.amount, a.remark))
      .map((adjustment) => {
        const custody = custodyConfirmations.find((c) => c.adjustmentId === adjustment.id);
        const summary = generateSummary(adjustment, custody);
        return {
          adjustmentId: adjustment.id,
          adjustmentNo: adjustment.adjustmentNo,
          tradeDate: adjustment.tradeDate,
          amount: adjustment.amount,
          remark: adjustment.remark,
          status: adjustment.status,
          ...summary,
          updatedAt: custody?.updateTime || adjustment.importTime,
          custody,
        };
      });
  },

  getDiffSnapshotByAdjustmentId: (adjustmentId) => {
    return get().diffSnapshots.find((s) => s.adjustmentId === adjustmentId);
  },

  updateAdjustmentStatus: (id, status) => {
    set((state) => ({
      adjustments: state.adjustments.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    }));
  },

  addProcessNode: (node) => {
    const newNode: ProcessNode = {
      ...node,
      id: `p${Date.now()}`,
    };
    set((state) => ({
      processNodes: [...state.processNodes, newNode],
    }));
  },

  submitReview: (adjustmentId, request) => {
    const adjustment = get().getAdjustmentById(adjustmentId);
    if (!adjustment) return;

    const newStatus = request.result === 'normal' ? 'reviewed_normal' : 'needs_verification';
    
    set((state) => ({
      adjustments: state.adjustments.map((a) =>
        a.id === adjustmentId
          ? {
              ...a,
              status: newStatus,
              reviewTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
              reviewOperator: request.operator,
              reviewComment: request.comment,
            }
          : a
      ),
    }));

    get().addProcessNode({
      adjustmentId,
      step: 'review',
      operator: request.operator,
      operatorRole: 'risk',
      action: request.result === 'normal' ? '风控复核通过，确认正常' : '风控标记需进一步核实',
      comment: request.comment,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });

    if (request.result === 'normal') {
      get().addProcessNode({
        adjustmentId,
        step: 'complete',
        operator: '系统',
        operatorRole: 'all',
        action: '流程完成，记录归档',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      });
    }
  },

  updateCustody: (custody) => {
    set((state) => {
      const existingIndex = state.custodyConfirmations.findIndex((c) => c.id === custody.id);
      let newCustodyConfirmations;

      if (existingIndex >= 0) {
        newCustodyConfirmations = state.custodyConfirmations.map((c, i) =>
          i === existingIndex ? custody : c
        );
      } else {
        newCustodyConfirmations = [...state.custodyConfirmations, custody];
      }

      const newAdjustments = state.adjustments.map((a) =>
        a.id === custody.adjustmentId
          ? {
              ...a,
              custodyConfirmId: custody.id,
              status: 'pending_review' as const,
            }
          : a
      );

      return {
        custodyConfirmations: newCustodyConfirmations,
        adjustments: newAdjustments,
      };
    });

    get().addProcessNode({
      adjustmentId: custody.adjustmentId,
      step: 'custody',
      operator: get().currentUser,
      operatorRole: get().currentRole,
      action: `补录托管确认页，凭证号 ${custody.voucherNo}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  },

  applyCustodyCreateResult: (result) => {
    const { custody, adjustment, diffSnapshot } = result;

    set((state) => {
      const existingIndex = state.custodyConfirmations.findIndex((c) => c.id === custody.id);
      let newCustodyConfirmations;

      if (existingIndex >= 0) {
        newCustodyConfirmations = state.custodyConfirmations.map((c, i) =>
          i === existingIndex ? custody : c
        );
      } else {
        newCustodyConfirmations = [...state.custodyConfirmations, custody];
      }

      const newAdjustments = state.adjustments.map((a) =>
        a.id === adjustment.id ? adjustment : a
      );

      const existingSnapshotIndex = state.diffSnapshots.findIndex(
        (s) => s.adjustmentId === diffSnapshot.adjustmentId
      );
      let newDiffSnapshots;
      if (existingSnapshotIndex >= 0) {
        newDiffSnapshots = state.diffSnapshots.map((s, i) =>
          i === existingSnapshotIndex ? diffSnapshot : s
        );
      } else {
        newDiffSnapshots = [...state.diffSnapshots, diffSnapshot];
      }

      return {
        custodyConfirmations: newCustodyConfirmations,
        adjustments: newAdjustments,
        diffSnapshots: newDiffSnapshots,
      };
    });

    get().addProcessNode({
      adjustmentId: custody.adjustmentId,
      step: 'custody',
      operator: diffSnapshot.operator,
      operatorRole: 'assistant',
      action: `补录托管确认页，凭证号 ${custody.voucherNo}，状态从 ${diffSnapshot.beforeStatus} 变更为 ${diffSnapshot.afterStatus}`,
      timestamp: diffSnapshot.snapshotTime,
    });
  },

  addAdjustments: (newAdjustments) => {
    set((state) => ({
      adjustments: [...state.adjustments, ...newAdjustments],
    }));

    newAdjustments.forEach((adj) => {
      get().addProcessNode({
        adjustmentId: adj.id,
        step: 'import',
        operator: adj.importOperator,
        operatorRole: 'assistant',
        action: isZeroReversed(adj.amount, adj.remark)
          ? '导入尾差调整条，系统检测金额为0且备注已冲正，标记待风控复核'
          : '导入正常调整记录',
        timestamp: adj.importTime,
      });
    });
  },

  navigateToAdjustmentOrCustody: (adjustmentId, navigate) => {
    const custody = get().getCustodyByAdjustmentId(adjustmentId);
    if (custody) {
      navigate(`/custody/${custody.id}`);
    } else {
      navigate(`/adjustments/${adjustmentId}`);
    }
  },
}));
