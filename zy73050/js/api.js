// ============================================================
// 后端 API：FastAPI + SQLite 持久化入口
// ============================================================

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
    const params = new URLSearchParams({ filter, keyword });
    const res = await this.request(`/api/workorders?${params.toString()}`);
    return { workorders: res.data || [] };
  },

  async submitWorkorder(payload) {
    const res = await this.request('/api/workorders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      workorder: res.data,
      duplicate: !!res.duplicated,
      existingWorkorder: res.data,
      hash: res.dedupHash,
      message: res.message,
    };
  },

  async addRemark(workorderId, partId, content, author = '宋建国', role = '现场调度') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ partId, content, author, role }),
    });
    const parts = res.data.parts.find(p => p.id === partId);
    const version = parts?.remarkVersions?.[0];
    return { workorder: res.data, version };
  },

  async addScreenshot(workorderId, partId, item, author = '宋建国') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/screenshots`, {
      method: 'POST',
      body: JSON.stringify({ partId, name: item.name, preview: item.preview, author }),
    });
    const parts = res.data.parts.find(p => p.id === partId);
    const version = parts?.screenshotVersions?.[0];
    return { workorder: res.data, version };
  },

  async addSampling(workorderId, sampling) {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/samplings`, {
      method: 'POST',
      body: JSON.stringify(sampling),
    });
    return { workorder: res.data };
  },

  async updateStatus(workorderId, status, operator = '宋建国', operatorRole = '现场调度', note = '') {
    const res = await this.request(`/api/workorders/${encodeURIComponent(workorderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, operator, operatorRole, note }),
    });
    return { workorder: res.data };
  },

  async exportView(filter, keyword) {
    const res = await this.request(`/api/summary`);
    const summary = res.data || {};
    const abnormalRes = await this.request(`/api/abnormal`);
    const abnormals = abnormalRes.data || [];
    const workordersRes = await this.request(`/api/workorders`);
    const workorders = workordersRes.data || [];
    const filtered = filter === 'all' ? workorders : workorders.filter(
      w => w.status === filter
    );
    return {
      exportMeta: {
        exportedAt: new Date().toLocaleString('zh-CN'),
        filter,
        keyword,
        totalCount: filtered.length,
      },
      summary,
      workorders: filtered,
      abnormalRecords: abnormals,
    };
  },

  triggerDownload() {
    const a = document.createElement('a');
    a.href = `/api/export`;
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
