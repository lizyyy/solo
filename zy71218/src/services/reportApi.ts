import { get, post } from './api';
import type { ReportTemplate, PaginatedResponse } from '../../shared/types';

interface ReportHistoryItem {
  id: string;
  templateId: string;
  templateName: string;
  generatedAt: string;
  generatedBy: string;
  status: 'pending' | 'completed' | 'failed';
  downloadUrl?: string;
}

export const getTemplates = (): Promise<ReportTemplate[]> => {
  return get('/reports/templates');
};

export const generateReport = (templateId: string, filters?: any): Promise<{ reportId: string }> => {
  return post('/reports/generate', { templateId, filters });
};

export const getReportHistory = (params?: any): Promise<PaginatedResponse<ReportHistoryItem>> => {
  return get('/reports/history', params);
};
