export interface SoundVelocityInput {
  temperature: number | null;
  distance: number | null;
  timeDiff: number | null;
  timeUnit: 's' | 'ms';
  deviceDeviation: number | null;
  deviceId?: string;
  timestamp: number;
  operator?: string;
  notes?: string;
}

export interface CalculationStep {
  id: string;
  stepOrder: number;
  formula: string;
  description: string;
  intermediateValue: number;
  unit: string;
  inputs: Record<string, number | string>;
}

export interface CalculationResult {
  id: string;
  inputHash: string;
  theoreticalValue: number;
  measuredValue: number;
  calibratedValue: number;
  deviation: number;
  deviationPercent: number;
  conclusion: 'consistent' | 'inconsistent' | 'warning';
  calculationSteps: CalculationStep[];
  inputSnapshot: SoundVelocityInput;
  calculatedAt: number;
  algorithmVersion: string;
}

export enum AnomalyType {
  TEMPERATURE_MISSING = 'temperature_missing',
  TIME_UNIT_ERROR = 'time_unit_error',
  DEVICE_DEVIATION_MISSING = 'device_deviation_missing',
  VALUE_OUT_OF_RANGE = 'value_out_of_range',
  CONCLUSION_INCONSISTENT = 'conclusion_inconsistent',
  DISTANCE_MISSING = 'distance_missing',
  TIME_DIFF_MISSING = 'time_diff_missing',
}

export type AnomalySeverity = 'info' | 'warning' | 'error';

export interface AnomalyInfo {
  severity: AnomalySeverity;
  explanation: string;
  impact: string;
  suggestion: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  explanation: string;
  impact: string;
  suggestion: string;
  detectedAt: number;
  sequence: number;
  field?: string;
  value?: number | string;
}

export type EvidenceType = 
  | 'temperature_conclusion' 
  | 'distance_conclusion' 
  | 'time_diff_evidence' 
  | 'calibration_detail' 
  | 'anomaly'
  | 'calculation_step';

export type EvidenceSource = 'temperature' | 'distance' | 'time' | 'device' | 'system';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  content: string;
  value?: number;
  unit?: string;
  timestamp: number;
  sequence: number;
  source: EvidenceSource;
  supports?: string[];
  contradicts?: string[];
  anomalyId?: string;
}

export interface EvidenceChain {
  items: EvidenceItem[];
  orderedBy: 'timestamp' | 'sequence' | 'type';
  overallConclusion: string;
  confidence: number;
  corroborationLevel: 'full' | 'partial' | 'none';
  contradictions: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  timestamp: number;
  details: Record<string, unknown>;
  sequence: number;
}

export interface CompleteRecord {
  id: string;
  input: SoundVelocityInput;
  anomalies: Anomaly[];
  result: CalculationResult;
  evidenceChain: EvidenceChain;
  auditLog: AuditLogEntry[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface ViewState {
  filters: {
    temperatureRange: [number, number];
    dateRange: [Date, Date];
    deviceIds: string[];
    conclusionTypes: string[];
  };
  sort: { field: string; order: 'asc' | 'desc' };
  pagination: { page: number; pageSize: number };
  visibleColumns: string[];
  chartZoom?: { x: [number, number]; y: [number, number] };
}

export interface ExportPayload {
  data: CompleteRecord[];
  viewState: ViewState;
  viewHash: string;
  exportTimestamp: number;
  filterDescription: string;
}
