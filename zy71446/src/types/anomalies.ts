export type AnomalyType =
  | 'reflow'
  | 'wrong_direction'
  | 'over_capacity'
  | 'capacity_warning'
  | 'data_conflict'
  | 'escalator_stop';

export type Severity = 'high' | 'medium' | 'low';

export interface EvidenceItem {
  source: string;
  data: object;
  timestamp: string;
  confidence: number;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  location: string;
  zoneId: string;
  startTime: string;
  endTime?: string;
  peakData: Record<string, number | string | boolean>;
  status: 'active' | 'resolved' | 'acknowledged';
  evidence: EvidenceItem[];
  resolutionNotes?: string;
  description?: string;
}

export interface ConflictLog {
  id: string;
  timestamp: string;
  conflictType: string;
  type?: string;
  sources: {
    concourse?: object;
    turnstile?: object;
    escalator?: object;
  } & {
    [key: string]: object | undefined;
  };
  confidenceScores: {
    concourse: number;
    turnstile: number;
    escalator: number;
  } & {
    [key: string]: number;
  };
  resolution: 'pending' | 'auto_resolved' | 'manual_resolved' | 'auto' | 'manual';
  resolvedBy?: string;
  resolvedAt?: string;
  notes?: string;
  linkedAnomalyId?: string;
  rawValues?: object;
  operator?: string;
  decision?: string;
  time?: string;
  status?: string;
}

export interface Report {
  id: string;
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
  events: Anomaly[];
  conflicts: ConflictLog[];
  exportFormat: 'json' | 'pdf';
  metadata: {
    operator: string;
    stationId: string;
    scenario: string;
    notes?: string;
    generatedAt?: string;
    timeRange?: string;
  };
  summary?: {
    highRiskAnomalies: number;
    mediumRiskAnomalies: number;
    conflicts: number;
  };
  anomalies?: Array<{
    id: string;
    type: AnomalyType;
    severity: Severity;
    time: string;
    description: string;
    evidenceChain?: EvidenceItem[];
    recommendation?: string;
  }>;
  recommendations?: string[];
}
