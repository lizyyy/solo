const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('procurement_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('procurement_session_id', sessionId);
    }
    return sessionId;
  }

  async request(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      credentials: 'same-origin',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data);
    }

    return data;
  }

  async getDrafts() {
    return this.request('/drafts');
  }

  async getDraft(id) {
    return this.request(`/drafts/${id}`);
  }

  async createDraft(title) {
    return this.request('/drafts', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async updateDraft(id, data, options = {}) {
    const { current_step, version, isAutoSave } = options;
    return this.request(`/drafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        current_step,
        data,
        version,
        sessionId: this.sessionId,
        isAutoSave,
      }),
    });
  }

  async deleteDraft(id) {
    return this.request(`/drafts/${id}`, {
      method: 'DELETE',
    });
  }

  async submitDraft(id, submitter) {
    return this.request(`/drafts/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ submitter }),
    });
  }

  async getSubmissions() {
    return this.request('/submissions');
  }

  async getSubmission(id) {
    return this.request(`/submissions/${id}`);
  }

  async getHealth() {
    return this.request('/health');
  }
}

class ApiError extends Error {
  constructor(status, response) {
    super(response.error || `API Error: ${status}`);
    this.status = status;
    this.response = response;
    this.name = 'ApiError';
  }

  isConflict() {
    return this.status === 409 && this.response?.conflict;
  }

  getConflictData() {
    if (this.isConflict()) {
      return {
        serverVersion: this.response.serverVersion,
        clientVersion: this.response.clientVersion,
      };
    }
    return null;
  }
}

const api = new ApiClient();
