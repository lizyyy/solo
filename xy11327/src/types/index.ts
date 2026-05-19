export type BillingType = 'hourly' | 'acreage' | 'fuel' | 'mixed';

export interface WorkRecord {
  id?: string;
  recordNo: string;
  tractorNo: string;
  operatorName: string;
  operatorIdCard?: string;
  operatorPhone?: string;
  workDate: string;
  workType: string;
  billingType: BillingType;
  hours?: number;
  acreage?: number;
  fuelUsed?: number;
  fuelPrice?: number;
  hourlyRate?: number;
  acreageRate?: number;
  remarks?: string;
  status: 'pending' | 'billed' | 'reviewed' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export interface BillingResult {
  recordId: string;
  recordNo: string;
  totalAmount: number;
  breakdown: {
    hoursCost?: number;
    acreageCost?: number;
    fuelCost?: number;
  };
  billedAt: string;
}

export interface Bill {
  id?: string;
  billNo: string;
  operatorName: string;
  operatorIdCard?: string;
  operatorPhone?: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  recordCount: number;
  status: 'draft' | 'issued' | 'paid';
  createdAt?: string;
  issuedAt?: string;
  paidAt?: string;
}

export interface BatchResult<T> {
  success: T[];
  failed: { item: T; error: string; index: number }[];
  total: number;
  successCount: number;
  failedCount: number;
}

export interface SensitiveConfig {
  fields: string[];
  maskLength: number;
  maskChar: string;
}
