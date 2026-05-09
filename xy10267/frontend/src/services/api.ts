import { ApiResponse } from '../types';

const API_BASE = '/api';

const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误'
    };
  }
};

export const api = {
  health: () => request<{ message: string }>('/health'),
  
  getState: () => request('/state'),
  
  aunts: {
    getAll: () => request('/aunts'),
    getById: (id: string) => request(`/aunts/${id}`),
    create: (data: unknown) => request('/aunts', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: unknown) => request(`/aunts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => request(`/aunts/${id}`, {
      method: 'DELETE'
    })
  },
  
  customers: {
    getAll: () => request('/customers'),
    getById: (id: string) => request(`/customers/${id}`),
    create: (data: unknown) => request('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: unknown) => request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => request(`/customers/${id}`, {
      method: 'DELETE'
    })
  },
  
  orders: {
    getAll: () => request('/orders'),
    getById: (id: string) => request(`/orders/${id}`),
    create: (data: unknown) => request('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: unknown) => request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => request(`/orders/${id}`, {
      method: 'DELETE'
    })
  },
  
  assignments: {
    getAll: () => request('/assignments'),
    getByOrder: (orderId: string) => request(`/assignments/order/${orderId}`),
    getCandidates: (orderId: string) => request(`/assignments/candidates/${orderId}`),
    create: (data: { orderId: string; auntId: string }) => request('/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: unknown) => request(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  
  leaves: {
    getAll: () => request('/leaves'),
    getByAunt: (auntId: string) => request(`/leaves/aunt/${auntId}`),
    create: (data: unknown) => request('/leaves', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    approve: (id: string) => request(`/leaves/${id}/approve`, {
      method: 'PUT'
    }),
    reject: (id: string) => request(`/leaves/${id}/reject`, {
      method: 'PUT'
    })
  },
  
  history: {
    getAll: (limit = 100) => request(`/history?limit=${limit}`),
    getByEntity: (type: string, id: string) => request(`/history/entity/${type}/${id}`)
  },
  
  dashboard: {
    getStats: () => request('/dashboard/stats'),
    getBlockedOrders: () => request('/dashboard/blocked-orders')
  }
};
