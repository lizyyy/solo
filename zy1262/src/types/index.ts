export interface Instance {
  id: string;
  name: string;
  ip: string;
  port: number;
  weight: number;
  status: 'healthy' | 'unhealthy';
  connections: number;
}

export interface Upstream {
  name: string;
  instances: Instance[];
}

export interface LBPolicy {
  version: string;
  name: string;
  type: 'round-robin' | 'weighted-round-robin' | 'least-connections' | 'consistent-hashing' | 'sticky-session';
  config: {
    hashKey?: string;
    sessionKey?: string;
    healthCheck?: {
      interval: number;
      timeout: number;
      failures: number;
    };
    retry?: {
      attempts: number;
      statusCodes: number[];
    };
  };
  createdAt: number;
}

export interface Request {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  sessionId?: string;
  hashKey?: string;
}

export interface HealthEvent {
  id: string;
  timestamp: number;
  instanceId: string;
  type: 'check-failed' | 'check-recovered' | 'manual-down' | 'manual-up';
  details: string;
}

export interface RoutingDecision {
  id: string;
  taskId: string;
  requestId: string;
  selectedInstanceId: string;
  reason: string;
  details: {
    availableInstances: string[];
    algorithm: string;
    weights?: Record<string, number>;
    connections?: Record<string, number>;
    hashValue?: string;
    sessionMatch?: boolean;
  };
  timestamp: number;
  retryAttempt: number;
}

export interface RiskConclusion {
  id: string;
  taskId: string;
  type: 'traffic-skew' | 'weight-issue' | 'health-issue' | 'retry-issue' | 'hash-bias';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedRequests: string[];
  affectedInstances: string[];
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: number;
  createdAt: number;
}

export interface ReplayTask {
  id: string;
  name: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  progress: number;
  policyVersion: string;
  upstreamCount: number;
  requestCount: number;
  healthEventCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}
