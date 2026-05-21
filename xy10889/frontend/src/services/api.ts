import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export interface Sample {
  id: string;
  barcode: string;
  status: string;
  type: string;
  collectionPoint: string;
  destinationLab: string;
  currentLocation: string;
  createdAt: string;
  updatedAt: string;
  currentHandler: string;
}

export interface Transfer {
  id: string;
  sampleId: string;
  fromHandler: string;
  toHandler: string;
  fromLocation: string;
  toLocation: string;
  transferTime: string;
  temperature?: number;
  status: string;
}

export interface ExceptionRecord {
  id: string;
  sampleId?: string;
  type: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface ResponsibilityLink {
  id: string;
  sampleId: string;
  handler: string;
  role: string;
  startTime: string;
  location: string;
  action: string;
}

export const sampleApi = {
  getAll: (params?: { status?: string }) => api.get<{ success: boolean; data: Sample[] }>('/samples', { params }),
  getById: (id: string) => api.get<{ success: boolean; data: Sample }>(`/samples/${id}`),
  getByBarcode: (barcode: string) => api.get<{ success: boolean; data: Sample }>(`/samples/barcode/${barcode}`),
  getStatistics: () => api.get<{ success: boolean; data: { total: number; byStatus: Record<string, number> } }>('/samples/statistics'),
  create: (data: Partial<Sample>) => api.post('/samples', data),
  updateStatus: (id: string, data: { newStatus: string; handler: string; notes?: string }) => api.patch(`/samples/${id}/status`, data),
  transfer: (id: string, data: any) => api.post(`/samples/${id}/transfer`, data),
  getTransfers: (id: string) => api.get<{ success: boolean; data: Transfer[] }>(`/samples/${id}/transfers`),
  getResponsibility: (id: string) => api.get<{ success: boolean; data: ResponsibilityLink[] }>(`/samples/${id}/responsibility`),
  getExceptions: (id: string) => api.get<{ success: boolean; data: ExceptionRecord[] }>(`/samples/${id}/exceptions`),
  reportException: (id: string, data: any) => api.post(`/samples/${id}/exceptions`, data),
  compensate: (id: string, data: { newStatus: string; handler: string; notes: string }) => api.post(`/samples/${id}/compensate`, data),
  export: (id: string) => window.open(`/api/samples/${id}/export`, '_blank')
};

export const exceptionApi = {
  getAll: (params?: { resolved?: boolean }) => api.get<{ success: boolean; data: ExceptionRecord[] }>('/exceptions', { params }),
  resolve: (id: string, data: { resolvedBy: string; resolution: string }) => api.patch(`/exceptions/${id}/resolve`, data)
};

export interface Batch {
  id: string;
  batchNumber: string;
  status: string;
  origin: string;
  destination: string;
  estimatedArrival?: string;
  actualArrival?: string;
  courier: string;
  sampleCount: number;
  createdAt: string;
}

export const batchApi = {
  getAll: (params?: { status?: string }) => api.get<{ success: boolean; data: Batch[] }>('/batches', { params }),
  getById: (id: string) => api.get<{ success: boolean; data: Batch }>(`/batches/${id}`),
  create: (data: Partial<Batch>) => api.post('/batches', data),
  updateStatus: (id: string, data: { status: string }) => api.patch(`/batches/${id}/status`, data),
  addSample: (id: string, sampleId: string) => api.post(`/batches/${id}/samples`, { sampleId }),
  removeSample: (id: string, sampleId: string) => api.delete(`/batches/${id}/samples/${sampleId}`),
  getSamples: (id: string) => api.get<{ success: boolean; data: Sample[] }>(`/batches/${id}/samples`)
};

export default api;
