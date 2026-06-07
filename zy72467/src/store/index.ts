import { create } from 'zustand';
import type { FinalRecord, ConflictRecord, SelfCheckResult, ApiResponse } from '../../shared/types';

interface AppState {
  records: FinalRecord[];
  conflicts: ConflictRecord[];
  selfCheckResult: SelfCheckResult | null;
  loading: boolean;
  error: string | null;
  currentOperator: string;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchRecords: (filters?: { status?: string; source?: string }) => Promise<void>;
  fetchConflicts: () => Promise<void>;
  runSelfCheck: () => Promise<void>;
  importRampRecords: (records: any[]) => Promise<{ success: boolean; message?: string }>;
  importSamplingRecords: (records: any[]) => Promise<{ success: boolean; message?: string }>;
  resolveConflict: (conflictId: string, resolution: string, note: string) => Promise<boolean>;
  resolveOpinionMissing: (recordId: string, opinionOriginal: string) => Promise<boolean>;
  getExportPreview: () => Promise<FinalRecord[]>;
  downloadExport: () => Promise<void>;
}

const API_BASE = '/api';

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data: ApiResponse<T> = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data as T;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  conflicts: [],
  selfCheckResult: null,
  loading: false,
  error: null,
  currentOperator: '社区书记周姐',

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  fetchRecords: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.source) params.append('source', filters.source);
      const query = params.toString() ? `?${params.toString()}` : '';
      const records = await apiRequest<FinalRecord[]>(`/records${query}`);
      set({ records });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '获取记录失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchConflicts: async () => {
    set({ loading: true, error: null });
    try {
      const conflicts = await apiRequest<ConflictRecord[]>('/conflicts');
      set({ conflicts });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '获取冲突列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  runSelfCheck: async () => {
    set({ loading: true, error: null });
    try {
      const result = await apiRequest<SelfCheckResult>('/self-check');
      set({ selfCheckResult: result });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '自检失败' });
    } finally {
      set({ loading: false });
    }
  },

  importRampRecords: async (records) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/import/ramp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, operator: get().currentOperator }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!data.success) {
        set({ error: data.error || '导入失败' });
        return { success: false, message: data.error };
      }
      await get().fetchRecords();
      return { success: true, message: data.message };
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '导入失败' });
      return { success: false, message: err instanceof Error ? err.message : '导入失败' };
    } finally {
      set({ loading: false });
    }
  },

  importSamplingRecords: async (records) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/import/sampling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, operator: get().currentOperator }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!data.success) {
        set({ error: data.error || '补录失败' });
        return { success: false, message: data.error };
      }
      await get().fetchRecords();
      await get().fetchConflicts();
      return { success: true, message: data.message };
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '补录失败' });
      return { success: false, message: err instanceof Error ? err.message : '补录失败' };
    } finally {
      set({ loading: false });
    }
  },

  resolveConflict: async (conflictId, resolution, note) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, note, operator: get().currentOperator }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!data.success) {
        set({ error: data.error || '复核失败' });
        return false;
      }
      await get().fetchConflicts();
      await get().fetchRecords();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '复核失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  resolveOpinionMissing: async (recordId, opinionOriginal) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/self-check/resolve-opinion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, opinionOriginal, operator: get().currentOperator }),
      });
      const data: ApiResponse<any> = await res.json();
      if (!data.success) {
        set({ error: data.error || '处理失败' });
        return false;
      }
      await get().fetchRecords();
      await get().runSelfCheck();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '处理失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  getExportPreview: async () => {
    return await apiRequest<FinalRecord[]>('/export/preview');
  },

  downloadExport: async () => {
    try {
      const res = await fetch(`${API_BASE}/export/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `施工围挡绕行告示_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '导出失败' });
    }
  },
}));
