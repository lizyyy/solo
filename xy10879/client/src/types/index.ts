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

export interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_usage: number;
  current_usage: number;
  status: PromoCodeStatus;
  valid_from: string;
  valid_to: string;
  created_at: string;
  updated_at: string;
}

export interface BlockEvent {
  id: string;
  promo_code_id: string;
  promo_code: string;
  device_id: string;
  user_id?: string;
  ip_address: string;
  risk_score: number;
  risk_level: RiskLevel;
  triggeredRules: string[];
  status: EventStatus;
  reason: string;
  compensated_at?: string;
  compensated_by?: string;
  compensated_note?: string;
  created_at: string;
  updated_at: string;
}

export interface AllowRecord {
  id: string;
  promo_code_id: string;
  promo_code: string;
  device_id: string;
  user_id?: string;
  ip_address: string;
  risk_score: number;
  is_manual: number;
  approved_by?: string;
  created_at: string;
}

export interface RiskCheckResult {
  allowed: boolean;
  riskScore: number;
  riskLevel: RiskLevel;
  triggeredRules: string[];
  reason: string;
  promoCodeId?: string;
}

export interface DashboardStats {
  totalBlocked: number;
  todayBlocked: number;
  totalAllowed: number;
  manualAllowed: number;
  pendingReview: number;
  recentEvents: BlockEvent[];
  dailyStats: { date: string; blocked: number; resolved: number }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
