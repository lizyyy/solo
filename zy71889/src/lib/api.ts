import type {
  ExperimentBatch,
  TimelineEvent,
  ViscosityEstimate,
  Correction,
  ManualConfirmation,
  GradingSheet,
  CreateBatchRequest,
  CreateCorrectionRequest,
  CreateConfirmationRequest,
} from '@shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  getBatches: () => request<ExperimentBatch[]>('/batches'),

  getBatch: (id: string) => request<ExperimentBatch>(`/batches/${id}`),

  createBatch: (data: CreateBatchRequest) =>
    request<{ batch: ExperimentBatch; isDuplicate: boolean; existingBatches: ExperimentBatch[] }>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTimeline: (batchId: string) => request<TimelineEvent[]>(`/batches/${batchId}/timeline`),

  getViscosityHistory: (batchId: string) =>
    request<ViscosityEstimate[]>(`/batches/${batchId}/viscosity`),

  runViscosityEstimate: (batchId: string) =>
    request<ViscosityEstimate>(`/batches/${batchId}/viscosity`, {
      method: 'POST',
    }),

  addCorrection: (batchId: string, data: CreateCorrectionRequest) =>
    request<Correction>(`/batches/${batchId}/corrections`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addConfirmation: (batchId: string, data: CreateConfirmationRequest) =>
    request<ManualConfirmation>(`/batches/${batchId}/confirmations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getGradingSheet: (batchId: string) =>
    request<GradingSheet>(`/batches/${batchId}/grading`),

  generateGradingSheet: (batchId: string) =>
    request<GradingSheet>(`/batches/${batchId}/grading`, {
      method: 'POST',
    }),

  getBatchVersions: (batchId: string) =>
    request<ExperimentBatch[]>(`/batches/${batchId}/versions`),
};

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: ExperimentBatch['status']): string {
  const labels: Record<ExperimentBatch['status'], string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    needs_review: '需复核',
  };
  return labels[status];
}

export function getJudgmentLabel(judgment: ViscosityEstimate['judgment']): string {
  const labels: Record<ViscosityEstimate['judgment'], string> = {
    pass: '通过',
    fail: '未通过',
    borderline: '边界值',
    insufficient_data: '数据不足',
  };
  return labels[judgment];
}

export function getCorrectionCategoryLabel(category: Correction['category']): string {
  const labels: Record<Correction['category'], string> = {
    praise: '表扬',
    suggestion: '建议',
    error: '错误',
    deduction: '扣分',
  };
  return labels[category];
}
