const BASE_URL = '';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  
  return data;
}

export const api = {
  getHealth: () => request('/api/health'),
  
  getCustomers: () => request('/api/customers'),
  getCustomer: (id) => request(`/api/customers/${id}`),
  createCustomer: (data) => request('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
  
  getPlans: () => request('/api/plans'),
  getPlan: (id) => request(`/api/plans/${id}`),
  createPlan: (data) => request('/api/plans', { method: 'POST', body: JSON.stringify(data) }),
  
  checkRate: (customerId, timestamp = null) => 
    request(`/api/customers/${customerId}/rate/check`, {
      method: 'POST',
      body: JSON.stringify({ timestamp })
    }),
  
  recordUsage: (customerId, data = {}) =>
    request(`/api/customers/${customerId}/usage/record`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  getTimeline: (customerId) => request(`/api/customers/${customerId}/timeline`),
  getExcess: (customerId, limit = 50) => request(`/api/customers/${customerId}/excess?limit=${limit}`),
  getBilling: (customerId, from = null, to = null) => {
    let url = `/api/customers/${customerId}/billing`;
    const params = [];
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    if (params.length) url += `?${params.join('&')}`;
    return request(url);
  },
  
  subscribe: (customerId, data) =>
    request(`/api/customers/${customerId}/subscribe`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  upgrade: (customerId, planId, operator = 'admin') =>
    request(`/api/customers/${customerId}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ planId, operator })
    }),
  
  downgrade: (customerId, planId, effectiveAt = null, operator = 'admin') =>
    request(`/api/customers/${customerId}/downgrade`, {
      method: 'POST',
      body: JSON.stringify({ planId, effectiveAt, operator })
    }),
  
  boost: (customerId, boostAmount, durationHours, operator = 'admin') =>
    request(`/api/customers/${customerId}/boost`, {
      method: 'POST',
      body: JSON.stringify({ boostAmount, durationHours, operator })
    }),
  
  processPending: () => request('/api/system/process-pending', { method: 'POST' }),
  expireSubscriptions: () => request('/api/system/expire-subscriptions', { method: 'POST' })
};
