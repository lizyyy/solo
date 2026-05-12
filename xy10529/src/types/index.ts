export enum BenefitStatus {
  ACTIVE = 'active',
  FROZEN = 'frozen',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
  COMPENSATED = 'compensated',
  INVALID = 'invalid'
}

export enum FreezeReason {
  REFUND = 'refund',
  RISK_CONTROL = 'risk_control',
  MANUAL = 'manual',
  OTHER = 'other'
}

export enum OperationType {
  CREATE_MEMBER = 'create_member',
  GRANT_BENEFIT = 'grant_benefit',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
  REFUND = 'refund',
  COMPENSATE = 'compensate',
  MANUAL_CORRECT = 'manual_correct',
  EXPIRE = 'expire',
  QUERY = 'query'
}

export interface Member {
  memberId: string;
  name: string;
  phone: string;
  createdAt: number;
  updatedAt: number;
}

export interface Benefit {
  benefitId: string;
  memberId: string;
  type: string;
  name: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  originalRemainingDays: number;
  status: BenefitStatus;
  currentFreezeReason?: FreezeReason;
  freezeHistory: FreezeRecord[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface FreezeRecord {
  freezeId: string;
  reason: FreezeReason;
  detail: string;
  frozenAt: number;
  unfrozenAt?: number;
  unfreezeReason?: string;
  isPermanent: boolean;
}

export interface LedgerEntry {
  ledgerId: string;
  memberId: string;
  benefitId: string;
  operationType: OperationType;
  beforeState: {
    status: BenefitStatus;
    remainingDays: number;
    freezeReason?: FreezeReason;
  };
  afterState: {
    status: BenefitStatus;
    remainingDays: number;
    freezeReason?: FreezeReason;
  };
  changeDetail: string;
  operator?: string;
  requestId: string;
  createdAt: number;
  success: boolean;
  failureReason?: string;
}

export interface IdempotentRecord {
  requestId: string;
  operationType: OperationType;
  benefitId?: string;
  memberId: string;
  result: any;
  createdAt: number;
}

export interface ManualCorrectionDiff {
  field: string;
  before: any;
  after: any;
}

export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  message: string;
  requestId: string;
  isIdempotent: boolean;
}

export interface BenefitQueryResult {
  benefit: Benefit;
  history: LedgerEntry[];
  currentState: {
    status: BenefitStatus;
    remainingDays: number;
    freezeReason?: FreezeReason;
    freezeHistory: FreezeRecord[];
    canUnfreeze: boolean;
    canCompensate: boolean;
  };
  ledgerExplanation: string[];
}
