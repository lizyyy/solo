import axios from 'axios';

const api = axios.create({
  baseURL: '',
  timeout: 10000,
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;

export const getStatusBadgeClass = (status) => {
  const statusMap = {
    '待抽检': 'status-pending',
    '抽检中': 'status-active',
    '待处理': 'status-warning',
    '隔离中': 'status-danger',
    '返工中': 'status-active',
    '待复判': 'status-pending',
    '完成': 'status-success',
    '报废': 'status-danger',
  };
  return statusMap[status] || 'status-warning';
};

export const getSeverityBadgeClass = (severity) => {
  const severityMap = {
    '轻微': 'severity-minor',
    '一般': 'severity-medium',
    '严重': 'severity-major',
    '致命': 'severity-critical',
  };
  return severityMap[severity] || 'severity-medium';
};
