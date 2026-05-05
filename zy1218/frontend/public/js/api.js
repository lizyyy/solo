// API 客户端
const API_BASE = '/api/v1';

// 通用 API 调用函数
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// 实验 API
const ExperimentsAPI = {
  async getAll() {
    return apiRequest('/experiments');
  },

  async getById(id) {
    return apiRequest(`/experiments/${id}`);
  },

  async create(data) {
    return apiRequest('/experiments', {
      method: 'POST',
      body: data,
    });
  },

  async update(id, data) {
    return apiRequest(`/experiments/${id}`, {
      method: 'PUT',
      body: data,
    });
  },

  async delete(id) {
    return apiRequest(`/experiments/${id}`, {
      method: 'DELETE',
    });
  },

  async start(id) {
    return apiRequest(`/experiments/${id}/start`, {
      method: 'POST',
    });
  },

  async pause(id) {
    return apiRequest(`/experiments/${id}/pause`, {
      method: 'POST',
    });
  },

  async stop(id) {
    return apiRequest(`/experiments/${id}/stop`, {
      method: 'POST',
    });
  },

  async getTimeline(id, limit = 1000) {
    return apiRequest(`/experiments/${id}/timeline?limit=${limit}`);
  },

  async getEvents(id, options = {}) {
    const params = new URLSearchParams(options).toString();
    return apiRequest(`/experiments/${id}/events${params ? '?' + params : ''}`);
  },

  async getSnapshots(id, limit = 100) {
    return apiRequest(`/experiments/${id}/snapshots?limit=${limit}`);
  },

  async getStatistics(id) {
    return apiRequest(`/experiments/${id}/statistics`);
  },
};

// 事件 API
const EventsAPI = {
  async getAll(limit = 100) {
    return apiRequest(`/events?limit=${limit}`);
  },

  async getById(id) {
    return apiRequest(`/events/${id}`);
  },
};

// 快照 API
const SnapshotsAPI = {
  async getAll(limit = 100) {
    return apiRequest(`/snapshots?limit=${limit}`);
  },

  async getById(id) {
    return apiRequest(`/snapshots/${id}`);
  },
};

// Trace 导入 API
const TracesAPI = {
  async getAll() {
    return apiRequest('/traces');
  },

  async getById(id) {
    return apiRequest(`/traces/${id}`);
  },

  async import(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE}/traces/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

// 报告 API
const ReportsAPI = {
  async getAll() {
    return apiRequest('/reports');
  },

  async getById(id) {
    return apiRequest(`/reports/${id}`);
  },

  async exportMarkdown(experimentId, title = '') {
    return apiRequest('/reports/export/markdown', {
      method: 'POST',
      body: {
        experiment_id: experimentId,
        title,
      },
    });
  },

  async exportJSON(experimentId, title = '') {
    return apiRequest('/reports/export/json', {
      method: 'POST',
      body: {
        experiment_id: experimentId,
        title,
      },
    });
  },
};

// 健康检查
const HealthAPI = {
  async check() {
    return apiRequest('/health');
  },

  async info() {
    return apiRequest('/info');
  },
};

// 工具函数
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms) {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getStatusBadgeClass(status) {
  const classes = {
    'created': 'bg-secondary',
    'running': 'bg-success',
    'paused': 'bg-warning',
    'completed': 'bg-primary',
    'stopped': 'bg-danger',
    'failed': 'bg-dark',
  };
  return classes[status] || 'bg-secondary';
}

function getStatusText(status) {
  const texts = {
    'created': '已创建',
    'running': '运行中',
    'paused': '已暂停',
    'completed': '已完成',
    'stopped': '已停止',
    'failed': '失败',
  };
  return texts[status] || status;
}

function getEventTypeText(type) {
  const texts = {
    'G_CREATE': 'G 创建',
    'G_START': 'G 开始',
    'G_END': 'G 结束',
    'G_BLOCK': 'G 阻塞',
    'G_UNBLOCK': 'G 解除阻塞',
    'G_PREEMPT': 'G 抢占',
    'P_ACQUIRE': 'P 获取',
    'P_RELEASE': 'P 释放',
    'P_STEAL': 'P 窃取',
    'P_GC_ASSIST': 'P GC 协助',
    'M_ACQUIRE_P': 'M 获取 P',
    'M_RELEASE_P': 'M 释放 P',
    'M_PARK': 'M 挂起',
    'M_UNPARK': 'M 唤醒',
    'SYSCALL_ENTER': '系统调用进入',
    'SYSCALL_EXIT': '系统调用退出',
    'NETPOLL_WAIT': '网络轮询等待',
    'NETPOLL_WAKEUP': '网络轮询唤醒',
    'GC_START': 'GC 开始',
    'GC_END': 'GC 结束',
    'GC_MARK_START': 'GC 标记开始',
    'GC_MARK_END': 'GC 标记结束',
    'GC_SWEEP_START': 'GC 清扫开始',
    'GC_SWEEP_END': 'GC 清扫结束',
    'PREEMPT_START': '抢占开始',
    'PREEMPT_END': '抢占结束',
    'SYSMON_PREEMPT': 'Sysmon 抢占',
    'WORK_STEAL_START': 'Work Steal 开始',
    'WORK_STEAL_END': 'Work Steal 结束',
  };
  return texts[type] || type;
}

function getEventTypeBadgeClass(type) {
  if (type.startsWith('G_')) return 'bg-primary';
  if (type.startsWith('P_')) return 'bg-success';
  if (type.startsWith('M_')) return 'bg-info';
  if (type.startsWith('SYSCALL')) return 'bg-warning';
  if (type.startsWith('NETPOLL')) return 'bg-secondary';
  if (type.startsWith('GC')) return 'bg-dark';
  if (type.startsWith('PREEMPT') || type.startsWith('SYSMON')) return 'bg-danger';
  if (type.startsWith('WORK')) return 'bg-purple';
  return 'bg-secondary';
}

// 导出 API 对象
window.API = {
  Experiments: ExperimentsAPI,
  Events: EventsAPI,
  Snapshots: SnapshotsAPI,
  Traces: TracesAPI,
  Reports: ReportsAPI,
  Health: HealthAPI,
};

window.Utils = {
  formatDateTime,
  formatDuration,
  getStatusBadgeClass,
  getStatusText,
  getEventTypeText,
  getEventTypeBadgeClass,
};
