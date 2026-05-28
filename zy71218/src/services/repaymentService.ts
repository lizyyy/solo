import api from './index';
import type { Repayment, RepaymentWriteOff, PaginatedResponse, ApiResponse, WriteOffStatus } from '../../shared/types';

interface RepaymentFilters {
  businessNo?: string;
  writeOffStatus?: WriteOffStatus;
}

interface CreateRepaymentData {
  businessNo: string;
  repaymentDate: string;
  totalAmount: number;
  principalPaid?: number;
  interestPaid?: number;
  penaltyPaid?: number;
  payer?: string;
  remark?: string;
}

export const repaymentService = {
  getRepaymentList: (page = 1, pageSize = 10, filters: RepaymentFilters = {}) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (filters.businessNo) params.append('businessNo', filters.businessNo);
    if (filters.writeOffStatus) params.append('writeOffStatus', filters.writeOffStatus);
    
    return api.get<unknown, ApiResponse<PaginatedResponse<Repayment>>>(
      `/repayment/list?${params.toString()}`
    );
  },

  createRepayment: (data: CreateRepaymentData) => {
    return api.post<unknown, ApiResponse<Repayment>>('/repayment', data);
  },

  writeOffRepayment: (
    repaymentId: string,
    targetType: string,
    targetId: string,
    amount: number
  ) => {
    return api.post<unknown, ApiResponse<RepaymentWriteOff>>('/repayment/write-off', {
      repaymentId,
      targetType,
      targetId,
      amount,
    });
  },
};
