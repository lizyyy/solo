import api from './index';
import type { BusinessCase, CaseDetail, CaseStatus, PaginatedResponse, ApiResponse } from '../../shared/types';

interface CaseFilters {
  status?: string;
  riskLevel?: string;
  keyword?: string;
}

export const caseService = {
  getCaseList: (page = 1, pageSize = 10, filters: CaseFilters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
    if (filters.keyword) params.append('keyword', filters.keyword);
    
    return api.get<unknown, ApiResponse<PaginatedResponse<BusinessCase>>>(
      `/case/list?${params.toString()}`
    );
  },

  getCaseDetail: (id: string) => {
    return api.get<unknown, ApiResponse<CaseDetail>>(`/case/${id}`);
  },

  updateCaseStatus: (id: string, status: CaseStatus, reason: string) => {
    return api.post<unknown, ApiResponse<BusinessCase>>('/case/status', {
      id,
      status,
      reason,
    });
  },
};
