import { create } from 'zustand';
import type {
  Scheme,
  HotSpotRecord,
  SourceAttachment,
  SourceConflict,
  ParameterChange,
  DashboardData,
  ExportOptions,
} from '@/types';
import { snakeToCamel } from '@/utils/transform';

interface AppState {
  currentScheme: Scheme | null;
  records: HotSpotRecord[];
  selectedRecord: HotSpotRecord | null;
  sourcesByRecord: Record<string, SourceAttachment[]>;
  conflicts: SourceConflict[];
  parameterChanges: ParameterChange[];
  dashboardData: DashboardData | null;
  paramPanelOpen: boolean;
  detailPanelOpen: boolean;
  sourcePopover: { recordId: string; x: number; y: number } | null;
  exportPanelOpen: boolean;
  loading: boolean;
  error: string | null;

  fetchScheme: (schemeId: string) => Promise<void>;
  fetchDashboard: (schemeId: string) => Promise<void>;
  fetchRecords: (schemeId: string, filters?: { severity?: string; status?: string; coordinateSystem?: string }) => Promise<void>;
  selectRecord: (record: HotSpotRecord | null) => void;
  fetchSources: (recordId: string) => Promise<void>;
  fetchConflicts: (schemeId: string) => Promise<void>;
  fetchParameterChanges: (schemeId: string) => Promise<void>;
  updateSchemeParams: (schemeId: string, params: { warningThreshold?: number; criticalThreshold?: number }, changedBy: string, reason: string) => Promise<void>;
  resolveConflict: (conflictId: string, resolution: string, resolvedBy: string) => Promise<void>;
  exportReport: (schemeId: string, options: ExportOptions) => Promise<Blob | null>;
  setCurrentScheme: (scheme: Scheme | null) => void;
  setParamPanelOpen: (open: boolean) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setSourcePopover: (popover: { recordId: string; x: number; y: number } | null) => void;
  setExportPanelOpen: (open: boolean) => void;
  clearError: () => void;
}

function mapDashboardData(raw: any): DashboardData {
  const stats = raw.severityStats ?? {}
  return {
    totalRecords: raw.totalRecords ?? 0,
    criticalCount: stats.critical ?? 0,
    warningCount: stats.warning ?? 0,
    normalCount: stats.normal ?? 0,
    unresolvedConflicts: (raw.conflictCount ?? 0) - (raw.resolvedConflictCount ?? 0),
    recentChanges: raw.recentChanges ?? 0,
    lastUpdatedAt: raw.scheme?.updatedAt ?? raw.scheme?.updated_at ?? new Date().toISOString(),
  }
}

export const useStore = create<AppState>((set, get) => ({
  currentScheme: null,
  records: [],
  selectedRecord: null,
  sourcesByRecord: {},
  conflicts: [],
  parameterChanges: [],
  dashboardData: null,
  paramPanelOpen: false,
  detailPanelOpen: false,
  sourcePopover: null,
  exportPanelOpen: false,
  loading: false,
  error: null,

  fetchScheme: async (schemeId) => {
    try {
      const res = await fetch(`/api/schemes/${schemeId}`);
      if (!res.ok) throw new Error(`Failed to fetch scheme: ${res.status}`);
      const json = await res.json();
      const scheme: Scheme = snakeToCamel(json.data ?? json);
      set({ currentScheme: scheme });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchDashboard: async (schemeId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/schemes/${schemeId}/dashboard`);
      if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
      const json = await res.json();
      const raw = json.data ?? json;
      const scheme = snakeToCamel(raw.scheme);
      set({
        dashboardData: mapDashboardData(raw),
        currentScheme: scheme,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchRecords: async (schemeId, filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.coordinateSystem) params.set('coordinateSystem', filters.coordinateSystem);
      const qs = params.toString();
      const url = `/api/schemes/${schemeId}/records${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch records: ${res.status}`);
      const json = await res.json();
      const data: HotSpotRecord[] = snakeToCamel(json.data ?? json);
      set({ records: data, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  selectRecord: (record) => {
    set({ selectedRecord: record });
  },

  fetchSources: async (recordId) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/records/${recordId}/sources`);
      if (!res.ok) throw new Error(`Failed to fetch sources: ${res.status}`);
      const json = await res.json();
      const data: SourceAttachment[] = snakeToCamel(json.data ?? json);
      set((state) => ({
        sourcesByRecord: { ...state.sourcesByRecord, [recordId]: data },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchConflicts: async (schemeId) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/schemes/${schemeId}/conflicts`);
      if (!res.ok) throw new Error(`Failed to fetch conflicts: ${res.status}`);
      const json = await res.json();
      const rawConflicts: any[] = json.data ?? json;
      const conflicts: SourceConflict[] = rawConflicts.map((c: any) => {
        const camel = snakeToCamel(c);
        const sourceA: SourceAttachment | undefined = camel.sourceA ? camel.sourceA as SourceAttachment : undefined;
        const sourceB: SourceAttachment | undefined = camel.sourceB ? camel.sourceB as SourceAttachment : undefined;
        return { ...camel, sourceA, sourceB };
      });
      set({ conflicts });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchParameterChanges: async (schemeId) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/schemes/${schemeId}/changes`);
      if (!res.ok) throw new Error(`Failed to fetch parameter changes: ${res.status}`);
      const json = await res.json();
      const data: ParameterChange[] = snakeToCamel(json.data ?? json);
      set({ parameterChanges: data });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  updateSchemeParams: async (schemeId, params, changedBy, reason) => {
    set({ loading: true, error: null });
    try {
      const body: Record<string, any> = {};
      if (params.warningThreshold !== undefined) body.warning_threshold = params.warningThreshold;
      if (params.criticalThreshold !== undefined) body.critical_threshold = params.criticalThreshold;
      body.changed_by = changedBy;
      body.reason = reason;

      const res = await fetch(`/api/schemes/${schemeId}/params`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update scheme params: ${res.status}`);
      await get().fetchRecords(schemeId);
      await get().fetchDashboard(schemeId);
      await get().fetchParameterChanges(schemeId);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  resolveConflict: async (conflictId, resolution, resolvedBy) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/conflicts/${conflictId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, resolved_by: resolvedBy }),
      });
      if (!res.ok) throw new Error(`Failed to resolve conflict: ${res.status}`);
      const schemeId = get().currentScheme?.id;
      if (schemeId) {
        await get().fetchConflicts(schemeId);
        await get().fetchRecords(schemeId);
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  exportReport: async (schemeId, options) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/schemes/${schemeId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error(`Failed to export report: ${res.status}`);
      const json = await res.json();
      set({ loading: false });
      return new Blob([JSON.stringify(snakeToCamel(json.data ?? json), null, 2)], { type: 'application/json' });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      return null;
    }
  },

  setCurrentScheme: (scheme) => set({ currentScheme: scheme }),
  setParamPanelOpen: (open) => set({ paramPanelOpen: open }),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setSourcePopover: (popover) => set({ sourcePopover: popover }),
  setExportPanelOpen: (open) => set({ exportPanelOpen: open }),
  clearError: () => set({ error: null }),
}));
