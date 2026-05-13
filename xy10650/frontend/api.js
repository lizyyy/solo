const API_BASE = 'http://localhost:3000/api';

const api = {
    async get(endpoint, params = {}) {
        const url = new URL(API_BASE + endpoint);
        Object.entries(params).forEach(([k, v]) => v && url.searchParams.append(k, v));
        const res = await fetch(url);
        return res.json();
    },

    async post(endpoint, data = {}, requestId = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (requestId) headers['X-Request-ID'] = requestId;
        const res = await fetch(API_BASE + endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async put(endpoint, data = {}, requestId = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (requestId) headers['X-Request-ID'] = requestId;
        const res = await fetch(API_BASE + endpoint, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async upload(endpoint, file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(API_BASE + endpoint, {
            method: 'POST',
            body: formData
        });
        return res.json();
    }
};

const hazardApi = {
    list: (filters) => api.get('/hazards', filters),
    get: (id) => api.get('/hazards/' + id),
    create: (data, requestId) => api.post('/hazards', data, requestId),
    updateDeadline: (id, data, requestId) => api.put('/hazards/' + id + '/deadline', data, requestId),
    submitReview: (id, data, requestId) => api.post('/hazards/' + id + '/review', data, requestId),
    highRisk: () => api.get('/hazards/high-risk'),
    export: (filters) => window.open(API_BASE + '/export/hazards?' + new URLSearchParams(filters).toString())
};

const fineApi = {
    list: (filters) => api.get('/fines', filters),
    review: (id, data, requestId) => api.put('/fines/' + id + '/review', data, requestId)
};

const teamApi = {
    list: () => api.get('/teams'),
    create: (data) => api.post('/teams', data)
};

const logApi = {
    list: (filters) => api.get('/logs', filters),
    timeline: (hazardId) => api.get('/logs/timeline/' + hazardId)
};

const importApi = {
    importHazards: (file) => api.upload('/import/hazards', file)
};