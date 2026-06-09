import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.response.use(
    res => res.data,
    err => { console.error('API Error:', err); return { code: -1, message: err.message }; }
);

export const reportAPI = {
    list: params => api.get('/reports', { params }),
    get: id => api.get(`/reports/${id}`),
    create: data => api.post('/reports', data),
    review: (id, data) => api.post(`/reports/${id}/review`, data),
    audits: id => api.get(`/reports/${id}/audits`),
    partsHistory: id => api.get(`/reports/${id}/parts-history`),
};

export const partsAPI = {
    submit: (reportId, data) => api.post(`/reports/${reportId}/parts`, data),
};

export const modelAPI = {
    replace: (reportId, data) => api.post(`/reports/${reportId}/model-replace`, data),
};

export const exportAPI = {
    create: data => api.post('/exports', data),
    getByTrace: traceId => api.get(`/exports/${traceId}`),
    list: () => api.get('/exports'),
};

export const healthCheck = () => api.get('/health');
