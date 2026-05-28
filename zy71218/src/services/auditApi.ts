import { get } from './api';
import type { AuditLog, VersionHistory, PaginatedResponse } from '../../shared/types';

export const getAuditLogs = (params?: any): Promise<PaginatedResponse<AuditLog>> => {
  return get('/audit/logs', params);
};

export const getChangeHistory = (params?: any): Promise<PaginatedResponse<VersionHistory>> => {
  return get('/history/changes', params);
};
