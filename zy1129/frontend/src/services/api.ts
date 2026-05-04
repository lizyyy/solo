import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const membersApi = {
  list: () => api.get('/members/'),
  get: (id: number) => api.get(`/members/${id}`),
  create: (data: any) => api.post('/members/', data),
  update: (id: number, data: any) => api.put(`/members/${id}`, data),
  delete: (id: number) => api.delete(`/members/${id}`),
};

export const policiesApi = {
  list: (params?: { member_id?: number; policy_type?: string; is_active?: boolean }) =>
    api.get('/policies/', { params }),
  get: (id: number) => api.get(`/policies/${id}`),
  create: (data: any) => api.post('/policies/', data),
  update: (id: number, data: any) => api.put(`/policies/${id}`, data),
  delete: (id: number) => api.delete(`/policies/${id}`),
};

export const coveragesApi = {
  list: (policy_id?: number) =>
    api.get('/coverages/', { params: policy_id ? { policy_id } : {} }),
  get: (id: number) => api.get(`/coverages/${id}`),
  create: (data: any) => api.post('/coverages/', data),
  update: (id: number, data: any) => api.put(`/coverages/${id}`, data),
  delete: (id: number) => api.delete(`/coverages/${id}`),
};

export const incidentsApi = {
  list: (params?: { member_id?: number; incident_type?: string; status?: string }) =>
    api.get('/incidents/', { params }),
  get: (id: number) => api.get(`/incidents/${id}`),
  create: (data: any) => api.post('/incidents/', data),
  update: (id: number, data: any) => api.put(`/incidents/${id}`, data),
  delete: (id: number) => api.delete(`/incidents/${id}`),
};

export const claimsApi = {
  list: (params?: { incident_id?: number; policy_id?: number; status?: string }) =>
    api.get('/claims/', { params }),
  get: (id: number) => api.get(`/claims/${id}`),
  create: (data: any) => api.post('/claims/', data),
  update: (id: number, data: any) => api.put(`/claims/${id}`, data),
  delete: (id: number) => api.delete(`/claims/${id}`),
  getTimeline: (id: number) => api.get(`/claims/${id}/timeline`),
  getDocuments: (id: number) => api.get(`/claims/${id}/documents`),
  addDocument: (id: number, data: any) => api.post(`/claims/${id}/documents`, data),
  updateDocument: (id: number, data: any) => api.put(`/claims/documents/${id}`, data),
  deleteDocument: (id: number) => api.delete(`/claims/documents/${id}`),
};

export const analysisApi = {
  analyzeIncident: (incident_id: number, estimated_loss?: number) =>
    api.post(`/analysis/incident/${incident_id}`, null, {
      params: estimated_loss ? { estimated_loss } : {},
    }),
  getAnalysis: (incident_id: number, estimated_loss?: number) =>
    api.get(`/analysis/incident/${incident_id}`, {
      params: estimated_loss ? { estimated_loss } : {},
    }),
};

export const dashboardApi = {
  getRiskDashboard: () => api.get('/dashboard/risk'),
  getSummary: () => api.get('/dashboard/summary'),
};

export const importApi = {
  importMembers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/members', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importPolicies: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/policies', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importClaimRules: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/claim-rules', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const uploadApi = {
  uploadFiles: (formData: FormData) => api.post('/import/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const exportApi = {
  exportPoliciesCsv: (params?: { member_id?: number; policy_type?: string }) =>
    api.get('/export/policies/csv', { params, responseType: 'blob' }),
  exportIncidentsCsv: (params?: { member_id?: number; status?: string }) =>
    api.get('/export/incidents/csv', { params, responseType: 'blob' }),
  exportClaimsCsv: (params?: { incident_id?: number; status?: string }) =>
    api.get('/export/claims/csv', { params, responseType: 'blob' }),
  exportMarkdown: (params?: {
    member_id?: number;
    policy_type?: string;
    include_policies?: boolean;
    include_incidents?: boolean;
    include_claims?: boolean;
  }) => api.get('/export/report/markdown', { params, responseType: 'blob' }),
  exportHtml: (params?: {
    member_id?: number;
    policy_type?: string;
    include_policies?: boolean;
    include_incidents?: boolean;
    include_claims?: boolean;
  }) => api.get('/export/report/html', { params }),
  exportAllReport: (params?: {
    format?: string;
    member_id?: number;
    policy_type?: string;
  }) => {
    if (params?.format === 'markdown') {
      return api.get('/export/report/markdown', { 
        params: { member_id: params.member_id, policy_type: params.policy_type },
        responseType: 'blob' 
      });
    } else if (params?.format === 'html') {
      return api.get('/export/report/html', { 
        params: { member_id: params.member_id, policy_type: params.policy_type },
      });
    } else {
      return api.get('/export/policies/csv', { 
        params: { member_id: params?.member_id, policy_type: params?.policy_type },
        responseType: 'blob' 
      });
    }
  },
};

export default api;
