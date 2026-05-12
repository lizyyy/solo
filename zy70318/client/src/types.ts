export interface Service {
  id: string;
  name: string;
  role: 'core' | 'non_core';
  description: string;
  x: number;
  y: number;
}

export interface Dependency {
  id: string;
  source: string;
  target: string;
}

export interface DegradeRule {
  id: string;
  name: string;
  targetService: string;
  action: 'cache' | 'fallback' | 'block' | 'no_degrade';
  enabled: boolean;
  priority: number;
  description: string;
  conditions: {
    status: string[];
  };
  fallbackData: any;
  cacheExpireSeconds?: number;
}

export interface InjectedFault {
  serviceId: string;
  faultType: 'timeout' | 'failed';
  timeoutMs?: number;
  errorRate: number;
}

export interface DrillPlan {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  requestBody: any;
  injectedFaults: InjectedFault[];
  status: string;
}

export interface TraceEvent {
  id: string;
  serviceId: string;
  event: string;
  timestamp: string;
  data: any;
}

export interface DrillResultItem {
  requestId: string;
  timestamp: string;
  trace: TraceEvent[];
  matchedRules: DegradeRule[];
  blocked: boolean;
  finalAction: any;
  userVisibleResult: string;
  response: any;
  success: boolean;
}

export interface Comparison {
  hasDifferences: boolean;
  differences: {
    field: string;
    baseline: any;
    test: any;
    impact: string;
  }[];
}

export interface DrillResult {
  id: string;
  planId: string;
  planName: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  baselineResult: DrillResultItem;
  degradedResult: DrillResultItem;
  recoveryResult?: DrillResultItem;
  recoveryRunAt?: string;
  comparison: Comparison;
  recoveryComparison?: Comparison;
  recoveryPassed?: boolean;
  summary: {
    planName: string;
    runAt: string;
    faultInjections: { service: string; fault: string }[];
    userImpact: string;
    ruleMatches: string[];
    success: boolean;
    baselineSuccess: boolean;
    degradedSuccess: boolean;
    degradedBlocked: boolean;
  };
}
