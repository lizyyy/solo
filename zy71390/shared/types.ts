export type Tier = 'S' | 'A' | 'B' | 'C';
export type RuleStatus = 'active' | 'draft' | 'deprecated';
export type ReportStatus = 'pending' | 'running' | 'completed' | 'failed';
export type HitReason = 'threshold_exceeded' | 'whitelist_expired' | 'window_overlap' | 'false_positive';
export type AnomalyType = 'whitelist_expired' | 'window_overlap' | 'false_positive';
export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type EntityType = 'rule' | 'customer' | 'whitelist';

export interface RateLimitRule {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | '*';
  windowSize: number;
  limit: number;
  tier: Tier;
  status: RuleStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleVersion {
  id: string;
  ruleId: string;
  version: number;
  snapshot: RateLimitRule;
  changeReason: string;
  modifiedBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  tier: Tier;
  priority: number;
  isWhitelisted: boolean;
  whitelistExpiresAt?: string;
  whitelistReason?: string;
  totalRequests: number;
  blockedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequestLog {
  id: string;
  customerId: string;
  path: string;
  method: string;
  timestamp: string;
  statusCode: number;
  latency: number;
  userAgent: string;
  ip: string;
}

export interface HitResult {
  id: string;
  requestId: string;
  ruleId: string;
  ruleVersion: number;
  customerId: string;
  customerName: string;
  customerTier: Tier;
  hitReason: HitReason;
  explanation: string;
  wouldBlock: boolean;
  confidence: number;
  requestTimestamp: string;
  requestPath: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  affectedEntities: string[];
  recommendation: string;
  resolved: boolean;
  resolution?: string;
  createdAt: string;
}

export interface DrillReport {
  id: string;
  name: string;
  ruleId: string;
  ruleName: string;
  ruleVersion: number;
  startTime: string;
  endTime: string;
  sampleRate: number;
  totalRequests: number;
  hitCount: number;
  blockedCustomers: string[];
  anomalies: Anomaly[];
  hitResults: HitResult[];
  conclusion: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ModificationLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  modifiedBy: string;
  createdAt: string;
}

export interface CreateRuleRequest {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | '*';
  windowSize: number;
  limit: number;
  tier: Tier;
  changeReason: string;
}

export interface UpdateRuleRequest {
  name?: string;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | '*';
  windowSize?: number;
  limit?: number;
  tier?: Tier;
  status?: RuleStatus;
  changeReason: string;
}

export interface DrillConfig {
  ruleId: string;
  ruleVersion: number;
  startTime: string;
  endTime: string;
  sampleRate: number;
}

export interface UpdateCustomerTierRequest {
  tier: Tier;
  reason: string;
}

export interface AddWhitelistRequest {
  customerId: string;
  reason: string;
  expiresAt?: string;
}

export interface ResolveAnomalyRequest {
  resolution: string;
}

export interface DashboardStats {
  todayDrills: number;
  totalHits: number;
  activeAnomalies: number;
  affectedCustomers: number;
  hitTrend: Array<{ date: string; hits: number; drills: number }>;
  tierDistribution: Array<{ tier: Tier; count: number; hitCount: number }>;
  recentAnomalies: Anomaly[];
}

export const HIT_REASON_LABELS: Record<HitReason, string> = {
  threshold_exceeded: '阈值超限',
  whitelist_expired: '白名单过期',
  window_overlap: '时间窗重叠',
  false_positive: '疑似误杀'
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  whitelist_expired: '白名单过期',
  window_overlap: '时间窗重叠',
  false_positive: '突发流量误杀'
};

export const TIER_COLORS: Record<Tier, string> = {
  S: '#DC2626',
  A: '#F59E0B',
  B: '#2563EB',
  C: '#6B7280'
};

export const TIER_LABELS: Record<Tier, string> = {
  S: '战略客户',
  A: '重要客户',
  B: '普通客户',
  C: '长尾客户'
};

export const STATUS_COLORS: Record<RuleStatus, string> = {
  active: '#059669',
  draft: '#F59E0B',
  deprecated: '#6B7280'
};

export const STATUS_LABELS: Record<RuleStatus, string> = {
  active: '已启用',
  draft: '草稿',
  deprecated: '已废弃'
};

export const SEVERITY_COLORS: Record<AnomalySeverity, string> = {
  critical: '#DC2626',
  warning: '#F59E0B',
  info: '#2563EB'
};

export const SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示'
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  pending: '#6B7280',
  running: '#3B82F6',
  completed: '#059669',
  failed: '#DC2626'
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '已完成',
  failed: '失败'
};
