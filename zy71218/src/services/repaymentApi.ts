import { get, post } from './api';
import type { Repayment, PaginatedResponse, RepaymentWriteOff } from '../../shared/types';

interface RegisterRepaymentData {
  businessNo: string;
  repaymentDate: string;
  totalAmount: number;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  payer: string;
  remark?: string;
}

interface WriteOffTarget {
  targetType: string;
  targetId: string;
  amount: number;
}

export const getRepaymentList = (params?: any): Promise<PaginatedResponse<Repayment>> => {
  return get('/repayments', params);
};

export const registerRepayment = (data: RegisterRepaymentData): Promise<Repayment> => {
  return post('/repayments', data);
};

export const writeOffRepayment = (
  repaymentId: string,
  targets: WriteOffTarget[]
): Promise<RepaymentWriteOff[]> => {
  return post(`/repayments/${repaymentId}/writeoff`, { targets });
};
