export interface Route {
  path: string;
  method?: string;
  service: string;
  priority?: number;
  headers?: Record<string, string>;
}

export interface RoutesConfig {
  routes: Route[];
}

export interface TrafficSample {
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  userId?: string;
  bucket?: string;
  expectedService?: string;
}

export interface CanaryRule {
  service: string;
  condition: {
    headerMatch?: {
      name: string;
      value: string;
      regex?: boolean;
    };
    userBucket?: {
      percentage: number;
      seed?: string;
    };
    pathMatch?: string;
  };
  weight: number;
  version: string;
}

export interface CanaryPolicy {
  name: string;
  description: string;
  rules: CanaryRule[];
  defaultWeight: number;
}

export interface ServiceHealth {
  service: string;
  version: string;
  healthy: boolean;
  lastCheck: string;
  errorRate: number;
  latencyP99: number;
}

export interface RouteMatchResult {
  route: Route;
  matched: boolean;
  reason?: string;
}

export interface CanaryEvaluationResult {
  rule: CanaryRule | null;
  shouldHitCanary: boolean;
  targetService: string;
  targetVersion: string;
  weight: number;
  matchedConditions: string[];
  reasoning: string;
}

export interface HitChain {
  requestId: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  userId?: string;
  bucket?: string;
  
  routeMatch: RouteMatchResult;
  canaryEvaluation: CanaryEvaluationResult;
  
  expectedService?: string;
  actualService: string;
  actualVersion: string;
  
  isHealthy: boolean;
  healthInfo?: ServiceHealth;
  
  issues: Issue[];
}

export type IssueType = 
  | 'WRONG_SERVICE'
  | 'HEALTHY_SHOULD_HIT_CANARY' 
  | 'UNHEALTHY_STILL_SHUNT'
  | 'WEIGHT_EXCEEDS_BUDGET'
  | 'MISSING_HEALTH_DATA'
  | 'ROUTE_OVERLAP';

export interface Issue {
  type: IssueType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details: Record<string, unknown>;
}

export interface AnalysisReport {
  summary: {
    totalRequests: number;
    matchedRoutes: number;
    canaryHits: number;
    stableHits: number;
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
  };
  hitChains: HitChain[];
  issues: Issue[];
  weightAnalysis: {
    service: string;
    version: string;
    expectedWeight: number;
    actualHits: number;
    actualPercentage: number;
    isOverBudget: boolean;
  }[];
  routeOverlaps: {
    path1: string;
    path2: string;
    priorityConflict: boolean;
  }[];
  missingHealthData: string[];
  generatedAt: string;
}

export interface CLIConfig {
  routesPath: string;
  trafficSamplesPath: string;
  canaryPolicyPath: string;
  serviceHealthPath: string;
  outputDir: string;
  verbose: boolean;
}
