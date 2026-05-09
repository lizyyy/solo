export type ReplacementStep =
  | 'APPLICATION'
  | 'OLD_CARD_FREEZE'
  | 'LOGISTICS'
  | 'ACTIVATION';

export type StepStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'REJECTED'
  | 'COMPENSATED';

export type ReplacementStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'STUCK'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED';

export type FailureReason =
  | 'OLD_CARD_UNFREEZABLE'
  | 'ADDRESS_INVALID'
  | 'LOGISTICS_LOST'
  | 'ACTIVATION_FAILED'
  | 'CUSTOMER_REJECT'
  | 'TIMEOUT'
  | 'SYSTEM_ERROR';

export interface Address {
  province: string;
  city: string;
  district: string;
  detail: string;
  receiverName: string;
  receiverPhone: string;
}

export interface StepRecord {
  step: ReplacementStep;
  status: StepStatus;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  failureReason?: FailureReason;
  compensationInfo?: CompensationInfo;
  startedAt: number;
  completedAt?: number;
}

export interface LogisticsNode {
  id: string;
  step: 'PICKED_UP' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'SIGNED';
  location: string;
  operator?: string;
  timestamp: number;
  remark?: string;
}

export interface CompensationInfo {
  compensated: boolean;
  method: 'REFUND' | 'NEW_CARD_REISSUE' | 'MANUAL_HANDLING' | 'OTHER';
  operatorId?: string;
  operatorName?: string;
  processedAt: number;
  remark?: string;
}

export interface CustomerServiceNote {
  id: string;
  csrId: string;
  csrName: string;
  content: string;
  action?: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'NONE';
  affectsOutcome: boolean;
  createdAt: number;
}

export interface CardReplacementRequest {
  id: string;
  userId: string;
  oldCardNumber: string;
  oldCardHolderName: string;
  newCardNumber?: string;
  replacementReason: string;
  shippingAddress: Address;
  status: ReplacementStatus;
  currentStep: ReplacementStep;
  stuckPoint?: {
    step: ReplacementStep;
    reason: string;
    lastSuccessfulStep: ReplacementStep;
  };
  steps: { [key in ReplacementStep]?: StepRecord };
  logisticsNodes: LogisticsNode[];
  customerServiceNotes: CustomerServiceNote[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateReplacementRequest {
  userId: string;
  oldCardNumber: string;
  oldCardHolderName: string;
  replacementReason: string;
  shippingAddress: Address;
}

export interface FreezeCardRequest {
  replacementId: string;
  operatorId?: string;
  operatorName?: string;
}

export interface LogisticsUpdateRequest {
  replacementId: string;
  step: LogisticsNode['step'];
  location: string;
  operator?: string;
  remark?: string;
}

export interface ActivationRequest {
  replacementId: string;
  newCardNumber: string;
  operatorId?: string;
  operatorName?: string;
}

export interface RejectStepRequest {
  replacementId: string;
  step: ReplacementStep;
  reason: FailureReason;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface CompensationRequest {
  replacementId: string;
  method: CompensationInfo['method'];
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface CustomerServiceRequest {
  replacementId: string;
  csrId: string;
  csrName: string;
  content: string;
  action?: CustomerServiceNote['action'];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: number;
}

export interface StuckPointResponse {
  replacementId: string;
  isStuck: boolean;
  currentStep: ReplacementStep;
  currentStatus: StepStatus;
  stuckReason?: string;
  lastSuccessfulStep: ReplacementStep;
  lastSuccessfulStepStatus: StepStatus;
  previousStepRecord?: StepRecord;
  canProceed: boolean;
  suggestedActions: string[];
}

export interface HistoryResponse {
  replacementId: string;
  stepHistory: Array<{
    step: ReplacementStep;
    status: StepStatus;
    at: number;
    remark?: string;
    failureReason?: FailureReason;
  }>;
  logisticsHistory: LogisticsNode[];
  csNotesHistory: CustomerServiceNote[];
}
