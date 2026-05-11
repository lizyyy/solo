const API_BASE_URL = 'http://localhost:3001/api';

const api = {
  buildings: {
    list: (params = {}) => axios.get(`${API_BASE_URL}/buildings`, { params }),
    get: (id) => axios.get(`${API_BASE_URL}/buildings/${id}`),
    create: (data) => axios.post(`${API_BASE_URL}/buildings`, data),
    update: (id, data) => axios.put(`${API_BASE_URL}/buildings/${id}`, data),
    delete: (id) => axios.delete(`${API_BASE_URL}/buildings/${id}`)
  },

  contractors: {
    list: (params = {}) => axios.get(`${API_BASE_URL}/contractors`, { params }),
    create: (data) => axios.post(`${API_BASE_URL}/contractors`, data),
    update: (id, data) => axios.put(`${API_BASE_URL}/contractors/${id}`, data),
    delete: (id) => axios.delete(`${API_BASE_URL}/contractors/${id}`)
  },

  problems: {
    list: (params = {}) => axios.get(`${API_BASE_URL}/problems`, { params }),
    get: (id) => axios.get(`${API_BASE_URL}/problems/${id}`),
    create: (data) => axios.post(`${API_BASE_URL}/problems`, data),
    update: (id, data) => axios.put(`${API_BASE_URL}/problems/${id}`, data),
    delete: (id) => axios.delete(`${API_BASE_URL}/problems/${id}`),
    assign: (id, data) => axios.post(`${API_BASE_URL}/problems/${id}/assign`, data),
    recheck: (id, data) => axios.post(`${API_BASE_URL}/problems/${id}/recheck`, data),
    ownerConfirm: (id) => axios.post(`${API_BASE_URL}/problems/${id}/owner-confirm`),
    calculateCompensation: (id, data) => axios.post(`${API_BASE_URL}/problems/${id}/calculate-compensation`, data)
  },

  dashboard: {
    stats: () => axios.get(`${API_BASE_URL}/dashboard/stats`),
    kanban: (params = {}) => axios.get(`${API_BASE_URL}/dashboard/kanban`, { params })
  },

  export: {
    rooms: () => window.open(`${API_BASE_URL}/dashboard/export/rooms`, '_blank'),
    problems: (status = '') => window.open(`${API_BASE_URL}/dashboard/export/problems${status ? '?status=' + status : ''}`, '_blank'),
    compensations: () => window.open(`${API_BASE_URL}/dashboard/export/compensations`, '_blank')
  }
};

const PROBLEM_TYPES = ['墙面空鼓', '门窗渗水', '电路问题', '水管漏水', '瓷砖脱落', '墙面不平', '其他'];
const PROBLEM_CATEGORIES = ['墙面工程', '门窗工程', '水电工程', '泥木工程', '油漆工程', '综合维修', '其他'];
const PROBLEM_STATUS_MAP = {
  '待派单': { type: 'info', color: '#909399' },
  '待整改': { type: 'warning', color: '#e6a23c' },
  '待复验': { type: 'primary', color: '#409eff' },
  '已完成': { type: 'success', color: '#67c23a' }
};

const handleError = (error, defaultMsg = '操作失败') => {
  const message = error.response?.data?.message || error.message || defaultMsg;
  ElementPlus.ElMessage.error(message);
};

const handleSuccess = (message = '操作成功') => {
  ElementPlus.ElMessage.success(message);
};
