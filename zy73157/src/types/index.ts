export type RecordStatus = "resolved" | "pending_evidence" | "blocked";

export type AnomalyType = 
  | "value_exceeded" 
  | "sensor_drift" 
  | "withdrawal" 
  | "abnormal_trend"
  | "missing_data";

export type SamplingParameter = "temperature" | "salinity" | "pressure" | "dissolved_oxygen" | "ph";

export interface Position {
  longitude: number;
  latitude: number;
  depth: number;
}

export interface NotebookSource {
  bookId: string;
  page: number;
  line: number;
  originalText: string;
  recordedBy: string;
  recordedAt: string;
}

export interface SensorDrift {
  id: string;
  sensorId: string;
  driftValue: number;
  driftDirection: "positive" | "negative";
  affectedStartIndex: number;
  affectedEndIndex: number;
  sourceLine: number;
  detectedAt: string;
  corrected: boolean;
  correctionMethod?: string;
}

export interface WithdrawalRecord {
  id: string;
  originalRecordId: string;
  reason: string;
  withdrawnBy: string;
  withdrawnAt: string;
  sourcePage: number;
  sourceLine: number;
  annotation: string;
  replacementRecordId?: string;
}

export interface EvidenceItem {
  id: string;
  type: "notebook" | "sensor_log" | "photo" | "calibration_record";
  description: string;
  reference: string;
  uploadedAt: string;
}

export interface SamplingRecord {
  id: string;
  timestamp: string;
  position: Position;
  parameters: Record<SamplingParameter, number | null>;
  status: RecordStatus;
  anomalies: string[];
  notebookSource: NotebookSource;
  evidence: EvidenceItem[];
  withdrawalId?: string;
  driftIds: string[];
  notes?: string;
}

export interface AnomalyMarker {
  id: string;
  recordId: string;
  type: AnomalyType;
  parameter?: SamplingParameter;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: string;
  handledAt?: string;
  handler?: string;
  resolution?: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentIndex: number;
  speed: number;
  timeRange: [string, string] | null;
}

export interface FilterState {
  status: RecordStatus | "all";
  anomalyType: AnomalyType | "all";
  parameter: SamplingParameter | "all";
  showWithdrawn: boolean;
  showDriftAffected: boolean;
}

export interface ProjectSummary {
  totalRecords: number;
  withdrawnCount: number;
  anomalyCount: number;
  driftAffectedCount: number;
  statusBreakdown: Record<RecordStatus, number>;
  anomalyBreakdown: Record<AnomalyType, number>;
  pendingEvidenceList: {
    recordId: string;
    timestamp: string;
    position: Position;
    missingEvidence: string[];
  }[];
  blockedList: {
    recordId: string;
    timestamp: string;
    position: Position;
    blockReason: string;
  }[];
  driftSummary: {
    driftId: string;
    sensorId: string;
    affectedCount: number;
    driftValue: number;
    corrected: boolean;
  }[];
  lastUpdated: string;
}
