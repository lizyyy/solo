import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const searchRecords = (searchType, searchValue) => {
  return api.post('/search', { searchType, searchValue });
};

export const getRecordDetails = (recordNo) => {
  return api.get(`/records/${recordNo}`);
};

export const checkEligibility = (recordId) => {
  return api.post(`/check-eligibility/${recordId}`);
};

export const verifyIdentity = (recordId, receiverName, receiverIdCard) => {
  return api.post('/verify-identity', { recordId, receiverName, receiverIdCard });
};

export const submitPrintRequest = (recordId, requestType, reason, operator) => {
  return api.post('/print-request', { recordId, requestType, reason, operator });
};

export const confirmReceive = (params) => {
  return api.post('/confirm-receive', params);
};

export const getAuditLogs = (startDate, endDate) => {
  return api.get('/audit-logs', { params: { startDate, endDate } });
};

export const exportAuditLogs = (startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `/api/export-audit${params.toString() ? '?' + params.toString() : ''}`;
  window.open(url, '_blank');
};

export default api;
