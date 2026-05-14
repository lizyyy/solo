import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000
});

export const annotationApi = {
  create: (data) => api.post('/annotations', data),
  list: (params) => api.get('/annotations', { params }),
  get: (id) => api.get(`/annotations/${id}`),
  updateStatus: (id, data) => api.put(`/annotations/${id}/status`, data),
  getVersions: (id) => api.get(`/annotations/${id}/versions`),
  replayVersion: (id, version, data) => api.post(`/annotations/${id}/replay/${version}`, data),
  getTimeline: (id) => api.get(`/annotations/${id}/timeline`)
};

export const metricsApi = {
  list: (params) => api.get('/metrics', { params }),
  getStatistics: () => api.get('/metrics/statistics')
};

export const exportApi = {
  getInsights: (id) => api.get(`/export/insights/${id}`),
  downloadExcel: (id) => {
    window.open(`http://localhost:3001/api/export/excel/${id}`, '_blank');
  }
};

export const statusMap = {
  draft: { label: '草稿', color: 'default' },
  pending_approval: { label: '待审批', color: 'warning' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
  published: { label: '已发布', color: 'success' },
  revoked: { label: '已撤销', color: 'warning' },
  archived: { label: '已归档', color: 'default' },
  cancelled: { label: '已取消', color: 'error' },
  recalled: { label: '已召回', color: 'warning' },
  correction_pending: { label: '待修正', color: 'warning' }
};

export const eventTypeMap = {
  bug: { label: '系统异常', icon: 'BugOutlined' },
  feature: { label: '新功能上线', icon: 'RocketOutlined' },
  marketing: { label: '营销活动', icon: 'ShopOutlined' },
  operation: { label: '运营调整', icon: 'SettingOutlined' },
  incident: { label: '重大事件', icon: 'AlertOutlined' }
};

export const impactLevelMap = {
  low: { label: '低影响', color: 'success' },
  medium: { label: '中等影响', color: 'warning' },
  high: { label: '高影响', color: 'orange' },
  critical: { label: '严重影响', color: 'error' }
};

export const scopeTypeMap = {
  chart: '指定图表',
  metric: '指定指标',
  dimension: '指定维度',
  date_range: '日期范围',
  global: '全局生效'
};

export default api;
