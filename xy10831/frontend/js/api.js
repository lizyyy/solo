const API_BASE = 'http://localhost:5000/api';

async function apiRequest(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });
    
    const data = await response.json();
    return data;
}

const API = {
    health: () => apiRequest('/health'),
    
    getRequests: (page = 1, search = '', status = '') => {
        let url = `/requests?page=${page}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${status}`;
        return apiRequest(url);
    },
    
    createRequest: (data) => apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    
    getRules: () => apiRequest('/rules'),
    
    createRule: (data) => apiRequest('/rules', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    
    updateRule: (id, data) => apiRequest(`/rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    
    deleteRule: (id) => apiRequest(`/rules/${id}`, {
        method: 'DELETE',
    }),
    
    getEnvironments: () => apiRequest('/environments'),
    
    createEnvironment: (data) => apiRequest('/environments', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    
    deleteEnvironment: (id) => apiRequest(`/environments/${id}`, {
        method: 'DELETE',
    }),
    
    getApprovals: () => apiRequest('/approvals'),
    
    createApproval: (data) => apiRequest('/approvals', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    
    approve: (id, approver, note) => apiRequest(`/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approver, note }),
    }),
    
    reject: (id, approver, note) => apiRequest(`/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approver, note }),
    }),
    
    getReplays: () => apiRequest('/replays'),
    
    executeReplay: (data) => apiRequest('/replays', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    
    getComparisons: () => apiRequest('/comparisons'),
    
    createComparison: (baselineId, comparisonId) => apiRequest('/comparisons', {
        method: 'POST',
        body: JSON.stringify({ baseline_id: baselineId, comparison_id: comparisonId }),
    }),
    
    getAuditLogs: (page = 1) => apiRequest(`/audit?page=${page}`),
    
    previewMask: (data) => apiRequest('/mask/preview', {
        method: 'POST',
        body: JSON.stringify({ data }),
    }),
    
    initDemo: () => apiRequest('/init-demo', {
        method: 'POST',
    }),
};
