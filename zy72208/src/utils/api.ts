import type { 
  SettlementBatch, 
  SettlementDetail, 
  SelfCheckResult,
  ImportRawRow,
  CurrencyReviewDecision,
  DetailStatus,
  ReplayCommand,
  ConsistencyCheckResult
} from '../../shared/types.js';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const batchApi = {
  create: (data: { rawData: ImportRawRow[]; operator: string; importSource: 'PASTE' | 'FILE_UPLOAD'; fileHash?: string }) =>
    request<SettlementBatch & { details: SettlementDetail[] }>('/batches', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  list: (params?: { status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    return request<{ items: SettlementBatch[]; total: number }>(`/batches?${query.toString()}`);
  },
  
  get: (id: string) =>
    request<SettlementBatch & { details: SettlementDetail[] }>(`/batches/${id}`),
  
  runSelfCheck: (id: string, checkTypes?: string[]) =>
    request<SelfCheckResult[]>(`/batches/${id}/self-check`, {
      method: 'POST',
      body: JSON.stringify({ checkTypes })
    }),
  
  getSelfCheck: (id: string) =>
    request<SelfCheckResult[]>(`/batches/${id}/self-check`),
  
  recalculate: (id: string, operator: string) =>
    request<{ recalculatedCount: number; results: any[] }>(`/batches/${id}/recalculate`, {
      method: 'POST',
      body: JSON.stringify({ operator })
    }),
  
  riskReview: (id: string, data: {
    operator: string;
    updates: Array<{
      detailId: string;
      taxRate?: number;
      taxRateRemark?: string;
      currencyDecision?: CurrencyReviewDecision;
      currencyRemark?: string;
    }>;
  }) =>
    request<{ recalculatedCount: number; results: any[] }>(`/batches/${id}/risk-review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  auditUpdate: (id: string, data: {
    operator: string;
    statusUpdates: Array<{ detailId: string; newStatus: DetailStatus; remark?: string }>;
  }) =>
    request<{ updatedCount: number }>(`/batches/${id}/audit-update`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  complete: (id: string) =>
    request<SettlementBatch>(`/batches/${id}/complete`, { method: 'POST' }),

  runCommand: (id: string, command: string) =>
    request<{ success: boolean; summary: string }>(`/batches/${id}/run-command`, {
      method: 'POST',
      body: JSON.stringify({ command })
    })
};

export const detailApi = {
  get: (id: string) =>
    request<SettlementDetail & { snapshot: any; auditLogs: any[] }>(`/details/${id}`),
  
  update: (id: string, data: { fieldName: string; value: any; remark?: string; operator: string }) =>
    request<SettlementDetail>(`/details/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  
  currencyReview: (id: string, data: { decision: CurrencyReviewDecision; remark?: string; operator: string }) =>
    request<SettlementDetail>(`/details/${id}/currency-review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getAuditTrail: (id: string) =>
    request<any[]>(`/details/${id}/audit-trail`)
};

export const exportApi = {
  download: (id: string, format: 'xlsx' | 'csv' = 'xlsx') => {
    const url = `${API_BASE}/export/${id}?format=${format}`;
    window.open(url, '_blank');
  },
  
  checkConsistency: (id: string) =>
    request<ConsistencyCheckResult>(`/export/${id}/consistency-check`),
  
  getReplayCommand: (id: string) =>
    request<ReplayCommand>(`/export/${id}/replay-command`)
};

export function parsePastedData(text: string): ImportRawRow[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].split(/\t|,|\s{2,}/).map(h => h.trim());
  
  const rows: ImportRawRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/\t|,|\s{2,}/).map(v => v.trim());
    const row: any = { lineNo: i };
    
    headers.forEach((header, idx) => {
      const key = header.toLowerCase();
      const value = values[idx] || '';
      
      if (key.includes('保单') || key.includes('policy') || key.includes('单号')) {
        row.policyNo = value;
      } else if (key.includes('产品') || key.includes('product') || key.includes('名称')) {
        row.productName = value;
      } else if (key.includes('佣金') || key.includes('金额') || key.includes('commission') || key.includes('amount')) {
        row.commissionAmount = value;
      } else if (key.includes('币种') || key.includes('货币') || key.includes('currency') || key.includes('币别')) {
        row.currency = value;
      } else {
        row[key] = value;
      }
    });
    
    if (row.policyNo || row.currency || row.commissionAmount) {
      if (!row.policyNo) row.policyNo = `AUTO-${Date.now()}-${i}`;
      rows.push(row as ImportRawRow);
    }
  }
  
  return rows;
}
