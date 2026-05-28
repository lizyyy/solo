import api from './index';
import type { VersionHistory, PaginatedResponse, ApiResponse } from '../../shared/types';

interface HistoryFilters {
  recordId?: string;
  recordType?: string;
  operatorId?: string;
  startDate?: string;
  endDate?: string;
}

export const historyService = {
  getChanges: (page = 1, pageSize = 10, filters: HistoryFilters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (filters.recordId) params.append('recordId', filters.recordId);
    if (filters.recordType) params.append('recordType', filters.recordType);
    if (filters.operatorId) params.append('operatorId', filters.operatorId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    return api.get<unknown, ApiResponse<PaginatedResponse<VersionHistory>>>(
      `/history/changes?${params.toString()}`
    );
  },
};
