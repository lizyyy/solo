const Api = {
  enabled: false,

  async request(path, options = {}) {
    const res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`API ${res.status}: ${detail}`);
    }
    return res.json();
  },

  async health() {
    return this.request('/api/health');
  },

  async loadWorkorders(filter = 'all', keyword = '') {
    const params = new URLSearchParams({ status: filter, keyword });
    const res = await this.request(`/api/workorders?${params.toString()}`);
    return { workorders: res.data || [], counts: res.counts || {} };
  },

  async submitWorkorder(payload) {
    const res = await this.request('/api/workorders/submit', {
      method: 'POST',
      body: JSON.stringify({ workorder: payload }),
    });
    return {
      workorder: res.workorder,
      duplicate: !!res.duplicate,
      hash: res.hash,
      submitCount: res.submitCount,
      message: res.message,
    };
  },

  async addRemark(workorderId, partId, content, author = '宋建国', role = '现场调度') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/parts/${encodeURIComponent(partId)}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ content, author, role }),
    });
    return { version: res.version, workorder: res.workorder };
  },

  async addScreenshot(workorderId, partId, name, preview = '📷', author = '宋建国', role = '现场调度') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/parts/${encodeURIComponent(partId)}/screenshots`, {
      method: 'POST',
      body: JSON.stringify({ name, preview, author, role }),
    });
    return { version: res.version, workorder: res.workorder };
  },

  async addSampling(workorderId, sampling) {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/samplings`, {
      method: 'POST',
      body: JSON.stringify(sampling),
    });
    return { workorder: res.workorder };
  },

  async updateStatus(workorderId, status, operator = '宋建国', operatorRole = '现场调度', note = '') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, operator, operatorRole, note }),
    });
    return { workorder: res.workorder };
  },

  async overrideWorkorder(workorderId, reason, operator = '张总监', operatorRole = '运维负责人') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/override`, {
      method: 'POST',
      body: JSON.stringify({ reason, operator, operatorRole }),
    });
    return { workorder: res.workorder };
  },

  async getSummary() {
    const res = await this.request('/api/summary');
    return res.data || {};
  },

  async getAbnormal() {
    const res = await this.request('/api/abnormal');
    return res.data || [];
  },

  async getHistory(workorderId) {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/history`);
    return res;
  },

  triggerDownload() {
    const a = document.createElement('a');
    a.href = '/api/export';
    a.click();
  },

  replaceLocalWorkorders(workorders) {
    WORKORDERS.splice(0, WORKORDERS.length, ...workorders);
  },

  replaceLocalWorkorder(workorder) {
    const index = WORKORDERS.findIndex(item => item.id === workorder.id);
    if (index >= 0) {
      WORKORDERS.splice(index, 1, workorder);
    } else {
      WORKORDERS.unshift(workorder);
    }
  },
};
