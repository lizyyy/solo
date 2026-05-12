const API_BASE = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || response.statusText);
  }

  return response.json();
}

export const api = {
  getStatistics: () => request('/statistics'),
  
  getTasks: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/tasks${params ? '?' + params : ''}`);
  },
  
  getTask: (id) => request(`/tasks/${id}`),
  
  createTask: (data) => request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  failTask: (id, errorMessage) => request(`/tasks/${id}/fail`, {
    method: 'POST',
    body: JSON.stringify({ errorMessage })
  }),
  
  modifyPayload: (id, payload, reason) => request(`/tasks/${id}/payload`, {
    method: 'PUT',
    body: JSON.stringify({ payload, reason })
  }),
  
  getModifications: (id) => request(`/tasks/${id}/modifications`),
  
  getSnapshots: (id) => request(`/tasks/${id}/snapshots`),
  
  getDeadLetters: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/dead-letters${params ? '?' + params : ''}`);
  },
  
  getDeadLetter: (id) => request(`/dead-letters/${id}`),
  
  getReplayHistory: (id) => request(`/dead-letters/${id}/replay-history`),
  
  replayDeadLetter: (id) => request(`/dead-letters/${id}/replay`, {
    method: 'POST',
    body: JSON.stringify({})
  }),
  
  closeDeadLetter: (id, reason) => request(`/dead-letters/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  
  exportData: (type, filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    window.open(`${API_BASE}/export/${type}${params ? '?' + params : ''}`, '_blank');
  },
  
  getInvoices: () => request('/business/invoices'),
  getSms: () => request('/business/sms'),
  getInventory: () => request('/business/inventory'),
  getInventoryLogs: (productId) => request(`/business/inventory/${productId}/logs`),
  
  resetSeed: () => request('/seed', { method: 'POST' })
};
