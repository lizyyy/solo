import { create } from 'zustand';
import type {
  EnvelopeRecord,
  CoordinatePoint,
  AuditLog,
  BoundaryRule,
  SafetyRadiusTable,
  ProcessingStatus,
  WorkflowStepInfo,
  ReviewPointRequest,
  ImportLogRequest,
} from '../../shared/types';

interface EnvelopeState {
  envelopes: EnvelopeRecord[];
  currentEnvelope: EnvelopeRecord | null;
  currentPoints: CoordinatePoint[];
  currentAuditLogs: AuditLog[];
  workflowSteps: WorkflowStepInfo[];
  boundaryRules: BoundaryRule[];
  safetyRadiusTable: SafetyRadiusTable[];
  loading: boolean;
  error: string | null;
  currentUser: string;

  fetchEnvelopes: (status?: ProcessingStatus, robotArmId?: string) => Promise<void>;
  fetchEnvelopeDetail: (id: string) => Promise<void>;
  importLog: (request: ImportLogRequest) => Promise<boolean>;
  advanceWorkflow: (id: string) => Promise<boolean>;
  confirmNormalPoint: (pointId: string) => Promise<boolean>;
  reviewPoint: (request: ReviewPointRequest) => Promise<boolean>;
  exportEnvelope: (id: string) => Promise<void>;
  fetchBoundaryRules: () => Promise<void>;
  fetchSafetyRadiusTable: (version?: string, armModel?: string) => Promise<void>;
  setCurrentUser: (user: string) => void;
  clearError: () => void;
}

const API_BASE = '';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}

export const useEnvelopeStore = create<EnvelopeState>((set, get) => ({
  envelopes: [],
  currentEnvelope: null,
  currentPoints: [],
  currentAuditLogs: [],
  workflowSteps: [],
  boundaryRules: [],
  safetyRadiusTable: [],
  loading: false,
  error: null,
  currentUser: '许工',

  fetchEnvelopes: async (status?: ProcessingStatus, robotArmId?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (robotArmId) params.set('robotArmId', robotArmId);
      
      const data = await apiFetch<EnvelopeRecord[]>(
        `/api/envelopes${params.toString() ? `?${params.toString()}` : ''}`
      );
      set({ envelopes: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取列表失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchEnvelopeDetail: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{
        envelope: EnvelopeRecord;
        points: CoordinatePoint[];
        auditLogs: AuditLog[];
        workflowSteps: WorkflowStepInfo[];
      }>(`/api/envelopes/${id}`);
      set({
        currentEnvelope: data.envelope,
        currentPoints: data.points,
        currentAuditLogs: data.auditLogs,
        workflowSteps: data.workflowSteps,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取详情失败' });
    } finally {
      set({ loading: false });
    }
  },

  importLog: async (request: ImportLogRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/envelopes/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '导入失败');
      }
      await get().fetchEnvelopes();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导入失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  advanceWorkflow: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { currentUser } = get();
      const response = await fetch(`${API_BASE}/api/envelopes/${id}/step`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: currentUser }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '流程推进失败');
      }
      await get().fetchEnvelopeDetail(id);
      await get().fetchEnvelopes();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '流程推进失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  confirmNormalPoint: async (pointId: string) => {
    set({ loading: true, error: null });
    try {
      const { currentUser, currentEnvelope } = get();
      const response = await fetch(`${API_BASE}/api/points/${pointId}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: currentUser }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '确认失败');
      }
      if (currentEnvelope) {
        await get().fetchEnvelopeDetail(currentEnvelope.id);
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '确认失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  reviewPoint: async (request: ReviewPointRequest) => {
    set({ loading: true, error: null });
    try {
      const { currentUser, currentEnvelope } = get();
      const response = await fetch(`${API_BASE}/api/points/${request.pointId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, operator: currentUser }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '复核失败');
      }
      if (currentEnvelope) {
        await get().fetchEnvelopeDetail(currentEnvelope.id);
      }
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '复核失败' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  exportEnvelope: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/envelopes/${id}/export`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `envelope_${id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '导出失败' });
    }
  },

  fetchBoundaryRules: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<BoundaryRule[]>('/api/rules');
      set({ boundaryRules: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取规则失败' });
    } finally {
      set({ loading: false });
    }
  },

  fetchSafetyRadiusTable: async (version?: string, armModel?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (version) params.set('version', version);
      if (armModel) params.set('armModel', armModel);
      
      const data = await apiFetch<SafetyRadiusTable[]>(
        `/api/safety-radius${params.toString() ? `?${params.toString()}` : ''}`
      );
      set({ safetyRadiusTable: data });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '获取安全半径表失败' });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentUser: (user: string) => set({ currentUser: user }),
  clearError: () => set({ error: null }),
}));
