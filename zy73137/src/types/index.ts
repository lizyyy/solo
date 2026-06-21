export type TideUnit = "m" | "cm";
export type LogStatus = "normal" | "warning" | "error";
export type AnomalyType = "anomaly" | "pending_confirmation";
export type Severity = "high" | "medium" | "low";
export type TriggerType = "auto" | "manual_rerun" | "supplement_rerun";

export interface BuoyLog {
  id: string;
  timestamp: number;
  deviceId: string;
  dissolvedOxygen: number;
  turbidity: number;
  ph: number;
  temperature: number;
  tideLevel: number;
  tideUnit: TideUnit;
  rawPayload: string;
  status: LogStatus;
  _correctedFromCm?: boolean;
}

export interface ManualRecord {
  id: string;
  recordedAt: number;
  arrivedAt: number;
  location: string;
  sampleDO: number | null;
  sampleTurbidity: number | null;
  operator: string;
  remark: string;
}

export interface SupplementaryNote {
  id: string;
  attachedAt: number;
  author: string;
  content: string;
  relatedTimeRange: [number, number];
}

export interface AnomalyEvent {
  id: string;
  timestamp: number;
  type: AnomalyType;
  severity: Severity;
  reason: string;
  detail: string;
  relatedBuoyLogIds: string[];
  relatedManualIds: string[];
  confirmed: boolean;
  confirmedBy?: string;
}

export interface CalculationSpec {
  id: string;
  version: string;
  timestamp: number;
  formula: string;
  unitConversions: Record<string, string>;
  involvedFields: string[];
  thresholds: Record<string, [number, number]>;
}

export interface HistoryVersion {
  id: string;
  versionTag: string;
  createdAt: number;
  createdBy: string;
  trigger: TriggerType;
  hasManualEdit: boolean;
  manualEditFields?: string[];
  spec: CalculationSpec;
  continuityReport: {
    hasGaps: boolean;
    gaps: Array<{ from: number; to: number; durationMs: number }>;
  };
}

export type MetricKey = "dissolvedOxygen" | "turbidity" | "ph" | "tideLevel";

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  domain: [number, number];
}
