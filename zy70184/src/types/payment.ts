export interface OperatorContext {
  id: string;
  name: string;
  role?: string;
}

export interface CreatePaymentBatchItem {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  amount: string;
  currency?: string;
  purpose?: string;
  remark?: string;
}

export interface CreatePaymentBatchInput {
  batchName?: string;
  currency?: string;
  idempotencyKey: string;
  items: CreatePaymentBatchItem[];
  notes?: string;
  operator: OperatorContext;
}

export interface PaymentValidationResult {
  valid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationErrorItem[];
}

export interface ValidationErrorItem {
  type: 'error' | 'warning';
  code: string;
  message: string;
  field?: string;
  itemIndex?: number;
}

export interface LimitCheckResult {
  passed: boolean;
  exceededLimit?: string;
  currentUsage?: {
    amount: string;
    count: number;
  };
  limit?: {
    dailyAmountLimit: string;
    dailyCountLimit: number;
    singleAmountMax: string;
  };
}

export interface ApprovalLevelConfig {
  level: number;
  role: string;
  required: boolean;
  approverIds?: string[];
}

export interface BatchApprovalContext {
  batchId: string;
  currentLevel: number;
  totalLevels: number;
  levels: ApprovalLevelConfig[];
}
