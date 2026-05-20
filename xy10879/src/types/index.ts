export enum PromoCodeStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum EventStatus {
  PENDING = 'pending',
  ALLOWED = 'allowed',
  BLOCKED = 'blocked',
  MANUAL_ALLOWED = 'manual_allowed',
  COMPENSATED = 'compensated'
}

export enum RuleType {
  FREQUENCY_LIMIT = 'frequency_limit',
  RISK_SCORE = 'risk_score',
  MANUAL_REVIEW = 'manual_review',
  DUPLICATE_USAGE = 'duplicate_usage',
  DEVICE_FINGERPRINT = 'device_fingerprint'
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUsage: number;
  currentUsage: number;
  status: PromoCodeStatus;
  validFrom: Date;
  validTo: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDevice {
  id: string;
  deviceId: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  riskScore: number;
  attemptCount: number;
  lastAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskRule {
  id: string;
  name: string;
  type: RuleType;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockEvent {
  id: string;
  promoCodeId: string;
  promoCode: string;
  deviceId: string;
  userId?: string;
  ipAddress: string;
  riskScore: number;
  riskLevel: RiskLevel;
  triggeredRules: string[];
  status: EventStatus;
  reason: string;
  compensatedAt?: Date;
  compensatedBy?: string;
  compensatedNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AllowRecord {
  id: string;
  promoCodeId: string;
  promoCode: string;
  deviceId: string;
  userId?: string;
  ipAddress: string;
  riskScore: number;
  isManual: boolean;
  approvedBy?: string;
  createdAt: Date;
}

export interface AttemptLog {
  id: string;
  promoCodeId: string;
  promoCode: string;
  deviceId: string;
  userId?: string;
  ipAddress: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
