import { Transaction, Explanation, VersionHistory, Statistics, ReviewRequest, TransactionFilters, PaginatedResponse } from './types';

const API_BASE = '/api/transactions';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

export const api = {
  getStatistics: (): Promise<Statistics> =>
    request<Statistics>(`${API_BASE}/statistics`),

  getTransactions: (page: number, pageSize: number, filters: TransactionFilters = {}): Promise<PaginatedResponse<Transaction>> => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    return request<PaginatedResponse<Transaction>>(`${API_BASE}?${params.toString()}`);
  },

  getTransaction: (transactionId: string): Promise<{
    transaction: Transaction;
    explanations: Explanation[];
    version_history: VersionHistory[];
  }> =>
    request(`${API_BASE}/${transactionId}`),

  importFile: (file: File, operator: string = 'system'): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('operator', operator);

    return fetch(`${API_BASE}/import`, {
      method: 'POST',
      body: formData,
    }).then((res) => {
      if (!res.ok) {
        return res.json().then((e) => {
          throw new Error(e.error || '导入失败');
        });
      }
      return res.json();
    });
  },

  importJson: (data: any[], operator: string = 'system'): Promise<any> =>
    request(`${API_BASE}/import/json`, {
      method: 'POST',
      body: JSON.stringify({ data, operator }),
    }),

  reviewTransaction: (data: ReviewRequest): Promise<{ success: boolean; message: string }> =>
    request(`${API_BASE}/review`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  rollbackTransaction: (transactionId: string, operator: string = 'system'): Promise<{ success: boolean; message: string }> =>
    request(`${API_BASE}/rollback/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ operator }),
    }),

  getVersionHistory: (transactionId: string): Promise<VersionHistory[]> =>
    request<VersionHistory[]>(`${API_BASE}/history/${transactionId}`),

  getExportUrl: (filters: {
    start_date?: string;
    end_date?: string;
    status?: string;
    format: 'csv' | 'json';
  }): string => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.status) params.append('status', filters.status);
    params.append('format', filters.format);
    return `${API_BASE}/export?${params.toString()}`;
  },
};
