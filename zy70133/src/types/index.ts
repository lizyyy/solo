export type UUID = string;

export type BudgetPoolStatus = 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'ARCHIVED';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type MaterialStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type ChannelStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type TransactionType = 'DEDUCT' | 'REFUND' | 'COMPENSATE' | 'REVERT' | 'TOPUP' | 'ADJUST';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERTED';
export type MaterialBindStatus = 'ACTIVE' | 'PAUSED' | 'UNBOUND';

export interface BudgetPool {
  id: UUID;
  name: string;
  description?: string;
  totalAmount: number;
  allocatedAmount: number;
  consumedAmount: number;
  refundedAmount: number;
  compensatedAmount: number;
  status: BudgetPoolStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  endDate?: Date;
  dailyLimit?: number;
  rules: BudgetPoolRule[];
}

export interface BudgetPoolRule {
  type: 'DAILY_LIMIT' | 'MINIMUM_BALANCE' | 'ALLOW_OVERDRAFT' | 'CUSTOM';
  value: number | boolean | string;
  priority: number;
  description?: string;
}

export interface Campaign {
  id: UUID;
  budgetPoolId: UUID;
  name: string;
  description?: string;
  totalBudget: number;
  allocatedBudget: number;
  consumedBudget: number;
  refundedBudget: number;
  compensatedBudget: number;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  endDate?: Date;
}

export interface Material {
  id: UUID;
  name: string;
  description?: string;
  type: 'IMAGE' | 'VIDEO' | 'TEXT' | 'HTML';
  status: MaterialStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Channel {
  id: UUID;
  name: string;
  description?: string;
  type: 'SEARCH' | 'SOCIAL' | 'DISPLAY' | 'VIDEO' | 'NATIVE';
  feeRate: number;
  status: ChannelStatus;
  createdAt: Date;
  updatedAt: Date;
  rules: ChannelRule[];
}

export interface ChannelRule {
  type: 'MIN_DEDUCT' | 'MAX_DEDUCT_PER_ORDER' | 'PRIORITY' | 'CUSTOM';
  value: number | string;
  description?: string;
}

export interface MaterialBinding {
  id: UUID;
  materialId: UUID;
  campaignId: UUID;
  channelId: UUID;
  status: MaterialBindStatus;
  priority: number;
  allocatedBudget: number;
  consumedBudget: number;
  refundedBudget: number;
  compensatedBudget: number;
  createdAt: Date;
  updatedAt: Date;
  startDate?: Date;
  endDate?: Date;
}

export interface Transaction {
  id: UUID;
  type: TransactionType;
  budgetPoolId: UUID;
  campaignId?: UUID;
  materialId?: UUID;
  channelId?: UUID;
  bindingId?: UUID;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: TransactionStatus;
  reason: string;
  operator?: string;
  referenceId?: UUID;
  relatedTransactionId?: UUID;
  metadata?: Record<string, any>;
  ruleEvaluation?: RuleEvaluationResult;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionHistory {
  transactionId: UUID;
  stateSnapshot: {
    budgetPool: Partial<BudgetPool>;
    campaign?: Partial<Campaign>;
    binding?: Partial<MaterialBinding>;
  };
  timestamp: Date;
}

export interface RuleEvaluationResult {
  passed: boolean;
  evaluations: RuleEvaluation[];
  finalDecision: string;
  timestamp: Date;
}

export interface RuleEvaluation {
  ruleType: string;
  ruleDescription?: string;
  input: Record<string, any>;
  passed: boolean;
  message: string;
}

export interface BudgetSummary {
  budgetPoolId: UUID;
  budgetPoolName: string;
  totalAmount: number;
  consumedAmount: number;
  availableAmount: number;
  dailyConsumedAmount: number;
  dailyRemainingAmount: number;
  campaignSummaries: CampaignSummary[];
}

export interface CampaignSummary {
  campaignId: UUID;
  campaignName: string;
  totalBudget: number;
  consumedBudget: number;
  availableBudget: number;
  channelSummaries: ChannelSummary[];
}

export interface ChannelSummary {
  channelId: UUID;
  channelName: string;
  consumedAmount: number;
  refundedAmount: number;
  compensatedAmount: number;
  netConsumed: number;
  materialSummaries: MaterialSummary[];
}

export interface MaterialSummary {
  materialId: UUID;
  materialName: string;
  consumedAmount: number;
  refundedAmount: number;
  compensatedAmount: number;
  netConsumed: number;
}

export interface DeductRequest {
  budgetPoolId: UUID;
  campaignId: UUID;
  materialId: UUID;
  channelId: UUID;
  amount: number;
  reason: string;
  operator?: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  transactionId: UUID;
  amount: number;
  reason: string;
  operator?: string;
}

export interface CompensateRequest {
  transactionId?: UUID;
  budgetPoolId: UUID;
  campaignId?: UUID;
  amount: number;
  reason: string;
  operator?: string;
}

export interface RevertRequest {
  transactionId: UUID;
  reason: string;
  operator?: string;
}

export interface CreateBudgetPoolRequest {
  name: string;
  description?: string;
  totalAmount: number;
  startDate?: Date;
  endDate?: Date;
  dailyLimit?: number;
  rules?: BudgetPoolRule[];
}

export interface CreateCampaignRequest {
  budgetPoolId: UUID;
  name: string;
  description?: string;
  totalBudget: number;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateMaterialRequest {
  name: string;
  description?: string;
  type: 'IMAGE' | 'VIDEO' | 'TEXT' | 'HTML';
  metadata?: Record<string, any>;
}

export interface CreateChannelRequest {
  name: string;
  description?: string;
  type: 'SEARCH' | 'SOCIAL' | 'DISPLAY' | 'VIDEO' | 'NATIVE';
  feeRate: number;
  rules?: ChannelRule[];
}

export interface BindMaterialRequest {
  materialId: UUID;
  campaignId: UUID;
  channelId: UUID;
  allocatedBudget: number;
  priority?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ReportQuery {
  budgetPoolId?: UUID;
  campaignId?: UUID;
  channelId?: UUID;
  materialId?: UUID;
  startDate?: Date;
  endDate?: Date;
  groupBy: 'BUDGET_POOL' | 'CAMPAIGN' | 'CHANNEL' | 'MATERIAL' | 'DATE';
  includeDetails?: boolean;
}

export interface AuditLogEntry {
  id: UUID;
  timestamp: Date;
  operator?: string;
  action: string;
  resourceType: string;
  resourceId: UUID;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
