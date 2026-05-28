export type RedemptionStatus = 'pending' | 'processing' | 'completed' | 'frozen' | 'disputed' | 'cancelled';

export type ConsumptionType = 'consume' | 'recharge' | 'refund';

export type IdType = 'id_card' | 'passport' | 'other';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type DisputeStatus = 'open' | 'resolved' | 'closed';

export type BatchStatus = 'draft' | 'approved' | 'executing' | 'completed';

export type OperationType = 'create' | 'update' | 'freeze' | 'unfreeze' | 'dispute' | 'batch_assign';

export type Severity = 'error' | 'warning' | 'info';

export interface Redemption {
  id: string;
  cardNumber: string;
  cardHolderName: string;
  phone: string;
  initialBalance: number;
  currentBalance: number;
  status: RedemptionStatus;
  batchId?: string;
  identityId: string;
  hasDispute: boolean;
  isFrozen: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ConsumptionRecord {
  id: string;
  redemptionId: string;
  consumeTime: string;
  storeName: string;
  amount: number;
  type: ConsumptionType;
  remark?: string;
}

export interface Identification {
  id: string;
  idType: IdType;
  idNumber: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  verificationStatus: VerificationStatus;
}

export interface DisputeNote {
  id: string;
  redemptionId: string;
  content: string;
  handler: string;
  handleTime: string;
  status: DisputeStatus;
}

export interface Batch {
  id: string;
  batchNo: string;
  name: string;
  status: BatchStatus;
  createTime: string;
  executeTime?: string;
  auditor?: string;
  totalCount: number;
  totalAmount: number;
}

export interface OperationLog {
  id: string;
  redemptionId: string;
  operationType: OperationType;
  operator: string;
  operateTime: string;
  beforeData: string;
  afterData: string;
  remark?: string;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: Severity;
  field?: string;
  ruleExplanation?: string;
  calculationProcess?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'warning' | 'info';
  suggestion?: string;
  field?: string;
  ruleExplanation?: string;
  calculationProcess?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface BalanceCalculationResult {
  currentBalance: number;
  totalConsume: number;
  totalRefund: number;
  totalRecharge: number;
  calculationProcess: string;
}

export interface ProcessingConclusion {
  status: 'normal' | 'warning' | 'error';
  title: string;
  description: string;
  suggestions: string[];
  details: ValidationError[];
}
