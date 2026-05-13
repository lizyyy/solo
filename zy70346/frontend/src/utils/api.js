import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export const templateApi = {
  list: () => api.get('/templates'),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  createVersion: (id, data) => api.post(`/templates/${id}/versions`, data),
  validate: (id, data) => api.post(`/templates/${id}/validate`, data),
  simulate: (id, data) => api.post(`/templates/${id}/simulate`, data),
  gradualRelease: (id, data) => api.post(`/templates/${id}/release/gradual`, data),
  fullRelease: (id, data) => api.post(`/templates/${id}/release/full`, data),
  rollback: (id, data) => api.post(`/templates/${id}/rollback`, data),
  gradualFail: (id, data) => api.post(`/templates/${id}/release/gradual-fail`, data),
  getReleases: (id) => api.get(`/templates/${id}/releases`),
  getVersionDiff: (id, versionId1, versionId2) => 
    api.get(`/templates/${id}/versions/diff?versionId1=${versionId1}&versionId2=${versionId2}`),
  getAudit: (id) => api.get(`/templates/${id}/audit`)
};

export const STATUS_MAP = {
  draft: { label: '草稿', className: 'badge-default' },
  testing: { label: '测试中', className: 'badge-warning' },
  gradual: { label: '灰度中', className: 'badge-primary' },
  full: { label: '全量', className: 'badge-success' },
  rolled_back: { label: '已回滚', className: 'badge-danger' }
};

export const CATEGORY_MAP = {
  verification: { label: '验证码', className: 'category-verification' },
  billing: { label: '账单提醒', className: 'category-billing' },
  promotion: { label: '活动通知', className: 'category-promotion' }
};

export const RELEASE_TYPE_MAP = {
  gradual: '灰度发布',
  full: '全量发布',
  rollback: '回滚'
};

export const RELEASE_STATUS_MAP = {
  pending: { label: '待处理', className: 'badge-default' },
  running: { label: '执行中', className: 'badge-warning' },
  success: { label: '成功', className: 'badge-success' },
  failed: { label: '失败', className: 'badge-danger' }
};

export default api;