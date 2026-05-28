import { get, put } from './api';
import type { BusinessCase, CaseDetail, CaseStatus, PaginatedResponse } from '../../shared/types';

export const getCaseList = (params?: any): Promise<PaginatedResponse<BusinessCase>> => {
  return get('/cases', params);
};

export const getCaseDetail = (id: string): Promise<CaseDetail> => {
  return get(`/cases/${id}`);
};

export const updateCaseStatus = (
  businessNo: string,
  toStatus: CaseStatus,
  reason: string,
  impactScope: string,
  nextStep: string
): Promise<BusinessCase> => {
  return put(`/cases/${businessNo}/status`, {
    toStatus,
    reason,
    impactScope,
    nextStep,
  });
};
