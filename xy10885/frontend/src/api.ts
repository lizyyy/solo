import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const slotsApi = {
  getSlots: (params?: any) => api.get('/slots', { params }),
  getSlot: (id: string) => api.get(`/slots/${id}`),
  getSlotTimeline: (id: string) => api.get(`/slots/${id}/timeline`),
  createSlot: (data: any) => api.post('/slots', data),
  pullSlots: (data: any) => api.post('/slots/pull', data),
  lockSlot: (id: string, data: any) => api.post(`/slots/${id}/lock`, data)
};

export const locksApi = {
  getLocks: (params?: any) => api.get('/locks', { params }),
  getLock: (id: string) => api.get(`/locks/${id}`),
  createLock: (data: any) => api.post(`/slots/${data.slot_id}/lock`, data),
  releaseLock: (id: string, data: any) => api.post(`/locks/${id}/release`, data),
  confirmLock: (id: string, data?: any) => api.post(`/locks/${id}/confirm`, data),
  checkExpired: () => api.post('/locks/check-expired')
};

export const vouchersApi = {
  getVouchers: (params?: any) => api.get('/vouchers', { params }),
  getVoucher: (id: string) => api.get(`/vouchers/${id}`),
  getVoucherByCode: (code: string) => api.get(`/vouchers/code/${code}`),
  checkIn: (id: string, data?: any) => api.post(`/vouchers/${id}/checkin`, data),
  cancel: (id: string, data?: any) => api.post(`/vouchers/${id}/cancel`, data)
};

export const conflictsApi = {
  getConflicts: (params?: any) => api.get('/conflicts', { params }),
  getConflict: (id: string) => api.get(`/conflicts/${id}`),
  resolveConflict: (id: string, data: any) => api.post(`/conflicts/${id}/resolve`, data)
};

export const systemsApi = {
  getSystems: (params?: any) => api.get('/systems', { params }),
  getSystem: (id: string) => api.get(`/systems/${id}`),
  createSystem: (data: any) => api.post('/systems', data),
  updateStatus: (id: string, status: string) => api.patch(`/systems/${id}/status`, { status })
};

export const logsApi = {
  getLogs: (params?: any) => api.get('/logs', { params })
};

export const exportApi = {
  exportSlots: () => window.open('/api/export/slots', '_blank'),
  exportVouchers: (params?: any) => window.open('/api/export/vouchers', '_blank'),
  exportStatistics: () => window.open('/api/export/statistics', '_blank')
};

export const importApi = {
  importSlots: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/slots', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export default api;
