import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const setUserId = (userId) => {
  api.defaults.headers.common['X-User-Id'] = userId;
};

export const usersAPI = {
  getAll: () => api.get('/users/'),
  create: (data) => api.post('/users/', data),
};

export const articlesAPI = {
  getAll: (params) => api.get('/articles/', { params }),
  get: (id) => api.get(`/articles/${id}`),
  create: (data) => api.post('/articles/', data),
  update: (id, data) => api.put(`/articles/${id}`, data),
  rollback: (id) => api.post(`/articles/${id}/rollback`),
  retry: (id) => api.post(`/articles/${id}/retry`),
  getFeedbacks: (id) => api.get(`/articles/${id}/feedbacks/`),
  getFeedbackTrend: (articleId, days = 7) => api.get(`/articles/${articleId}/feedback-trend`, { params: { days } }),
};

export const feedbacksAPI = {
  create: (data) => api.post('/feedbacks/', data),
};

export const revisionDraftsAPI = {
  getAll: (params) => api.get('/revision-drafts/', { params }),
  create: (data) => api.post('/revision-drafts/', data),
};

export const statsAPI = {
  get: () => api.get('/stats/'),
};

export default api;
