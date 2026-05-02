import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const eventDatesApi = {
  getAll: () => api.get('/event-dates'),
  getById: (id) => api.get(`/event-dates/${id}`),
  create: (data) => api.post('/event-dates', data),
  update: (id, data) => api.put(`/event-dates/${id}`, data),
  delete: (id) => api.delete(`/event-dates/${id}`),
  addRequirement: (dateId, data) => api.post(`/event-dates/${dateId}/requirements`, data),
  deleteRequirement: (dateId, reqId) => api.delete(`/event-dates/${dateId}/requirements/${reqId}`),
};

export const positionsApi = {
  getAll: () => api.get('/positions'),
  getById: (id) => api.get(`/positions/${id}`),
  create: (data) => api.post('/positions', data),
  update: (id, data) => api.put(`/positions/${id}`, data),
  delete: (id) => api.delete(`/positions/${id}`),
};

export const skillsApi = {
  getAll: () => api.get('/skills'),
  getById: (id) => api.get(`/skills/${id}`),
  create: (data) => api.post('/skills', data),
  update: (id, data) => api.put(`/skills/${id}`, data),
  delete: (id) => api.delete(`/skills/${id}`),
};

export const volunteersApi = {
  getAll: () => api.get('/volunteers'),
  getById: (id) => api.get(`/volunteers/${id}`),
  create: (data) => api.post('/volunteers', data),
  update: (id, data) => api.put(`/volunteers/${id}`, data),
  delete: (id) => api.delete(`/volunteers/${id}`),
};

export const schedulesApi = {
  getAll: (params) => api.get('/schedules', { params }),
  getById: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  batchCreate: (schedules) => api.post('/schedules/batch', { schedules }),
  deleteAll: () => api.delete('/schedules'),
};

export const conflictsApi = {
  getAll: () => api.get('/conflicts'),
  getByScheduleId: (scheduleId) => api.get(`/conflicts/schedule/${scheduleId}`),
};

export const schedulingApi = {
  generate: (clearExisting = false) => api.post('/scheduling/generate', { clearExisting }),
};

export const importExportApi = {
  importVolunteers: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import-export/import/volunteers', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  exportSchedules: () => {
    window.open('/api/import-export/export/schedules', '_blank');
  },
  exportVolunteers: () => {
    window.open('/api/import-export/export/volunteers', '_blank');
  },
};

export default api;
