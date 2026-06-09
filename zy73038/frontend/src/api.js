const BASE = 'http://localhost:3001/api';

async function request(url, opts = {}) {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(msg.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getReports: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports${q ? '?' + q : ''}`);
  },
  getSummary: () => request('/reports/summary'),
  getReport: (id) => request(`/reports/${id}`),
  createReport: (data) => request('/reports', { method: 'POST', body: data }),
  addMaterial: (id, data) => request(`/reports/${id}/materials`, { method: 'POST', body: data }),
  setVerdict: (id, data) => request(`/reports/${id}/verdict`, { method: 'POST', body: data }),
  setStatus: (id, data) => request(`/reports/${id}/status`, { method: 'POST', body: data }),
  exportReport: (id, data) => request(`/reports/${id}/export`, { method: 'POST', body: data || {} }),
  getAnomalies: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/anomalies${q ? '?' + q : ''}`);
  },
  resolveAnomaly: (id, data) => request(`/anomalies/${id}/resolve`, { method: 'POST', body: data }),
};

export const STATUS_LABELS = {
  draft: { text: '草稿', cls: 'bg-gray-100 text-gray-700' },
  pending: { text: '待审核', cls: 'bg-blue-100 text-blue-700' },
  suspended: { text: '已挂起', cls: 'bg-amber-100 text-amber-700' },
  approved: { text: '已核准', cls: 'bg-green-100 text-green-700' },
  rejected: { text: '已驳回', cls: 'bg-red-100 text-red-700' },
};

export const MATERIAL_LABELS = {
  handwritten: { text: '病历手写单', cls: 'bg-purple-100 text-purple-700' },
  mismatch: { text: '标题/明细不符', cls: 'bg-orange-100 text-orange-700' },
  verbal: { text: '口头说明', cls: 'bg-sky-100 text-sky-700' },
  supplement: { text: '补充材料', cls: 'bg-indigo-100 text-indigo-700' },
};

export const ANOMALY_LABELS = {
  dosage_changed: { text: '用药剂量变更', cls: 'bg-amber-100 text-amber-700' },
  material_mismatch: { text: '材料标题冲突', cls: 'bg-orange-100 text-orange-700' },
  info_conflict: { text: '新旧信息冲突', cls: 'bg-rose-100 text-rose-700' },
  late_supplement: { text: '收尾补充信息', cls: 'bg-fuchsia-100 text-fuchsia-700' },
};
