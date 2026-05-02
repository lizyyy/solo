const API_BASE = '/api';

export const api = {
  getStats: async () => {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) throw new Error('获取统计数据失败');
    return response.json();
  },

  getSamples: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    const url = `${API_BASE}/samples${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('获取样品列表失败');
    return response.json();
  },

  getSample: async (id) => {
    const response = await fetch(`${API_BASE}/samples/${id}`);
    if (!response.ok) throw new Error('获取样品信息失败');
    return response.json();
  },

  getSampleCategories: async () => {
    const response = await fetch(`${API_BASE}/samples/categories`);
    if (!response.ok) throw new Error('获取分类列表失败');
    return response.json();
  },

  createSample: async (data) => {
    const response = await fetch(`${API_BASE}/samples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建样品失败');
    }
    return response.json();
  },

  updateSample: async (id, data) => {
    const response = await fetch(`${API_BASE}/samples/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '更新样品失败');
    }
    return response.json();
  },

  deleteSample: async (id) => {
    const response = await fetch(`${API_BASE}/samples/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '删除样品失败');
    }
    return response.json();
  },

  getBorrowRecords: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    const url = `${API_BASE}/borrow-records${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('获取借用记录失败');
    return response.json();
  },

  createBorrowRecord: async (data) => {
    const response = await fetch(`${API_BASE}/borrow-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建借用记录失败');
    }
    return response.json();
  },

  returnBorrowRecord: async (id, data) => {
    const response = await fetch(`${API_BASE}/borrow-records/${id}/return`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '归还操作失败');
    }
    return response.json();
  },

  importSamples: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('csvFile', file);
    
    const response = await fetch(`${API_BASE}/samples/import`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '导入失败');
    }
    return response.json();
  },

  exportBorrowRecords: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) queryParams.append(key, value);
    });
    const url = `${API_BASE}/borrow-records/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('导出失败');
    
    const blob = await response.blob();
    const urlObject = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'borrow-records.csv';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    a.href = urlObject;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(urlObject);
    document.body.removeChild(a);
  },

  exportTemplate: async () => {
    const response = await fetch(`${API_BASE}/samples/export-template`);
    if (!response.ok) throw new Error('导出模板失败');
    
    const blob = await response.blob();
    const urlObject = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlObject;
    a.download = 'sample-import-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(urlObject);
    document.body.removeChild(a);
  }
};

export const SampleStatusMap = {
  AVAILABLE: { label: '可借', color: 'success' },
  BORROWED: { label: '已借出', color: 'warning' },
  DAMAGED: { label: '损坏', color: 'error' },
  LOST: { label: '丢失', color: 'error' }
};

export const BorrowStatusMap = {
  BORROWED: { label: '借用中', color: 'warning' },
  RETURNED: { label: '已归还', color: 'success' },
  OVERDUE: { label: '已逾期', color: 'error' }
};
