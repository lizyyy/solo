const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

export const levelsApi = {
  getAll: () => request('/levels'),
  getById: (id) => request(`/levels/${id}`),
  create: (data) => request('/levels', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => request(`/levels/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => request(`/levels/${id}`, {
    method: 'DELETE',
  }),
};

export const rehearsalsApi = {
  getAll: (levelId) => {
    const endpoint = levelId ? `/rehearsals?levelId=${levelId}` : '/rehearsals';
    return request(endpoint);
  },
  getById: (id) => request(`/rehearsals/${id}`),
  create: (data) => request('/rehearsals', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id, data) => request(`/rehearsals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (id) => request(`/rehearsals/${id}`, {
    method: 'DELETE',
  }),
};

export const dataApi = {
  importScene: (file) => {
    const formData = new FormData();
    formData.append('sceneFile', file);
    return fetch(`${API_BASE}/data/import-scene`, {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },
  importProps: (file) => {
    const formData = new FormData();
    formData.append('propsFile', file);
    return fetch(`${API_BASE}/data/import-props`, {
      method: 'POST',
      body: formData,
    }).then(r => r.json());
  },
  parseJson: (jsonString, type) => request('/data/parse-json', {
    method: 'POST',
    body: JSON.stringify({ jsonString, type }),
  }),
};

export const exportApi = {
  exportMarkdown: (rehearsalId) => {
    window.open(`${API_BASE}/export/markdown/${rehearsalId}`, '_blank');
  },
  exportJson: (rehearsalId) => {
    window.open(`${API_BASE}/export/json/${rehearsalId}`, '_blank');
  },
};

export default {
  levels: levelsApi,
  rehearsals: rehearsalsApi,
  data: dataApi,
  export: exportApi,
};
