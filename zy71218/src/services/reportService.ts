import api from './index';
import type { ReportTemplate, PaginatedResponse, ApiResponse } from '../../shared/types';

export interface ReportHistoryItem {
  id: string;
  reportId: string;
  templateId: string;
  templateName: string;
  fileName: string;
  fileFormat: string;
  recordCount: number;
  fileSize: number;
  operatorId: string;
  operatorName: string;
  status: string;
  createdAt: string;
}

export const reportService = {
  getTemplates: () => {
    return api.get<unknown, ApiResponse<ReportTemplate[]>>('/report/templates');
  },

  generateReport: (templateId: string, filters: Record<string, any> = {}) => {
    return api.post<unknown, ApiResponse<{
      reportId: string;
      templateId: string;
      templateName: string;
      fileName: string;
      recordCount: number;
      generatedAt: string;
    }>>('/report/generate', {
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

  downloadReport: (reportId: string) => {
    const link = document.createElement('a');
    link.href = `/api/report/download/${reportId}`;
    link.target = '_blank';
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
