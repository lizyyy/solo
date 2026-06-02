import { create } from "zustand";
import type {
  Batch,
  BatchSummary,
  ImportJob,
  MergedPoint,
  ConflictItem,
  Anomaly,
  AuditLog,
} from "../../shared/types";
import { api } from "../utils/api";

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

interface AppState {
  currentBatch: Batch | null;
  batches: Batch[];
  setCurrentBatch: (batch: Batch | null) => void;

  summary: BatchSummary | null;
  auditLogs: AuditLog[];
  anomalies: Anomaly[];
  conflicts: ConflictItem[];
  dashboardLoading: boolean;
  fetchDashboard: (batchId: string) => Promise<void>;

  importJobs: ImportJob[];
  currentPreview: ImportJob | null;
  importLoading: boolean;
  fetchImports: (batchId: string) => Promise<void>;
  setPreview: (job: ImportJob | null) => void;

  mergedPoints: MergedPoint[];
  currentConflict: ConflictItem | null;
  reviewLoading: boolean;
  fetchMergedPoints: (batchId: string) => Promise<void>;
  fetchConflict: (conflictId: string) => Promise<void>;
  setCurrentConflict: (c: ConflictItem | null) => void;

  exportFilters: {
    district: string;
    businessType: string;
    conflictStatus: string;
  };
  setExportFilters: (f: Partial<AppState["exportFilters"]>) => void;
  resetExportFilters: () => void;

  toasts: Toast[];
  addToast: (type: "success" | "error", message: string) => void;
  removeToast: (id: number) => void;

  fetchBatches: () => Promise<void>;
  createBatch: (name: string) => Promise<Batch | null>;
}

const defaultFilters = {
  district: "",
  businessType: "",
  conflictStatus: "",
};

let toastId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  currentBatch: null,
  batches: [],
  setCurrentBatch: (batch) => set({ currentBatch: batch }),

  summary: null,
  auditLogs: [],
  anomalies: [],
  conflicts: [],
  dashboardLoading: false,

  fetchDashboard: async (batchId) => {
    set({ dashboardLoading: true });
    try {
      const [summary, logs, anomalies, conflicts] = await Promise.all([
        api.batches.summary(batchId),
        api.auditLogs.list(batchId),
        api.anomalies.list(batchId),
        api.conflicts.list(batchId),
      ]);
      set({ summary, auditLogs: logs, anomalies, conflicts });
    } catch (e) {
      get().addToast("error", "加载总览数据失败");
    } finally {
      set({ dashboardLoading: false });
    }
  },

  importJobs: [],
  currentPreview: null,
  importLoading: false,

  fetchImports: async (batchId) => {
    set({ importLoading: true });
    try {
      const jobs = await api.imports.list(batchId);
      set({ importJobs: jobs });
    } catch (e) {
      get().addToast("error", "加载导入记录失败");
    } finally {
      set({ importLoading: false });
    }
  },

  setPreview: (job) => set({ currentPreview: job }),

  mergedPoints: [],
  currentConflict: null,
  reviewLoading: false,

  fetchMergedPoints: async (batchId) => {
    set({ reviewLoading: true });
    try {
      const points = await api.merge.listPoints(batchId);
      set({ mergedPoints: points });
    } catch (e) {
      get().addToast("error", "加载归并数据失败");
    } finally {
      set({ reviewLoading: false });
    }
  },

  fetchConflict: async (conflictId) => {
    try {
      const c = await api.conflicts.get(conflictId);
      set({ currentConflict: c });
    } catch (e) {
      get().addToast("error", "加载冲突详情失败");
    }
  },

  setCurrentConflict: (c) => set({ currentConflict: c }),

  exportFilters: { ...defaultFilters },
  setExportFilters: (f) =>
    set((s) => ({ exportFilters: { ...s.exportFilters, ...f } })),
  resetExportFilters: () => set({ exportFilters: { ...defaultFilters } }),

  toasts: [],
  addToast: (type, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 3000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  fetchBatches: async () => {
    try {
      const batches = await api.batches.list();
      set({ batches });
      if (batches.length > 0 && !get().currentBatch) {
        const active = batches.find((b) => b.status === "active") || batches[0];
        set({ currentBatch: active });
      }
    } catch (e) {
      get().addToast("error", "加载批次列表失败");
    }
  },

  createBatch: async (name) => {
    try {
      const batch = await api.batches.create(name);
      set((s) => ({ batches: [batch, ...s.batches], currentBatch: batch }));
      get().addToast("success", `批次 "${name}" 创建成功`);
      return batch;
    } catch (e) {
      get().addToast("error", "创建批次失败");
      return null;
    }
  },
}));
