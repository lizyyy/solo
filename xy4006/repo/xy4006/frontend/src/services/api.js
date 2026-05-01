const API_BASE = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || '请求失败');
  }
  
  return data.data;
}

export const suppliesApi = {
  getAll: () => request('/supplies'),
  getById: (id) => request(`/supplies/${id}`),
  create: (supply) => request('/supplies', {
    method: 'POST',
    body: JSON.stringify(supply)
  }),
  update: (id, supply) => request(`/supplies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(supply)
  }),
  delete: (id) => request(`/supplies/${id}`, {
    method: 'DELETE'
  })
};

export const borrowRecordsApi = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/borrow-records?${queryString}` : '/borrow-records';
    return request(url);
  },
  getById: (id) => request(`/borrow-records/${id}`),
  create: (record) => request('/borrow-records', {
    method: 'POST',
    body: JSON.stringify(record)
  }),
  return: (id, data) => request(`/borrow-records/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

export const statsApi = {
  getOverview: () => request('/stats')
};
