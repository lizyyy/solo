export type RedemptionStatus = 'confirmed' | 'pending' | 'manual';

export type MaterialType = 'receipt' | 'refund' | 'email' | 'import';

export interface Material {
  id: string;
  type: MaterialType;
  amount: number;
  date: string;
  content: string;
  source: string;
}

export interface Remark {
  id: string;
  content: string;
  operator: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  action: string;
  fromStatus?: RedemptionStatus;
  toStatus: RedemptionStatus;
  reason: string;
  operator: string;
  createdAt: string;
}

export interface ConflictInfo {
  type: 'amount' | 'date';
  field: string;
  emailValue: string;
  importValue: string;
  diff: string;
  suggestion: string;
}

export interface FundRedemption {
  id: string;
  fundCode: string;
  fundName: string;
  applyAmount: number;
  applyDate: string;
  expectArriveDate: string;
  applicant: string;
  status: RedemptionStatus;
  queueReason: string;
  previousStatus?: RedemptionStatus;
  materials: Material[];
  remarks: Remark[];
  operationLogs: OperationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  confirmed: { count: number; amount: number };
  pending: { count: number; amount: number };
  manual: { count: number; amount: number };
  total: { count: number; amount: number };
}

export interface FilterOptions {
  status: RedemptionStatus | 'all';
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  keyword: string;
}
