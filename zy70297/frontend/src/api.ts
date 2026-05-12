import {
  Merchant,
  Inspection,
  RectificationTaskWithSuggestion,
  ReportData,
  StatusChange,
} from './types';

const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(BASE_URL + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  getMerchants: () => request<Merchant[]>('/merchants'),
  
  getMerchant: (id: string) => request<{
    merchant: Merchant;
    inspections: Inspection[];
    tasks: RectificationTaskWithSuggestion[];
  }>(`/merchants/${id}`),
  
  createInspection: (data: {
    merchantId: string;
    inspector: string;
    inspectionDate: string;
    problems: Array<{
      problemType: string;
      description: string;
      severity: string;
    }>;
    remarks: string;
  }) => request<{
    inspection: Inspection;
    tasks: RectificationTaskWithSuggestion[];
  }>('/inspections', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  getTasks: () => request<RectificationTaskWithSuggestion[]>('/rectification-tasks'),
  
  getTask: (id: string) => request<{
    task: RectificationTaskWithSuggestion;
    history: StatusChange[];
  }>(`/rectification-tasks/${id}`),
  
  scheduleReview: (id: string, data: { reviewDate: string; handler: string }) => 
    request<{ task: RectificationTaskWithSuggestion }>(`/rectification-tasks/${id}/schedule-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  completeReview: (id: string, data: { result: 'passed' | 'failed'; handler: string }) =>
    request<{
      task: RectificationTaskWithSuggestion;
      gasCutOffTriggered: boolean;
      note: string;
    }>(`/rectification-tasks/${id}/complete-review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  cutOffGas: (id: string, data: { handler: string; reason: string }) =>
    request<{ task: RectificationTaskWithSuggestion; gasCutOff: boolean }>(
      `/rectification-tasks/${id}/cut-off-gas`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  
  restoreGas: (id: string, data: { handler: string }) =>
    request<{ task: RectificationTaskWithSuggestion; gasRestored: boolean }>(
      `/rectification-tasks/${id}/restore-gas`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  
  getReport: () => request<ReportData>('/reports'),
  
  getHealth: () => request('/health'),
};
