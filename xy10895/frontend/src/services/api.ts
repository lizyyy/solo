import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiEntry {
  id: number;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  status: string;
  owner_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  permission_level: string;
  version: string;
  created_at: string;
  updated_at: string;
  favorite_count: number;
  example_count: number;
}

export interface Owner {
  id: number;
  name: string;
  email: string;
  department: string;
  api_count: number;
  created_at: string;
}

export interface Permission {
  id: number;
  api_id: number;
  role: string;
  description: string;
  created_at: string;
}

export interface ExampleRequest {
  id: number;
  api_id: number;
  title: string;
  request_body: string;
  response_body: string;
  headers: string;
  is_active: number;
  created_at: string;
}

export interface ChangeLog {
  id: number;
  api_id: number;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  description: string;
  created_at: string;
}

export const apiService = {
  getHealth: () => api.get('/health'),
  
  getApiList: (params?: {
    search?: string;
    status?: string;
    method?: string;
    permission_level?: string;
    owner_id?: number;
    page?: number;
    limit?: number;
  }) => api.get('/apis', { params }),
  
  getApiDetail: (id: number) => api.get(`/apis/${id}`),
  
  createApiEntry: (data: Partial<ApiEntry>) => api.post('/apis', data),
  
  updateApiStatus: (id: number, data: { new_status: string; changed_by: string; reason: string }) =>
    api.patch(`/apis/${id}/status`, data),
  
  addExampleRequest: (apiId: number, data: Partial<ExampleRequest>) =>
    api.post(`/apis/${apiId}/examples`, data),
  
  bulkImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  exportReport: (format: 'json' | 'csv' = 'json') =>
    api.get(`/export?format=${format}`, { responseType: 'blob' }),
  
  toggleFavorite: (apiId: number, userEmail: string) =>
    api.post(`/favorites/${apiId}/toggle`, { user_email: userEmail }),
  
  getFavorites: (userEmail: string) =>
    api.get('/favorites', { params: { user_email: userEmail } }),
  
  getOwners: () => api.get('/owners'),
  
  createOwner: (data: Partial<Owner>) => api.post('/owners', data),
};

export default apiService;
