export enum QuotaWindow {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export enum RejectReason {
  QUOTA_EXHAUSTED = 'quota_exhausted',
  INVALID_USAGE_TAG = 'invalid_usage_tag',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  MODEL_NOT_AUTHORIZED = 'model_not_authorized',
  SUSPENDED = 'suspended'
}

export enum QuotaStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired'
}

export interface QuotaConfig {
  id: string;
  teamName: string;
  modelName: string;
  usageTag: string;
  limit: number;
  used: number;
  window: QuotaWindow;
  status: QuotaStatus;
  tempBonus: number;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UsageRecord {
  id: string;
  quotaId: string;
  teamName: string;
  modelName: string;
  usageTag: string;
  tokens: number;
  timestamp: string;
  requestId: string;
  success: boolean;
}

export interface RejectEvent {
  id: string;
  quotaId: string;
  teamName: string;
  modelName: string;
  usageTag: string;
  reason: RejectReason;
  rawInput: {
    teamName: string;
    modelName: string;
    usageTag: string;
    tokens: number;
    requestId: string;
    timestamp: string;
  };
  processingBasis: {
    currentLimit: number;
    currentUsed: number;
    windowStart: string;
    windowEnd: string;
    quotaStatus: QuotaStatus;
  };
  conclusion: string;
  timestamp: string;
  requestId: string;
}

export interface AuditLog {
  id: string;
  quotaId: string;
  action: string;
  operator: string;
  before: any;
  after: any;
  reason: string;
  timestamp: string;
}

export interface UsageSummary {
  teamName: string;
  modelName: string;
  usageTag: string;
  window: QuotaWindow;
  totalLimit: number;
  totalUsed: number;
  tempBonus: number;
  remaining: number;
  utilizationRate: number;
  rejectCount: number;
  windowStart: string;
  windowEnd: string;
  lastUpdated: string;
}

export interface ExportRecord {
  quotaConfig: QuotaConfig;
  usageRecords: UsageRecord[];
  rejectEvents: RejectEvent[];
  summary: UsageSummary;
  exportTime: string;
  exportBy: string;
}
