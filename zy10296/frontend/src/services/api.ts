import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const familyApi = {
  getAll: (status?: string) => api.get('/families', { params: { status } }),
  getById: (id: number) => api.get(`/families/${id}`),
  create: (data: any) => api.post('/families', data),
  approve: (id: number, reviewer?: string, remarks?: string) => 
    api.put(`/families/${id}/approve`, { reviewer, remarks }),
  reject: (id: number, reviewer?: string, remarks?: string) => 
    api.put(`/families/${id}/reject`, { reviewer, remarks }),
};

export const materialApi = {
  getAll: () => api.get('/materials'),
  create: (data: any) => api.post('/materials', data),
};

export const batchApi = {
  getAll: () => api.get('/batches'),
  create: (data: any) => api.post('/batches', data),
  close: (id: number) => api.put(`/batches/${id}/close`),
};

export const distributionApi = {
  getAll: (params?: { status?: string; needReview?: boolean; familyId?: number }) => 
    api.get('/distributions', { params }),
  getById: (id: number) => api.get(`/distributions/${id}`),
  getByFamilyId: (familyId: number) => api.get(`/distributions/family/${familyId}`),
  create: (data: any) => api.post('/distributions', data),
  approve: (id: number, operator?: string, quantity?: number) => 
    api.put(`/distributions/${id}/approve`, { operator, quantity }),
  reject: (id: number, operator?: string, reason?: string) => 
    api.put(`/distributions/${id}/reject`, { operator, reason }),
  return: (id: number, quantity: number, reason: string, operator?: string) => 
    api.post(`/distributions/${id}/return`, { quantity, reason, operator }),
};

export const inventoryApi = {
  getAll: () => api.get('/inventory'),
  export: () => window.open('/api/export/inventory', '_blank'),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getRecent: () => api.get('/dashboard/recent'),
};

export default api;
