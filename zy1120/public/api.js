const API_BASE = '/api';

const api = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };
    
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `请求失败: ${response.status}`);
      }
      if (response.status === 204) return null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  },

  getKilns() {
    return this.request('/kilns');
  },

  getKiln(id) {
    return this.request(`/kilns/${id}`);
  },

  createKiln(data) {
    return this.request('/kilns', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateKiln(id, data) {
    return this.request(`/kilns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteKiln(id) {
    return this.request(`/kilns/${id}`, {
      method: 'DELETE'
    });
  },

  getBodies() {
    return this.request('/bodies');
  },

  getBody(id) {
    return this.request(`/bodies/${id}`);
  },

  createBody(data) {
    return this.request('/bodies', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateBody(id, data) {
    return this.request(`/bodies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteBody(id) {
    return this.request(`/bodies/${id}`, {
      method: 'DELETE'
    });
  },

  getGlazes() {
    return this.request('/glazes');
  },

  getGlaze(id) {
    return this.request(`/glazes/${id}`);
  },

  createGlaze(data) {
    return this.request('/glazes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateGlaze(id, data) {
    return this.request(`/glazes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteGlaze(id) {
    return this.request(`/glazes/${id}`, {
      method: 'DELETE'
    });
  },

  getPieces() {
    return this.request('/pieces');
  },

  getPiece(id) {
    return this.request(`/pieces/${id}`);
  },

  createPiece(data) {
    return this.request('/pieces', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updatePiece(id, data) {
    return this.request(`/pieces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deletePiece(id) {
    return this.request(`/pieces/${id}`, {
      method: 'DELETE'
    });
  },

  getPlans() {
    return this.request('/plans');
  },

  getPlan(id) {
    return this.request(`/plans/${id}`);
  },

  createPlan(data) {
    return this.request('/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updatePlan(id, data) {
    return this.request(`/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deletePlan(id) {
    return this.request(`/plans/${id}`, {
      method: 'DELETE'
    });
  },

  calculatePlan(id) {
    return this.request(`/plans/${id}/calculate`, {
      method: 'POST'
    });
  },

  comparePlans(planId1, planId2) {
    return this.request(`/plans/compare/${planId1}/${planId2}`);
  },

  exportPlanMarkdown(id) {
    return fetch(`${API_BASE}/plans/${id}/export/markdown`);
  },

  exportPlanHtml(id) {
    return fetch(`${API_BASE}/plans/${id}/export/html`);
  },

  getRecords() {
    return this.request('/records');
  },

  getRecord(id) {
    return this.request(`/records/${id}`);
  },

  createRecord(data) {
    return this.request('/records', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateRecord(id, data) {
    return this.request(`/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteRecord(id) {
    return this.request(`/records/${id}`, {
      method: 'DELETE'
    });
  },

  health() {
    return this.request('/health');
  }
};
