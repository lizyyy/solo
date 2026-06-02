import { create } from 'zustand';
import type { 
  SettlementBatch, 
  SettlementDetail, 
  SelfCheckResult,
  ImportRawRow,
  DetailStatus,
  CurrencyReviewDecision,
  OriginalSnapshot,
  AuditLog
} from '../../shared/types.js';
import { batchApi, detailApi, exportApi } from '../utils/api.js';

interface CurrentUser {
  id: string;
  name: string;
  role: 'admin' | 'trustee' | 'risk_control' | 'auditor';
}

interface CreateBatchRequest {
  batchNo: string;
  sourceFile: string;
  sourceType: string;
  totalCount: number;
  records: Array<{
    originalLineNo: number;
    policyNo: string;
    productName: string;
    commissionAmount: number;
    currencyRaw: string;
  }>;
}

interface SettlementState {
  currentUser: CurrentUser;
  batches: SettlementBatch[];
  currentBatch: SettlementBatch | null;
  currentDetails: SettlementDetail[];
  currentSelfCheck: SelfCheckResult[];
  selectedDetail: SettlementDetail | null;
  loading: boolean;
  error: string | null;
  
  setCurrentUser: (user: CurrentUser) => void;
  setSelectedDetail: (detail: SettlementDetail | null) => void;
  loadBatches: () => Promise<void>;
  loadBatch: (id: string) => Promise<void>;
  createBatch: (data: CreateBatchRequest) => Promise<SettlementBatch | null>;
  runSelfCheck: (batchId: string, checkTypes?: string[]) => Promise<void>;
  markRiskReviewed: (batchId: string, updates: Array<{
    detailId: string;
    taxRate?: number;
    taxRateRemark?: string;
    currencyDecision?: CurrencyReviewDecision;
    currencyRemark?: string;
  }>) => Promise<void>;
  markAudited: (batchId: string, updates: Array<{
    detailId: string;
    status: DetailStatus;
    remark?: string;
  }>) => Promise<void>;
  updateDetail: (detailId: string, fieldName: string, value: any, remark?: string) => Promise<void>;
  currencyReview: (detailId: string, decision: CurrencyReviewDecision, remark?: string) => Promise<void>;
  loadDetailAuditTrail: (detailId: string) => Promise<AuditLog[]>;
  loadDetailSnapshot: (snapshotId: string) => Promise<OriginalSnapshot | undefined>;
}

export const useSettlementStore = create<SettlementState>((set, get) => ({
  currentUser: { id: 'u002', name: '老秦', role: 'risk_control' },
  batches: [],
  currentBatch: null,
  currentDetails: [],
  currentSelfCheck: [],
  selectedDetail: null,
  loading: false,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setSelectedDetail: (detail) => set({ selectedDetail: detail }),

  loadBatches: async () => {
    set({ loading: true, error: null });
    try {
      const result = await batchApi.list();
      set({ batches: result.items, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadBatch: async (id) => {
    set({ loading: true, error: null });
    try {
      const batchWithDetails = await batchApi.get(id);
      const checkResults = await batchApi.getSelfCheck(id);
      set({ 
        currentBatch: batchWithDetails, 
        currentDetails: batchWithDetails.details || [],
        currentSelfCheck: checkResults,
        loading: false 
      });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  createBatch: async (data) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      const importRawData: ImportRawRow[] = data.records.map((r, idx) => ({
        lineNo: r.originalLineNo,
        policyNo: r.policyNo,
        productName: r.productName,
        commissionAmount: r.commissionAmount.toString(),
        currency: r.currencyRaw
      }));
      
      const result = await batchApi.create({
        rawData: importRawData,
        operator: currentUser.name,
        importSource: 'PASTE'
      });
      
      await get().loadBatches();
      set({ loading: false });
      return result;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      return null;
    }
  },

  runSelfCheck: async (batchId, checkTypes) => {
    set({ loading: true, error: null });
    try {
      const results = await batchApi.runSelfCheck(batchId, checkTypes);
      set({ currentSelfCheck: results, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  markRiskReviewed: async (batchId, updates) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      await batchApi.riskReview(batchId, {
        operator: currentUser.name,
        updates
      });
      await get().loadBatch(batchId);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  markAudited: async (batchId, updates) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      const statusUpdates = updates.map(u => ({
        detailId: u.detailId,
        newStatus: u.status,
        remark: u.remark
      }));
      await batchApi.auditUpdate(batchId, {
        operator: currentUser.name,
        statusUpdates
      });
      await get().loadBatch(batchId);
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  updateDetail: async (detailId, fieldName, value, remark) => {
    set({ loading: true, error: null });
    try {
      const { currentUser, currentBatch } = get();
      await detailApi.update(detailId, {
        fieldName,
        value,
        remark,
        operator: currentUser.name
      });
      if (currentBatch) {
        await get().loadBatch(currentBatch.id);
      }
      const updated = get().currentDetails.find(d => d.id === detailId);
      if (updated) {
        set({ selectedDetail: updated, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  currencyReview: async (detailId, decision, remark) => {
    set({ loading: true, error: null });
    try {
      const { currentUser, currentBatch } = get();
      await detailApi.currencyReview(detailId, {
        decision,
        remark,
        operator: currentUser.name
      });
      if (currentBatch) {
        await get().loadBatch(currentBatch.id);
      }
      const updated = get().currentDetails.find(d => d.id === detailId);
      if (updated) {
        set({ selectedDetail: updated, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadDetailAuditTrail: async (detailId) => {
    try {
      return await detailApi.getAuditTrail(detailId);
    } catch (error) {
      return [];
    }
  },

  loadDetailSnapshot: async (snapshotId) => {
    try {
      const detail = get().currentDetails.find(d => d.originalSnapshotId === snapshotId);
      if (detail) {
        return {
          id: snapshotId,
          rawContent: JSON.stringify({
            保单号: detail.policyNo,
            产品名称: detail.productName,
            佣金金额: detail.commissionAmount,
            币种: detail.currencyRaw
          })
        } as OriginalSnapshot;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }
}));
