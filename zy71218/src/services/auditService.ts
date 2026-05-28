import api from './index';
import type { AuditLog, PaginatedResponse, ApiResponse } from '../../shared/types';

interface AuditLogFilters {
  action?: string;
  targetType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export const auditService = {
  getAuditLogs: (filters: AuditLogFilters = {}, page = 1, pageSize = 10) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (filters.action) params.append('action', filters.action);
    if (filters.targetType) params.append('targetType', filters.targetType);
    if (filters.userId) params.append('userId', filters.userId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    
    return api.get<unknown, ApiResponse<PaginatedResponse<AuditLog>>>(
      `/audit/logs?${params.toString()}`
    );
  },
};
