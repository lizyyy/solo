import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export const renewalAPI = {
  create: (data) => api.post('/renewal', data),
  update: (id, data) => api.put(`/renewal/${id}`, data),
  list: (params) => api.get('/renewal', { params }),
};

export const plateBindingAPI = {
  create: (data) => api.post('/plate-binding', data),
  update: (id, data) => api.put(`/plate-binding/${id}`, data),
  list: (params) => api.get('/plate-binding', { params }),
  detail: (id) => api.get(`/plate-binding/${id}`),
};

export const arrearsAPI = {
  create: (data) => api.post('/arrears', data),
  update: (id, data) => api.put(`/arrears/${id}`, data),
  list: (params) => api.get('/arrears', { params }),
  detail: (id) => api.get(`/arrears/${id}`),
};

export const blacklistAPI = {
  add: (data) => api.post('/blacklist', data),
  review: (id, data) => api.put(`/blacklist/${id}/review`, data),
  list: (params) => api.get('/blacklist', { params }),
};

export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
  abnormal: (params) => api.get('/dashboard/abnormal', { params }),
};

export const reportAPI = {
  export: (params) => {
    const queryString = new URLSearchParams(params).toString();
    window.open(`/api/report/export?${queryString}`, '_blank');
  },
  flowRecords: (params) => api.get('/flow-records', { params }),
};

export default api;
