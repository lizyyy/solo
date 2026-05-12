export type ServiceStatus = 'healthy' | 'warning' | 'critical' | 'frozen' | 'missing_metrics';

export type ReleaseDecision = 'continue' | 'observe' | 'freeze' | 'needs_exception';

export type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type FreezeReason = 'budget_exhausted' | 'rapid_burn' | 'sustained_burn' | 'manual';

export interface Service {
  id: string;
  name: string;
  description: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface Endpoint {
  id: string;
  serviceId: string;
  method: string;
  path: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface BudgetRule {
  id: string;
  serviceId: string;
  endpointId: string | null;
  name: string;
  description: string;
  
  sloPercent: number;
  budgetPercent: number;
  
  windowDays: number;
  burnRateThreshold1: number;
  burnRateThreshold2: number;
  
  spikeWindowMinutes: number;
  spikeSustainedMinutes: number;
  
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface MetricPoint {
  id: string;
  serviceId: string;
  endpointId: string | null;
  timestamp: number;
  
  totalRequests: number;
  errorRequests: number;
  p50LatencyMs: number;
  p99LatencyMs: number;
  
  source: 'api' | 'import' | 'generated';
  createdAt: number;
}

export interface ExceptionApproval {
  id: string;
  serviceId: string;
  endpointId: string | null;
  releaseId: string;
  reason: string;
  
  requestedBy: string;
  approvedBy: string | null;
  status: ExceptionStatus;
  
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface FreezeRecord {
  id: string;
  serviceId: string;
  endpointId: string | null;
  reason: FreezeReason;
  reasonDetail: string;
  
  triggeredBy: string;
  createdAt: number;
  liftedAt: number | null;
  liftedBy: string | null;
  isActive: boolean;
}

export interface BudgetConsumption {
  serviceId: string;
  endpointId: string | null;
  budgetRuleId: string;
  
  windowStart: number;
  windowEnd: number;
  
  totalBudget: number;
  consumedBudget: number;
  remainingBudget: number;
  remainingPercent: number;
  
  burnRate: number;
  burnRateLevel: 'normal' | 'warning' | 'critical';
  
  isSpike: boolean;
  isSustainedBurn: boolean;
  
  status: ServiceStatus;
  decision: ReleaseDecision;
  freezeReason?: FreezeReason;
}

export interface RiskItem {
  serviceName: string;
  endpoint: string;
  status: ServiceStatus;
  decision: ReleaseDecision;
  remainingBudget: string;
  burnRate: string;
  reasons: string[];
  recommendations: string[];
}

export interface TrendPoint {
  timestamp: number;
  errorRate: number;
  budgetRemaining: number;
  burnRate: number;
}

export interface MetricsGap {
  serviceId: string;
  serviceName: string;
  endpointId: string | null;
  endpointPath: string | null;
  lastSeenAt: number | null;
  gapDurationHours: number;
}
