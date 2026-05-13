import axios from 'axios';
import { VisitorRecord, OperationLog, TimelineEvent, ExportFilter, APIResponse } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const visitorAPI = {
  getAll: async (): Promise<VisitorRecord[]> => {
    const response = await api.get<APIResponse<VisitorRecord[]>>('/visitors');
    return response.data.data || [];
  },

  getById: async (id: string): Promise<VisitorRecord> => {
    const response = await api.get<APIResponse<VisitorRecord>>(`/visitors/${id}`);
    return response.data.data!;
  },

  create: async (data: Omit<VisitorRecord, 'id' | 'status' | 'createdAt' | 'updatedAt'>, operator: string, operatorRole: string): Promise<VisitorRecord> => {
    const response = await api.post<APIResponse<VisitorRecord>>('/visitors', { data, operator, operatorRole });
    return response.data.data!;
  },

  hostConfirm: async (id: string, confirmed: boolean, operator: string, operatorRole: string, rejectReason?: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/host-confirm`, { confirmed, operator, operatorRole, rejectReason });
    return response.data.data;
  },

  verifyPlate: async (id: string, plateNumber: string, operator: string, operatorRole: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/plate-entry`, { plateNumber, operator, operatorRole });
    return response.data.data;
  },

  generateQRCode: async (id: string, operator: string, operatorRole: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/generate-qrcode`, { operator, operatorRole });
    return response.data.data;
  },

  scanQRCode: async (id: string, qrcode: string, operator: string, operatorRole: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/scan-qrcode`, { qrcode, operator, operatorRole });
    return response.data.data;
  },

  checkout: async (id: string, checkoutType: 'auto' | 'manual', operator: string, operatorRole: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/checkout`, { checkoutType, operator, operatorRole });
    return response.data.data;
  },

  manualReview: async (id: string, approved: boolean, operator: string, operatorRole: string, reason?: string): Promise<any> => {
    const response = await api.post(`/visitors/${id}/manual-review`, { approved, operator, operatorRole, reason });
    return response.data.data;
  },

  getTimeline: async (id: string): Promise<TimelineEvent[]> => {
    const response = await api.get<APIResponse<TimelineEvent[]>>(`/visitors/${id}/timeline`);
    return response.data.data || [];
  },
};

export const logAPI = {
  getAll: async (filter?: ExportFilter): Promise<OperationLog[]> => {
    const response = await api.get<APIResponse<OperationLog[]>>('/logs', { params: filter });
    return response.data.data || [];
  },

  getOperators: async (): Promise<string[]> => {
    const response = await api.get<APIResponse<string[]>>('/operators');
    return response.data.data || [];
  },
};

export const exportAPI = {
  export: async (filter: ExportFilter): Promise<Blob> => {
    const response = await api.post('/export', filter, { responseType: 'blob' });
    return response.data;
  },
};
