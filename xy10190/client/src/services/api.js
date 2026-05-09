import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/';
      }
    }
    if (error.response?.data?.message) {
      message.error(error.response.data.message);
    }
    return Promise.reject(error);
  }
);

export const login = (username, password) => {
  return api.post('/auth/login', { username, password }).then(res => res.data);
};

export const logout = () => {
  return api.post('/auth/logout').then(res => res.data);
};

export const getCurrentUser = () => {
  return api.get('/auth/me').then(res => res.data);
};

export const getApprovers = () => {
  return api.get('/auth/approvers').then(res => res.data);
};

export const getCandidates = (params = {}) => {
  return api.get('/candidates', { params }).then(res => res.data);
};

export const getCandidate = (id) => {
  return api.get(`/candidates/${id}`).then(res => res.data);
};

export const createCandidate = (data) => {
  return api.post('/candidates', data).then(res => res.data);
};

export const updateCandidate = (id, data) => {
  return api.put(`/candidates/${id}`, data).then(res => res.data);
};

export const deleteCandidate = (id) => {
  return api.delete(`/candidates/${id}`).then(res => res.data);
};

export const getOffers = (params = {}) => {
  return api.get('/offers', { params }).then(res => res.data);
};

export const getOffer = (id) => {
  return api.get(`/offers/${id}`).then(res => res.data);
};

export const createOffer = (data) => {
  return api.post('/offers', data).then(res => res.data);
};

export const updateOffer = (id, data) => {
  return api.put(`/offers/${id}`, data).then(res => res.data);
};

export const submitOffer = (id) => {
  return api.post(`/offers/${id}/submit`).then(res => res.data);
};

export const withdrawOffer = (id, reason) => {
  return api.post(`/offers/${id}/withdraw`, { reason }).then(res => res.data);
};

export const acceptOffer = (id) => {
  return api.post(`/offers/${id}/accept`).then(res => res.data);
};

export const rejectOfferByCandidate = (id, reason) => {
  return api.post(`/offers/${id}/reject-candidate`, { reason }).then(res => res.data);
};

export const deleteOffer = (id) => {
  return api.delete(`/offers/${id}`).then(res => res.data);
};

export const getMyPendingApprovals = () => {
  return api.get('/approvals/my-pending').then(res => res.data);
};

export const approveOffer = (id, comment) => {
  return api.post(`/approvals/${id}/approve`, { comment }).then(res => res.data);
};

export const rejectOffer = (id, comment) => {
  return api.post(`/approvals/${id}/reject`, { comment }).then(res => res.data);
};

export const getApprovalHistory = (offerId) => {
  return api.get(`/approvals/${offerId}/history`).then(res => res.data);
};

export const getAuditLogs = (params = {}) => {
  return api.get('/audit', { params }).then(res => res.data);
};

export const getOfferAuditLogs = (offerId) => {
  return api.get(`/audit/offer/${offerId}`).then(res => res.data);
};

export const getDashboardData = () => {
  return api.get('/reports/dashboard').then(res => res.data);
};

export const downloadOfferPDF = (offerId) => {
  window.open(`/api/reports/offer/${offerId}/pdf`, '_blank');
};

export const exportOffers = (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  window.open(`/api/reports/offers/export?${queryString}`, '_blank');
};

export default api;
