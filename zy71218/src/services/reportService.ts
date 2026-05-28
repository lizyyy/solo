import api from './index';
import type { ReportTemplate, PaginatedResponse, ApiResponse } from '../../shared/types';

export interface ReportHistoryItem {
  id: string;
  templateName: string;
  generateTime: string;
  operator: string;
  status: 'pending' | 'success' | 'failed';
  downloadUrl?: string;
}

export const reportService = {
  getTemplates: () => {
    return api.get<unknown, ApiResponse<ReportTemplate[]>>('/report/templates');
  },

  generateReport: (templateId: string, filters: Record<string, any> = {}) => {
    return api.post<unknown, ApiResponse<{ taskId: string; status: string }>>('/report/generate', {
      templateId,
      filters,
    });
  },

  getHistory: (page = 1, pageSize = 10) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    
    return api.get<unknown, ApiResponse<PaginatedResponse<ReportHistoryItem>>>(
      `/report/history?${params.toString()}`
    );
  },
};
