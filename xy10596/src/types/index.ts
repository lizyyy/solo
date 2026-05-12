export enum SurveyStatus {
  PENDING = 'pending',
  VALID = 'valid',
  REJECTED = 'rejected',
  OVER_QUOTA = 'over_quota',
  NEEDS_REVIEW = 'needs_review',
  MANUALLY_RESERVED = 'manually_reserved',
  MANUALLY_REJECTED = 'manually_rejected'
}

export enum RejectReason {
  DUPLICATE_PHONE = 'duplicate_phone',
  TOO_FAST = 'too_fast',
  ALL_SAME_OPTIONS = 'all_same_options',
  OVER_QUOTA = 'over_quota',
  MANUAL_REJECT = 'manual_reject'
}

export interface SurveyAnswer {
  id: string;
  phone: string;
  channel: string;
  city: string;
  ageGroup: string;
  duration: number;
  answers: Record<string, string | number | string[]>;
  submittedAt: string;
  sourceId?: string;
}

export interface QuotaRule {
  id: string;
  name: string;
  type: 'city' | 'age' | 'channel' | 'combined';
  limit: number;
  criteria: Record<string, string>;
  priority?: number;
}

export interface QualityRule {
  id: string;
  name: string;
  type: 'duplicate_phone' | 'min_duration' | 'all_same_options' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: 'online_ad' | 'offline_promotion' | 'member';
  description: string;
  enabled: boolean;
}

export interface SurveyRecord extends SurveyAnswer {
  status: SurveyStatus;
  rejectReasons: RejectReason[];
  history: HistoryEntry[];
  processedAt?: string;
  isDuplicateOf?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: 'system' | string;
  fromStatus?: SurveyStatus;
  toStatus: SurveyStatus;
  reason?: string;
  details?: Record<string, any>;
}

export interface QuotaUsage {
  ruleId: string;
  ruleName: string;
  type: string;
  criteria: Record<string, string>;
  limit: number;
  used: number;
  remaining: number;
  overQuota: number;
}

export interface ProjectConfig {
  id: string;
  name: string;
  createdAt: string;
  channels: ChannelInfo[];
  quotaRules: QuotaRule[];
  qualityRules: QualityRule[];
}

export interface ProjectState {
  config: ProjectConfig;
  surveys: SurveyRecord[];
  quotaUsage: QuotaUsage[];
  lastUpdatedAt: string;
  processVersion: number;
}

export interface CheckResult {
  total: number;
  valid: number;
  rejected: number;
  overQuota: number;
  needsReview: number;
  processed: number;
  skipped: number;
  details: CheckDetail[];
}

export interface CheckDetail {
  surveyId: string;
  phone: string;
  channel: string;
  city: string;
  ageGroup: string;
  status: SurveyStatus;
  reasons: RejectReason[];
  isNew: boolean;
}

export interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  sourceId: string;
  error: string;
}
