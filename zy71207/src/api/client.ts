import type {
  AuditRecord,
  AuditLinkNode,
  AuditStats,
  RateVersion,
  ProductContract,
  RollbackRecord,
  AuditStatus,
} from '../../shared/types';

const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.blob() as unknown as T;
}

export const api = {
  getStats: (): Promise<AuditStats> => request('/stats'),

  getAudits: (filters?: {
    status?: AuditStatus;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditRecord[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString();
    return request(`/audits${query ? `?${query}` : ''}`);
  },

  getAudit: (id: string): Promise<AuditRecord> => request(`/audits/${id}`),

  getAuditChain: (id: string): Promise<AuditLinkNode[]> => request(`/audits/${id}/chain`),

  createAudit: (data: { customerId: string; productId: string; chargeId: string }): Promise<AuditRecord> =>
    request('/audits', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recalculateAudit: (id: string): Promise<AuditRecord> =>
    request(`/audits/${id}/recalculate`, { method: 'POST' }),

  generateRollback: (id: string): Promise<{
    rollback: RollbackRecord;
    planDetails: {
      rollbackAmount: number;
      compensationAmount: number;
      compensationRate: number;
      totalAmount: number;
      calculation: string[];
    };
  }> => request(`/audits/${id}/rollback`, { method: 'POST' }),

  resolveAudit: (id: string): Promise<AuditRecord> =>
    request(`/audits/${id}/resolve`, { method: 'POST' }),

  executeRollback: (id: string): Promise<RollbackRecord> =>
    request(`/rollback/${id}/execute`, { method: 'POST' }),

  getRateVersions: (): Promise<RateVersion[]> => request('/rate-versions'),

  getContracts: (): Promise<ProductContract[]> => request('/contracts'),

  exportAudit: (id: string): Promise<Blob> => request(`/export/audit/${id}`),

  exportAudits: (filters?: {
    status?: string;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const query = params.toString();
    return request(`/export/audits${query ? `?${query}` : ''}`);
  },
};

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
