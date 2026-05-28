import api from './index';
import type { LinkGraph, BusinessDataType, ApiResponse } from '../../shared/types';

export const businessService = {
  getLinkGraph: (businessNo?: string) => {
    const params = businessNo ? `?businessNo=${businessNo}` : '';
    return api.get<unknown, ApiResponse<LinkGraph>>(`/business/links${params}`);
  },

  getBusinessList: (page = 1, pageSize = 10, filters: { status?: string; riskLevel?: string; keyword?: string } = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
    if (filters.keyword) params.append('keyword', filters.keyword);
    
    return api.get<unknown, ApiResponse<any>>(`/business/list?${params.toString()}`);
  },

  getBusinessDetail: (id: string) => {
    return api.get<unknown, ApiResponse<any>>(`/business/${id}`);
  },

  createLink: (sourceId: string, sourceType: BusinessDataType, targetId: string, targetType: BusinessDataType, linkType: string) => {
    return api.post<unknown, ApiResponse<any>>('/business/link', {
      sourceId,
      sourceType,
      targetId,
      targetType,
      linkType,
    });
  },

  deleteLink: (id: string) => {
    return api.delete<unknown, ApiResponse<any>>(`/business/link/${id}`);
  },
};
