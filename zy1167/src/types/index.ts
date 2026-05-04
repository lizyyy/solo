import { UUID } from 'crypto';

export type EmployeeId = UUID;
export type PayrollId = UUID;
export type BatchId = UUID;
export type DisbursementId = UUID;

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum BatchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum DisbursementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Employee {
  id: EmployeeId;
  employeeNumber: string;
  name: string;
  email: string;
  phone: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payroll {
  id: PayrollId;
  employeeId: EmployeeId;
  year: number;
  month: number;
  baseSalary: number;
  bonus: number;
  allowance: number;
  deduction: number;
  tax: number;
  socialInsurance: number;
  housingFund: number;
  netSalary: number;
  status: 'pending' | 'confirmed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: BatchId;
  name: string;
  description: string | null;
  year: number;
  month: number;
  totalRecords: number;
  totalAmount: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  status: BatchStatus;
  concurrency: number;
  rateLimit: number;
  chunkSize: number;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  pausedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Disbursement {
  id: DisbursementId;
  batchId: BatchId;
  payrollId: PayrollId;
  employeeId: EmployeeId;
  amount: number;
  idempotencyKey: string;
  status: DisbursementStatus;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  errorCode: string | null;
  externalTransactionId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchProgress {
  batchId: BatchId;
  status: BatchStatus;
  totalRecords: number;
  processedRecords: number;
  successRecords: number;
  failedRecords: number;
  progressPercentage: number;
  estimatedTimeRemaining: number | null;
  currentChunk: number;
  totalChunks: number;
}

export interface PerformanceStats {
  totalBatches: number;
  totalDisbursements: number;
  successRate: number;
  averageProcessingTime: number;
  throughput: number;
  last24Hours: {
    batches: number;
    disbursements: number;
    successRate: number;
  };
}

export interface ReconciliationResult {
  batchId: BatchId;
  expectedAmount: number;
  actualAmount: number;
  expectedCount: number;
  actualCount: number;
  discrepancies: {
    type: 'amount' | 'count' | 'status';
    description: string;
    affectedRecords?: number;
  }[];
  isBalanced: boolean;
}

export interface CreateBatchRequest {
  name: string;
  description?: string;
  year: number;
  month: number;
  concurrency?: number;
  rateLimit?: number;
  chunkSize?: number;
}

export interface ImportEmployeesRequest {
  employees: {
    employeeNumber: string;
    name: string;
    email: string;
    phone: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    department: string;
    position: string;
  }[];
}

export interface ImportPayrollsRequest {
  payrolls: {
    employeeNumber: string;
    baseSalary: number;
    bonus?: number;
    allowance?: number;
    deduction?: number;
    tax?: number;
    socialInsurance?: number;
    housingFund?: number;
    year: number;
    month: number;
  }[];
}