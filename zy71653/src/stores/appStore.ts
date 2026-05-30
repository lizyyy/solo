import { create } from "zustand";

export interface Channel {
  id: string;
  name: string;
  platform: string;
  conversion_rate: number;
  fatigue_score: number;
  spend_velocity: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Conversion {
  id: string;
  channel_id: string;
  conversion_date: string;
  conversions: number;
  cost: number;
  revenue: number;
  delay_hours: number;
  recorded_at: string;
}

export interface Budget {
  id: string;
  campaign_id: string;
  total_budget: number;
  spent: number;
  remaining: number;
  period_start: string;
  period_end: string;
}

export interface Allocation {
  id: string;
  campaign_id: string;
  channel_id: string;
  suggested_budget: number;
  actual_budget: number | null;
  override_reason: string | null;
  version: string;
  status: string;
  created_at: string;
}

export interface AllocationSuggestion {
  channelId: string;
  channelName: string;
  currentBudget: number;
  suggestedBudget: number;
  changePercent: number;
  metrics: {
    conversionRate: number;
    fatigueScore: number;
    remainingDays: number;
    spendVelocity: number;
  };
  explanation: string;
  confidence: "high" | "medium" | "low";
}

export interface AllocationVersion {
  id: string;
  allocation_id: string;
  version_number: string;
  budget_value: number;
  change_reason: string | null;
  created_at: string;
}

export interface Exception {
  id: string;
  type: "budget_overspend" | "fatigue_missing" | "conversion_delay" | "data_inconsistency" | "duplicate_import";
  severity: "critical" | "warning" | "info";
  message: string;
  human_tip: string;
  humanReadableTip?: string;
  suggestion: "rollback" | "supplement" | "confirm" | "ignore";
  status: "open" | "in_progress" | "resolved" | "dismissed";
  related_id: string;
  relatedEntityId?: string;
  created_at: string;
  createdAt?: string;
  resolved_at?: string;
  resolvedAt?: string;
  resolved_by?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface ExceptionAction {
  exceptionId: string;
  action: "rollback" | "supplement" | "confirm" | "dismiss";
  note?: string;
}

export interface Override {
  channelId: string;
  budget: number;
  reason: string;
}

export interface ReportConfig {
  format: "markdown" | "json";
  dateRange: { start: string; end: string };
  modules: ("allocation" | "exceptions" | "comparison" | "raw_data")[];
  includeHumanTips: boolean;
}

export interface Report {
  id: string;
  config: ReportConfig;
  content: string;
  humanTipsSummary: string;
  createdAt: string;
  downloadUrl: string;
}

export interface ImportWarning {
  type: "duplicate_name" | "date_format_inconsistency" | "late_attachment" | "missing_field";
  message: string;
  suggestion: "rename" | "reformat" | "supplement" | "confirm";
  affectedRows: number[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  warnings: ImportWarning[];
  errors: ImportError[];
}

export interface ChannelHealth {
  channelId: string;
  channelName: string;
  conversion_rate: number;
  fatigue_score: number;
  spend_velocity: number;
}

export interface DashboardData {
  totalBudget: number;
  allocatedBudget: number;
  unallocatedCount: number;
  exceptionStats: { critical: number; warning: number; info: number };
  channelHealth: ChannelHealth[];
  pendingItems: { id: string; type: string; message: string; createdAt: string }[];
  recentExceptions?: Exception[];
  overview?: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    activeChannels: number;
    allocatedCount: number;
    pendingAllocations: number;
    openExceptions: number;
    highSeverityExceptions: number;
  };
  campaigns?: Campaign[];
}

export interface Campaign {
  id: string;
  name: string;
  totalBudget: number;
  spent: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
}

interface AppState {
  channels: Channel[];
  allocations: AllocationSuggestion[];
  exceptions: Exception[];
  campaigns: Campaign[];
  dashboard: DashboardData | null;
  reports: Report[];
  importResult: ImportResult | null;
  loading: boolean;
  error: string | null;
  fetchChannels: () => Promise<void>;
  fetchDashboard: () => Promise<void>;
  fetchExceptions: () => Promise<void>;
  fetchCampaigns: () => Promise<void>;
  fetchReports: () => Promise<void>;
  generateAllocation: (campaignId: string, totalBudget: number) => Promise<void>;
  applyAllocation: (campaignId: string, suggestions: AllocationSuggestion[], overrides?: Override[]) => Promise<void>;
  takeExceptionAction: (exceptionId: string, action: string, note?: string) => Promise<void>;
  importData: (dataType: string, records: any[], options?: any) => Promise<ImportResult>;
  generateReport: (config: ReportConfig) => Promise<Report>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  totalAllocated?: number;
  unallocated?: number;
  warnings?: string[];
  suggestions?: AllocationSuggestion[];
}

const API_BASE = 'http://localhost:3002'

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`
  const res = await fetch(fullUrl, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `请求失败: ${res.status}`);
  }
  const response = await res.json() as ApiResponse<T>;
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) {
      throw new Error(response.error || '请求失败');
    }
    return response.data;
  }
  return response as unknown as T;
}

function transformException(raw: any): Exception {
  return {
    ...raw,
    humanReadableTip: raw.human_tip,
    relatedEntityId: raw.related_id,
    createdAt: raw.created_at,
    resolvedAt: raw.resolved_at,
    resolvedBy: raw.resolved_by,
  };
}

function transformAllocationSuggestion(raw: any): AllocationSuggestion {
  const conf: string = typeof raw.confidence === 'number' 
    ? (raw.confidence > 0.7 ? 'high' : raw.confidence > 0.4 ? 'medium' : 'low')
    : (raw.confidence || 'medium');
  return {
    ...raw,
    confidence: conf as 'high' | 'medium' | 'low',
  };
}

function transformBudgetToCampaign(raw: any): Campaign {
  const name = raw.campaign_name ?? (raw.campaign_id === 'camp_618' ? '618大促' : '品牌日')
  return {
    id: raw.campaign_id,
    name,
    totalBudget: raw.total_budget,
    spent: raw.spent,
    remaining: raw.remaining,
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  channels: [],
  allocations: [],
  exceptions: [],
  campaigns: [],
  dashboard: null,
  reports: [],
  importResult: null,
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<Channel[]>("/api/channels");
      set({ channels: data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any>("/api/dashboard");
      if (data.recentExceptions) {
        data.recentExceptions = data.recentExceptions.map(transformException);
      }
      set({ dashboard: data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchExceptions: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>("/api/exceptions");
      const transformed = data.map(transformException);
      set({ exceptions: transformed, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchCampaigns: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>("/api/budgets");
      const transformed = data.map(transformBudgetToCampaign);
      set({ campaigns: transformed, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  fetchReports: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<Report[]>("/api/reports");
      set({ reports: data, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  generateAllocation: async (campaignId, totalBudget) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{ suggestions: any[] }>("/api/allocations/generate", {
        method: "POST",
        body: JSON.stringify({ campaignId, totalBudget }),
      });
      const transformed = data.suggestions.map(transformAllocationSuggestion);
      set({ allocations: transformed, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  applyAllocation: async (campaignId, suggestions, overrides) => {
    set({ loading: true, error: null });
    try {
      await apiFetch("/api/allocations/apply", {
        method: "POST",
        body: JSON.stringify({ campaignId, suggestions, overrides }),
      });
      set({ loading: false });
      await get().fetchDashboard();
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  takeExceptionAction: async (exceptionId, action, note) => {
    set({ loading: true, error: null });
    try {
      await apiFetch(`/api/exceptions/${exceptionId}/action`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      set({ loading: false });
      await get().fetchExceptions();
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  importData: async (dataType, records, options) => {
    set({ loading: true, error: null, importResult: null });
    try {
      const data = await apiFetch<ImportResult>("/api/data/import", {
        method: "POST",
        body: JSON.stringify({ dataType, records, options }),
      });
      set({ importResult: data, loading: false });
      return data;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  generateReport: async (config) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<Report>("/api/reports/generate", {
        method: "POST",
        body: JSON.stringify(config),
      });
      set((s) => ({ reports: [data, ...s.reports], loading: false }));
      return data;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },
}));
