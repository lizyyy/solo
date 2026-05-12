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

export interface TrendPoint {
  timestamp: number;
  errorRate: number;
  budgetRemaining: number;
  burnRate: number;
}

export interface ServiceDashboard {
  service: Service;
  consumption: BudgetConsumption | null;
  status: ServiceStatus;
  decision: ReleaseDecision;
  activeFreezes: FreezeRecord[];
  hasActiveException: boolean;
  metricsGap: { hasGap: boolean; gapHours: number } | null;
}

export interface DetailedDashboard extends ServiceDashboard {
  trend: TrendPoint[];
  reasons: string[];
  recommendations: string[];
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

export interface MetricsGap {
  serviceId: string;
  serviceName: string;
  endpointId: string | null;
  endpointPath: string | null;
  lastSeenAt: number | null;
  gapDurationHours: number;
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
