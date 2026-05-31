import type { GuaranteeRecord, OperationLog, ImportResult, QueryFilters } from './types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || '请求失败');
  }
  
  return data.data;
}

export const api = {
  getRecords: (filters: QueryFilters = {}, page: number = 1, pageSize: number = 50) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    params.append('page', String(page));
    params.append('pageSize', String(pageSize));
    
    return request<{ records: GuaranteeRecord[]; total: number; page: number; pageSize: number }>(
      `/records?${params.toString()}`
    );
  },

  getStats: () => {
    return request<any>(`/records/stats`);
  },

  getRecord: (id: number) => {
    return request<{ record: GuaranteeRecord; logs: OperationLog[] }>(`/records/${id}`);
  },

  getRecordLogs: (id: number) => {
    return request<OperationLog[]>(`/records/${id}/logs`);
  },

  createRecord: (data: Partial<GuaranteeRecord> & { operator?: string }) => {
    return request<{ record: GuaranteeRecord; isDuplicate: boolean; duplicateWith?: number }>(`/records`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateRecord: (id: number, data: Partial<GuaranteeRecord> & { operator?: string; reason?: string }) => {
    return request<GuaranteeRecord>(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  withdrawRecord: (id: number, operator: string, reason: string) => {
    return request<GuaranteeRecord>(`/records/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ operator, reason })
    });
  },

  approveRecord: (id: number, operator: string, reason?: string) => {
    return request<GuaranteeRecord>(`/records/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ operator, reason })
    });
  },

  rejectRecord: (id: number, operator: string, reason: string) => {
    return request<GuaranteeRecord>(`/records/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ operator, reason })
    });
  },

  resolveDispute: (id: number, operator: string, isDuplicate: boolean, mergeWithId?: number, reason?: string) => {
    return request<GuaranteeRecord>(`/records/${id}/resolve-dispute`, {
      method: 'POST',
      body: JSON.stringify({ operator, isDuplicate, mergeWithId, reason })
    });
  },

  batchImport: (records: Array<Partial<GuaranteeRecord>>, operator: string) => {
    return request<ImportResult>(`/records/import`, {
      method: 'POST',
      body: JSON.stringify({ operator, records })
    });
  },

  importCSV: (csvContent: string, operator: string) => {
    return request<ImportResult>(`/records/import/csv`, {
      method: 'POST',
      body: JSON.stringify({ operator, csvContent })
    });
  },

  exportCSV: (filters: QueryFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    
    window.open(`${API_BASE}/records/export/csv?${params.toString()}`, '_blank');
  },

  exportReviewList: (status: string = 'pending,disputed') => {
    window.open(`${API_BASE}/records/export/review-list?status=${status}`, '_blank');
  }
};
