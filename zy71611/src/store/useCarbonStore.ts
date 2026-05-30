import { create } from 'zustand';
import type {
  OverviewData,
  QuotaDetailData,
  HedgingDetailData,
  BudgetDetailData,
  AnomalyItem,
  ConflictItem,
  TraceNode,
} from '@/types/carbon';

const API_BASE = '/api/carbon';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

async function apiPatch<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data as T;
}

interface CarbonStore {
  period: string;
  setPeriod: (p: string) => void;
  overview: OverviewData | null;
  quotaDetail: QuotaDetailData | null;
  hedgingDetail: HedgingDetailData | null;
  budgetDetail: BudgetDetailData | null;
  anomalies: AnomalyItem[];
  conflicts: ConflictItem[];
  tracePanel: {
    open: boolean;
    targetType: string;
    targetId: string;
    data: TraceNode[] | null;
  };
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  fetchOverview: () => Promise<void>;
  fetchQuotaDetail: () => Promise<void>;
  fetchHedgingDetail: () => Promise<void>;
  fetchBudgetDetail: () => Promise<void>;
  fetchAnomalies: () => Promise<void>;
  fetchConflicts: () => Promise<void>;
  openTrace: (targetType: string, targetId: string) => void;
  closeTrace: () => void;
  resolveAnomaly: (id: string, resolution: string) => Promise<void>;
  resolveConflict: (id: string, resolution: string) => Promise<void>;
}

export const useCarbonStore = create<CarbonStore>((set, get) => ({
  period: '2025-Q2',
  setPeriod: (p) => set({ period: p }),
  overview: null,
  quotaDetail: null,
  hedgingDetail: null,
  budgetDetail: null,
  anomalies: [],
  conflicts: [],
  tracePanel: { open: false, targetType: '', targetId: '', data: null },
  loading: {},
  errors: {},

  fetchOverview: async () => {
    const key = 'overview';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<OverviewData>(`/overview?period=${get().period}`);
      set((s) => ({ overview: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  fetchQuotaDetail: async () => {
    const key = 'quota';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<QuotaDetailData>(`/quota?period=${get().period}`);
      set((s) => ({ quotaDetail: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  fetchHedgingDetail: async () => {
    const key = 'hedging';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<HedgingDetailData>(`/hedging?period=${get().period}`);
      set((s) => ({ hedgingDetail: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  fetchBudgetDetail: async () => {
    const key = 'budget';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<BudgetDetailData>(`/budget?period=${get().period}`);
      set((s) => ({ budgetDetail: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  fetchAnomalies: async () => {
    const key = 'anomalies';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<AnomalyItem[]>(`/anomalies?period=${get().period}`);
      set((s) => ({ anomalies: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  fetchConflicts: async () => {
    const key = 'conflicts';
    set((s) => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: '' } }));
    try {
      const data = await apiFetch<ConflictItem[]>(`/conflicts?period=${get().period}`);
      set((s) => ({ conflicts: data, loading: { ...s.loading, [key]: false } }));
    } catch (e: any) {
      set((s) => ({ errors: { ...s.errors, [key]: e.message }, loading: { ...s.loading, [key]: false } }));
    }
  },

  openTrace: async (targetType, targetId) => {
    set({
      tracePanel: { open: true, targetType, targetId, data: null },
    });
    try {
      const data = await apiFetch<TraceNode[]>(`/trace/${targetType}/${targetId}`);
      set((s) => ({ tracePanel: { ...s.tracePanel, data } }));
    } catch {
      set((s) => ({ tracePanel: { ...s.tracePanel, data: [] } }));
    }
  },

  closeTrace: () => {
    set({ tracePanel: { open: false, targetType: '', targetId: '', data: null } });
  },

  resolveAnomaly: async (id, resolution) => {
    await apiPatch(`/anomaly/${id}`, { resolution });
    set((s) => ({
      anomalies: s.anomalies.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
    }));
  },

  resolveConflict: async (id, resolution) => {
    await apiPatch(`/conflict/${id}`, { resolution });
    set((s) => ({
      conflicts: s.conflicts.map((c) => (c.id === id ? { ...c, resolved: true } : c)),
    }));
  },
}));
