import { Role, RefundStatus, RefundReason, LogAction, BatchStatus } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface CreateRefundInput {
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  currency?: string;
  reason: RefundReason;
  reasonDetail?: string;
  paymentMethod?: string;
  bankAccount?: string;
  bankName?: string;
  bankBranch?: string;
}

export interface UpdateRefundInput extends Partial<CreateRefundInput> {
  status?: RefundStatus;
  changeReason?: string;
}

export interface RefundFilter {
  status?: RefundStatus[];
  reason?: RefundReason[];
  orderNo?: string;
  refundNo?: string;
  customerName?: string;
  customerPhone?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
  operatorId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface RefundStatusTransition {
  from: RefundStatus[];
  to: RefundStatus;
  allowedRoles: Role[];
  action: LogAction;
}

export interface BatchActionInput {
  refundIds: string[];
  action: 'approve' | 'reject' | 'cancel' | 'retry' | 'submit';
  reason?: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface StateTransition {
  event: string;
  target: RefundStatus;
  cond?: (context: any, event: any) => boolean;
  actions?: ((context: any, event: any) => void)[];
}
