import { create } from "zustand";
import type {
  FeatureSpec,
  AuditLog,
  LeakAlert,
  EvaluationReport,
  FilterState,
} from "../shared/types";

interface AppState {
  features: FeatureSpec[];
  auditLogs: AuditLog[];
  leakAlerts: LeakAlert[];
  evaluationReport: EvaluationReport | null;
  filter: FilterState;
  sidebarOpen: boolean;
  loading: boolean;

  fetchFeatures: () => Promise<void>;
  importFeatures: (
    features: {
      featureName: string;
      trainingSpec: string;
      onlineSpec: string;
    }[],
    operator: string
  ) => Promise<void>;
  correctFeature: (
    id: string,
    data: {
      trainingSpec: string;
      onlineSpec: string;
      operator: string;
      reason: string;
    }
  ) => Promise<void>;
  rollbackFeature: (id: string, operator: string) => Promise<void>;
  fetchAuditLogs: (params?: {
    operationType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => Promise<void>;
  fetchLeakAlerts: (isResolved?: boolean) => Promise<void>;
  resolveLeakAlert: (id: string, operator: string) => Promise<void>;
  fetchEvaluation: () => Promise<void>;
  exportData: (format: "csv" | "json") => Promise<void>;
  setFilter: (partial: Partial<FilterState>) => void;
  resetFilter: () => void;
  toggleSidebar: () => void;
}

const defaultFilter: FilterState = {
  featureName: "",
  status: "all",
  dateFrom: null,
  dateTo: null,
};

function buildFilterParams(filter: FilterState) {
  const params = new URLSearchParams();
  if (filter.featureName) params.set("featureName", filter.featureName);
  if (filter.status !== "all") params.set("status", filter.status);
  if (filter.dateFrom) params.set("dateFrom", filter.dateFrom);
  if (filter.dateTo) params.set("dateTo", filter.dateTo);
  return params.toString();
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "请求失败");
  return json.data;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "请求失败");
  return json.data;
}

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "请求失败");
  return json.data;
}

export const useStore = create<AppState>((set, get) => ({
  features: [],
  auditLogs: [],
  leakAlerts: [],
  evaluationReport: null,
  filter: { ...defaultFilter },
  sidebarOpen: true,
  loading: false,

  fetchFeatures: async () => {
    set({ loading: true });
    try {
      const qs = buildFilterParams(get().filter);
      const data = await apiFetch<FeatureSpec[]>(
        `/api/features${qs ? `?${qs}` : ""}`
      );
      set({ features: data });
    } finally {
      set({ loading: false });
    }
  },

  importFeatures: async (features, operator) => {
    await apiPost("/api/features/import", { features, operator });
    await get().fetchFeatures();
    await get().fetchLeakAlerts();
    await get().fetchAuditLogs();
    await get().fetchEvaluation();
  },

  correctFeature: async (id, data) => {
    await apiPut(`/api/features/${id}/correct`, data);
    await get().fetchFeatures();
    await get().fetchAuditLogs();
    await get().fetchEvaluation();
  },

  rollbackFeature: async (id, operator) => {
    await apiPost(`/api/features/${id}/rollback`, { operator });
    await get().fetchFeatures();
    await get().fetchAuditLogs();
    await get().fetchEvaluation();
  },

  fetchAuditLogs: async (params) => {
    const qs = new URLSearchParams();
    if (params?.operationType)
      qs.set("operationType", params.operationType);
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    const data = await apiFetch<AuditLog[]>(
      `/api/audit-logs${qs.toString() ? `?${qs}` : ""}`
    );
    set({ auditLogs: data });
  },

  fetchLeakAlerts: async (isResolved) => {
    const qs = new URLSearchParams();
    if (isResolved !== undefined) qs.set("isResolved", String(isResolved));
    const data = await apiFetch<LeakAlert[]>(
      `/api/leak-alerts${qs.toString() ? `?${qs}` : ""}`
    );
    set({ leakAlerts: data });
  },

  resolveLeakAlert: async (id, operator) => {
    await apiPut(`/api/leak-alerts/${id}/resolve`, { operator });
    await get().fetchLeakAlerts();
  },

  fetchEvaluation: async () => {
    try {
      const qs = buildFilterParams(get().filter);
      const data = await apiFetch<EvaluationReport>(
        `/api/evaluation${qs ? `?${qs}` : ""}`
      );
      set({ evaluationReport: data });
    } catch {
      set({ evaluationReport: null });
    }
  },

  exportData: async (format) => {
    const qs = buildFilterParams(get().filter);
    const params = new URLSearchParams(qs);
    params.set("format", format);
    const url = `/api/export?${params.toString()}`;
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `特征口径对账_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  setFilter: (partial) => {
    const newFilter = { ...get().filter, ...partial };
    set({ filter: newFilter });
    set({ loading: true });
    const qs = buildFilterParams(newFilter);
    Promise.all([
      apiFetch<FeatureSpec[]>(`/api/features${qs ? `?${qs}` : ""}`),
      apiFetch<EvaluationReport>(`/api/evaluation${qs ? `?${qs}` : ""}`),
      get().fetchLeakAlerts(),
    ])
      .then(([features, evaluationReport]) => {
        set({ features, evaluationReport, loading: false });
      })
      .catch(() => {
        set({ loading: false });
      });
  },

  resetFilter: () => {
    const newFilter = { ...defaultFilter };
    set({ filter: newFilter, loading: true });
    const qs = buildFilterParams(newFilter);
    Promise.all([
      apiFetch<FeatureSpec[]>(`/api/features${qs ? `?${qs}` : ""}`),
      apiFetch<EvaluationReport>(`/api/evaluation${qs ? `?${qs}` : ""}`),
      get().fetchLeakAlerts(),
    ])
      .then(([features, evaluationReport]) => {
        set({ features, evaluationReport, loading: false });
      })
      .catch(() => {
        set({ loading: false });
      });
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
