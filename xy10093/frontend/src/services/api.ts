import type { ReworkOrder, ReworkRecord, StatsSummary, Anomaly } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

export const orderApi = {
  list(params: Record<string, any> = {}): Promise<{ total: number; page: number; page_size: number; data: ReworkOrder[] }> {
    const qs = new URLSearchParams(params).toString();
    return request(`${BASE}/orders${qs ? '?' + qs : ''}`);
  },
  detail(id: number): Promise<{ order: ReworkOrder; rework_records: ReworkRecord[]; history: any[]; anomalies: Anomaly[] }> {
    return request(`${BASE}/orders/${id}`);
  },
  create(data: Partial<ReworkOrder>): Promise<{ id: number }> {
    return request(`${BASE}/orders`, { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: number, data: Partial<ReworkOrder>): Promise<{ success: boolean }> {
    return request(`${BASE}/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  remove(id: number): Promise<{ success: boolean }> {
    return request(`${BASE}/orders/${id}`, { method: 'DELETE' });
  },
  addRecord(id: number, data: any): Promise<{ id: number; rework_count: number }> {
    return request(`${BASE}/orders/${id}/records`, { method: 'POST', body: JSON.stringify(data) });
  },
  addQualityCheck(recordId: number, data: any): Promise<{ id: number }> {
    return request(`${BASE}/orders/records/${recordId}/quality-check`, { method: 'POST', body: JSON.stringify(data) });
  },
  close(id: number, data: any): Promise<{ success: boolean }> {
    return request(`${BASE}/orders/${id}/close`, { method: 'POST', body: JSON.stringify(data) });
  },
  stats(): Promise<StatsSummary> {
    return request(`${BASE}/orders/stats/summary`);
  }
};

export const anomalyApi = {
  list(params: Record<string, any> = {}): Promise<{ data: Anomaly[] }> {
    const qs = new URLSearchParams(params).toString();
    return request(`${BASE}/anomalies${qs ? '?' + qs : ''}`);
  },
  create(data: Partial<Anomaly>): Promise<{ id: number }> {
    return request(`${BASE}/anomalies`, { method: 'POST', body: JSON.stringify(data) });
  },
  resolve(id: number, data: any): Promise<{ success: boolean }> {
    return request(`${BASE}/anomalies/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) });
  },
  remove(id: number): Promise<{ success: boolean }> {
    return request(`${BASE}/anomalies/${id}`, { method: 'DELETE' });
  }
};

export const importExportApi = {
  exportOrders() {
    window.location.href = `${BASE}/export/orders`;
  },
  async importOrders(file: File): Promise<any> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/import/orders`, { method: 'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '导入失败');
    }
    return res.json();
  }
};
