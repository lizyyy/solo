import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.data && error.response.data.detail) {
        error.message = error.response.data.detail;
      } else if (error.response.status === 404) {
        error.message = '请求的资源不存在';
      } else if (error.response.status === 500) {
        error.message = '服务器内部错误';
      }
    }
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getLowStock: () => api.get('/dashboard/low-stock'),
  getOverdueOrders: () => api.get('/dashboard/overdue-orders'),
};

export const technicianAPI = {
  getAll: (params = {}) => api.get('/technicians', { params }),
  getById: (id) => api.get(`/technicians/${id}`),
  create: (data) => api.post('/technicians', data),
  update: (id, data) => api.put(`/technicians/${id}`, data),
  getSchedule: (id, date) => api.get(`/technicians/${id}/schedule`, { params: { date } }),
};

export const sparePartAPI = {
  getAll: (params = {}) => api.get('/spare-parts', { params }),
  getById: (id) => api.get(`/spare-parts/${id}`),
  create: (data) => api.post('/spare-parts', data),
  update: (id, data) => api.put(`/spare-parts/${id}`, data),
  stockIn: (id, data) => api.post(`/spare-parts/${id}/stock-in`, data),
};

export const repairOrderAPI = {
  getAll: (params = {}) => api.get('/repair-orders', { params }),
  getById: (id) => api.get(`/repair-orders/${id}`),
  create: (data) => api.post('/repair-orders', data),
  update: (id, data) => api.put(`/repair-orders/${id}`, data),
  updateStatus: (id, data) => api.patch(`/repair-orders/${id}/status`, data),
  getValidTransitions: (id) => api.get(`/repair-orders/${id}/valid-transitions`),
  adjustCost: (id, data) => api.patch(`/repair-orders/${id}/cost`, data),
  markPaid: (id) => api.post(`/repair-orders/${id}/mark-paid`),
  consumeParts: (id, data) => api.post(`/repair-orders/${id}/consume-parts`, data),
  addCommunicationLog: (id, data) => api.post(`/repair-orders/${id}/communication-logs`, data),
};

export const commonAPI = {
  getStatusTransitions: () => api.get('/status-transitions'),
  getDeviceTypes: () => api.get('/device-types'),
  getOrderStatuses: () => api.get('/order-statuses'),
};

export const backupAPI = {
  export: () => api.get('/backup/export'),
  import: (file, overwrite = false) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/backup/import?overwrite=${overwrite}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;
