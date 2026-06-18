export type SampleStatus = 'processed' | 'pending' | 'blocked';
export type AnomalyType = 'threshold' | 'drift' | 'other';
export type EvidenceStatus = 'none' | 'partial' | 'complete';
export type RecordType = 'normal' | 'withdraw' | 'note';

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  depth: number;
}

export interface Sample {
  id: string;
  stationId: string;
  timestamp: string;
  temperature: number;
  salinity: number;
  dissolvedOxygen: number;
  pressure: number;
  status: SampleStatus;
  isWithdrawn: boolean;
  withdrawReason?: string;
  withdrawLogbookId?: string;
}

export interface Anomaly {
  id: string;
  sampleId: string;
  stationId: string;
  type: AnomalyType;
  description: string;
  sourceLogbookId: string;
  evidenceStatus: EvidenceStatus;
  value: number;
  metric: 'temperature' | 'salinity' | 'dissolvedOxygen' | 'pressure';
  threshold: number;
  handler?: string;
  nextAction?: string;
}

export interface DriftEvent {
  id: string;
  sensorType: 'temperature' | 'salinity' | 'dissolvedOxygen';
  startTimestamp: string;
  endTimestamp: string;
  affectedStationIds: string[];
  sourceLogbookId: string;
  rootCause: string;
  impact: string;
  driftMagnitude: number;
  corrected: boolean;
}

export interface LogbookEntry {
  id: string;
  page: string;
  lineNumber: number;
  content: string;
  recorder: string;
  timestamp: string;
  recordType: RecordType;
  linkedSampleId?: string;
  linkedAnomalyId?: string;
  linkedDriftId?: string;
}

export interface HandoverReport {
  generatedAt: string;
  shift: string;
  summary: {
    processed: number;
    pendingEvidence: number;
    blocked: number;
    anomalies: number;
    withdrawn: number;
    driftEvents: number;
  };
  blockedItems: Array<{
    id: string;
    station: string;
    timestamp: string;
    description: string;
    blocker: string;
    logbookSource: { page: string; line: number; content: string };
  }>;
  pendingItems: Array<{
    id: string;
    station: string;
    description: string;
    missingEvidence: string[];
    logbookSource: { page: string; line: number; content: string };
  }>;
  driftItems: Array<{
    id: string;
    sensorType: string;
    startTimestamp: string;
    endTimestamp: string;
    impact: string;
    rootCause: string;
    corrected: boolean;
  }>;
}
