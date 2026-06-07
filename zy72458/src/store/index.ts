import { create } from 'zustand';
import { ResidentComplaint, DashboardStats, SelfCheckResult, ComplaintWithAudit, OperationRecord } from '../../shared/types';

interface AppState {
  currentRole: 'manager' | 'secretary';
  currentUser: string;
  complaints: ResidentComplaint[];
  stats: DashboardStats | null;
  currentComplaint: ComplaintWithAudit | null;
  selfCheckResults: SelfCheckResult[];
  operationRecords: OperationRecord[];
  loading: boolean;
  error: string | null;
  setRole: (role: 'manager' | 'secretary') => void;
  fetchComplaints: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchComplaintDetail: (id: string) => Promise<void>;
  fetchSelfCheckResults: () => Promise<void>;
  runSelfCheck: () => Promise<void>;
  updatePhoto: (id: string, hasPhoto: boolean, photoUrl?: string) => Promise<void>;
  updateOpinion: (id: string, summary?: string, originalText?: string) => Promise<void>;
  reviewComplaint: (id: string, comment: string, approve: boolean) => Promise<void>;
  exportData: () => Promise<void>;
}

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '请求失败');
  }
  return data.data;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentRole: 'manager',
  currentUser: '阿宁',
  complaints: [],
  stats: null,
  currentComplaint: null,
  selfCheckResults: [],
  operationRecords: [],
  loading: false,
  error: null,

  setRole: (role) => {
    set({ 
      currentRole: role, 
      currentUser: role === 'manager' ? '阿宁' : '王书记' 
    });
  },

  fetchComplaints: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<ResidentComplaint[]>('/complaints');
      set({ complaints: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<DashboardStats>('/complaints/stats');
      set({ stats: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchComplaintDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<ComplaintWithAudit>(`/complaints/${id}`);
      set({ currentComplaint: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchSelfCheckResults: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<SelfCheckResult[]>('/self-check/results');
      set({ selfCheckResults: data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '加载失败' });
    } finally {
      set({ loading: false });
    }
  },

  runSelfCheck: async () => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      const data = await apiFetch<SelfCheckResult[]>('/self-check/run', {
        method: 'POST',
        body: JSON.stringify({ operator: currentUser }),
      });
      set({ selfCheckResults: data });
      await get().fetchStats();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '自检失败' });
    } finally {
      set({ loading: false });
    }
  },

  updatePhoto: async (id: string, hasPhoto: boolean, photoUrl?: string) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      await apiFetch(`/complaints/${id}/photo`, {
        method: 'PATCH',
        body: JSON.stringify({ hasPhoto, photoUrl, operator: currentUser }),
      });
      await Promise.all([get().fetchComplaints(), get().fetchStats()]);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '更新失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateOpinion: async (id: string, summary?: string, originalText?: string) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      await apiFetch(`/complaints/${id}/opinion`, {
        method: 'PATCH',
        body: JSON.stringify({ summary, originalText, operator: currentUser }),
      });
      await Promise.all([get().fetchComplaints(), get().fetchStats()]);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '更新失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  reviewComplaint: async (id: string, comment: string, approve: boolean) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      await apiFetch(`/complaints/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ comment, approve, operator: currentUser }),
      });
      await Promise.all([get().fetchComplaints(), get().fetchStats()]);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '复核失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  exportData: async () => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      const result = await apiFetch<{ data: ResidentComplaint[]; exportTime: string; count: number }>(
        `/export?operator=${encodeURIComponent(currentUser)}`
      );
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `菜市场摊位外溢治理_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '导出失败' });
      throw e;
    } finally {
      set({ loading: false });
    }
  },
}));
