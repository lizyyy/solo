const API_BASE = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

export const invoices = {
  list: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return request(`/invoices?${searchParams.toString()}`);
  },
  get: (id) => request(`/invoices/${id}`),
  create: (data) =>
    request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    request(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  review: (id, data) =>
    request(`/invoices/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id) =>
    request(`/invoices/${id}`, {
      method: 'DELETE'
    }),
  batchDelete: (ids) =>
    request('/invoices/batch/delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    }),
  stats: () => request('/invoices/stats')
};

export const reports = {
  list: () => request('/reports'),
  get: (id) => request(`/reports/${id}`),
  generate: (data) =>
    request('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

export const importExport = {
  importCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/import-export/import/csv`, {
      method: 'POST',
      body: formData
    }).then((r) => r.json());
  },
  importJSON: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/import-export/import/json`, {
      method: 'POST',
      body: formData
    }).then((r) => r.json());
  },
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return fetch(`${API_BASE}/import-export/upload/image`, {
      method: 'POST',
      body: formData
    }).then((r) => r.json());
  },
  exportCSV: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return `/api/import-export/export/csv?${searchParams.toString()}`;
  },
  exportJSON: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return `/api/import-export/export/json?${searchParams.toString()}`;
  }
};

export const STATUS_MAP = {
  pending: { label: '待审核', class: 'status-pending' },
  reviewing: { label: '审核中', class: 'status-reviewing' },
  exception: { label: '异常', class: 'status-exception' },
  approved: { label: '已通过', class: 'status-approved' },
  rejected: { label: '已拒绝', class: 'status-rejected' }
};

export const EXCEPTION_TYPE_MAP = {
  amount_mismatch: '金额不匹配',
  tax_number_invalid: '税号无效',
  approval_missing: '审批信息缺失',
  image_clearness: '图片清晰度',
  duplicate: '重复票据',
  other: '其他异常'
};

export const ACTION_MAP = {
  create: '创建',
  update: '更新',
  approve: '审核通过',
  reject: '审核拒绝',
  reviewing: '标记审核中'
};
