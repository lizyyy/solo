import { create } from 'zustand';
import type {
  ParameterTable,
  ParameterRecord,
  Conflict,
  ForecastResult,
  WorkflowState,
  SelfCheckResult,
  ImportResult,
  CounterExample,
  ExampleRecord,
  AuditLogEntry,
  MetadataState,
  ParameterUpdateRequest,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ForecastStore {
  parameterTables: ParameterTable[];
  parameterRecords: ParameterRecord[];
  counterExamples: CounterExample[];
  exampleRecords: ExampleRecord[];
  conflicts: Conflict[];
  forecastResults: ForecastResult[];
  workflowState: WorkflowState | null;
  selfCheckResult: SelfCheckResult | null;
  auditLogs: AuditLogEntry[];
  metadata: MetadataState | null;
  loading: boolean;
  error: string | null;
  fetchParameters: () => Promise<void>;
  fetchAllParameters: () => Promise<void>;
  importParameters: (table: ParameterTable, records: ParameterRecord[]) => Promise<ImportResult>;
  uploadParametersFile: (file: File, strategy?: 'overwrite' | 'skip' | 'append') => Promise<ImportResult>;
  fetchCounterExamples: () => Promise<void>;
  importCounterExamples: (example: CounterExample, records: ExampleRecord[]) => Promise<{ conflicts: Conflict[]; message: string }>;
  uploadCounterExamplesFile: (file: File) => Promise<ImportResult>;
  fetchConflicts: () => Promise<void>;
  resolveConflict: (id: string, resolution: 'accept_example' | 'reject_example', reason: string, resolvedBy: string) => Promise<Conflict>;
  calculateForecast: () => Promise<ForecastResult[]>;
  fetchResults: () => Promise<void>;
  runSelfCheck: () => Promise<void>;
  fetchWorkflowStatus: () => Promise<void>;
  updateWorkflowStep: (step: number, completed: boolean) => Promise<void>;
  updateParameterRecord: (update: ParameterUpdateRequest) => Promise<ParameterRecord>;
  fetchAuditLogs: () => Promise<void>;
  fetchMetadata: () => Promise<void>;
  setError: (error: string | null) => void;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<{ data: T; success: boolean; error?: string }> {
  const res = await fetch(url, options);
  const data = await res.json();
  return data;
}

export const useForecastStore = create<ForecastStore>((set, get) => ({
  parameterTables: [],
  parameterRecords: [],
  counterExamples: [],
  exampleRecords: [],
  conflicts: [],
  forecastResults: [],
  workflowState: null,
  selfCheckResult: null,
  auditLogs: [],
  metadata: null,
  loading: false,
  error: null,

  fetchParameters: async () => {
    try {
      const data = await apiFetch<{ tables: ParameterTable[]; records: ParameterRecord[] }>(`${BASE_URL}/forecast/parameters`);
      if (data.success) {
        set({
          parameterTables: data.data.tables || [],
          parameterRecords: data.data.records || [],
        });
      } else {
        set({ error: data.error || '获取参数失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  importParameters: async (table, records) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<ImportResult>(`${BASE_URL}/forecast/parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, records }),
      });
      if (data.success) {
        await get().fetchParameters();
        set({ loading: false });
        return data.data;
      }
      throw new Error(data.error || '导入参数失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  fetchCounterExamples: async () => {
    try {
      const data = await apiFetch<{ examples: CounterExample[]; records: ExampleRecord[] }>(`${BASE_URL}/forecast/counter-examples`);
      if (data.success) {
        set({
          counterExamples: data.data.examples || [],
          exampleRecords: data.data.records || [],
        });
      } else {
        set({ error: data.error || '获取反例失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  importCounterExamples: async (example, records) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{ conflicts: Conflict[]; message: string }>(`${BASE_URL}/forecast/counter-examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ example, records }),
      });
      if (data.success) {
        await get().fetchCounterExamples();
        set({ loading: false });
        return data.data;
      }
      throw new Error(data.error || '导入反例失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  fetchConflicts: async () => {
    try {
      const data = await apiFetch<Conflict[]>(`${BASE_URL}/forecast/conflicts`);
      if (data.success) {
        set({ conflicts: data.data || [] });
      } else {
        set({ error: data.error || '获取冲突失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  resolveConflict: async (id, resolution, reason, resolvedBy) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<Conflict>(`${BASE_URL}/forecast/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, reason, resolvedBy }),
      });
      if (data.success) {
        await get().fetchConflicts();
        set({ loading: false });
        return data.data;
      }
      throw new Error(data.error || '解决冲突失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  calculateForecast: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<ForecastResult[]>(`${BASE_URL}/forecast/calculate`, {
        method: 'POST',
      });
      if (data.success) {
        set({ forecastResults: data.data || [], loading: false });
        return data.data;
      }
      throw new Error(data.error || '计算预测失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  fetchResults: async () => {
    try {
      const data = await apiFetch<ForecastResult[]>(`${BASE_URL}/forecast/results`);
      if (data.success) {
        set({ forecastResults: data.data || [] });
      } else {
        set({ error: data.error || '获取结果失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  runSelfCheck: async () => {
    try {
      const data = await apiFetch<SelfCheckResult>(`${BASE_URL}/forecast/self-check`);
      if (data.success) {
        set({ selfCheckResult: data.data });
      } else {
        set({ error: data.error || '自检失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  fetchWorkflowStatus: async () => {
    try {
      const data = await apiFetch<WorkflowState>(`${BASE_URL}/forecast/workflow/status`);
      if (data.success) {
        set({ workflowState: data.data });
      } else {
        set({ error: data.error || '获取工作流状态失败' });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  updateWorkflowStep: async (step, completed) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<WorkflowState>(`${BASE_URL}/forecast/workflow/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, completed }),
      });
      if (data.success) {
        set({ workflowState: data.data, loading: false });
      } else {
        set({ error: data.error || '更新工作流步骤失败', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误', loading: false });
    }
  },

  fetchAllParameters: async () => {
    try {
      const data = await apiFetch<{ tables: ParameterTable[]; records: ParameterRecord[] }>(`${BASE_URL}/forecast/parameters/all`);
      if (data.success) {
        set({
          parameterTables: data.data.tables || [],
          parameterRecords: data.data.records || [],
        });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  uploadParametersFile: async (file, strategy) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (strategy) formData.append('strategy', strategy);
      formData.append('importedBy', '数据分析师小祁');
      const res = await fetch(`${BASE_URL}/forecast/parameters/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchParameters();
        await get().fetchWorkflowStatus();
        set({ loading: false });
        return data.data;
      }
      throw new Error(data.error || '参数文件上传失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  uploadCounterExamplesFile: async (file) => {
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('submittedBy', '数据分析师小祁');
      const res = await fetch(`${BASE_URL}/forecast/counter-examples/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        await get().fetchCounterExamples();
        await get().fetchConflicts();
        await get().fetchWorkflowStatus();
        set({ loading: false });
        return {
          success: true,
          message: data.data?.message || '反例导入成功',
          importedCount: data.data?.importedCount || 0,
          duplicateCount: data.data?.duplicateCount || 0,
          mixedFormatCount: data.data?.mixedFormatCount || 0,
          overwrittenCount: data.data?.overwrittenCount || 0,
          skippedCount: data.data?.skippedCount || 0,
          batchId: data.data?.batchId || '',
          tableId: data.data?.tableId || '',
          duplicateProductIds: data.data?.duplicateProductIds || [],
          overwrittenProductIds: data.data?.overwrittenProductIds || [],
          skippedProductIds: data.data?.skippedProductIds || [],
          mixedProductIds: data.data?.mixedProductIds || [],
          allProductIds: data.data?.allProductIds || [],
        } as ImportResult;
      }
      throw new Error(data.error || '反例文件上传失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  updateParameterRecord: async (update) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<ParameterRecord>(`${BASE_URL}/forecast/parameters/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (data.success) {
        await get().fetchParameters();
        await get().fetchWorkflowStatus();
        set({ loading: false });
        return data.data;
      }
      throw new Error(data.error || '参数修正失败');
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误';
      set({ error: message, loading: false });
      throw err;
    }
  },

  fetchAuditLogs: async (limit = 200) => {
    try {
      const data = await apiFetch<AuditLogEntry[]>(`${BASE_URL}/forecast/audit-logs?limit=${limit}`);
      if (data.success) {
        set({ auditLogs: data.data || [] });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  fetchMetadata: async () => {
    try {
      const data = await apiFetch<MetadataState>(`${BASE_URL}/forecast/metadata`);
      if (data.success) {
        set({ metadata: data.data });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '网络错误' });
    }
  },

  setError: (error) => set({ error }),
}));
