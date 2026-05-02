export interface TemperatureRecord {
  timestamp: Date;
  fridgeId: string;
  probeId: string;
  temperature: number;
  isValid: boolean;
  rawValue: string;
}

export interface DoorRecord {
  timestamp: Date;
  fridgeId: string;
  eventType: 'open' | 'close';
  duration?: number;
  operator?: string;
}

export interface VaccineBatch {
  batchId: string;
  vaccineName: string;
  manufacturer: string;
  quantity: number;
  minTemp: number;
  maxTemp: number;
  validFrom: Date;
  validTo: Date;
  fridgeId: string;
  entryDate: Date;
  exitDate?: Date;
  targetFridgeId?: string;
  notes?: string;
}

export interface TemperatureRule {
  id: string;
  name: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  fridgeId: string;
  probeId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  severity: SeverityLevel;
  description: string;
  affectedRecords: TemperatureRecord[];
  metadata: Record<string, unknown>;
}

export type AnomalyType =
  | 'over_temp'
  | 'under_temp'
  | 'missing_data'
  | 'rapid_change'
  | 'transfer_gap'
  | 'probe_disconnect'
  | 'door_open_long';

export type SeverityLevel = 'critical' | 'warning' | 'info';

export interface RiskFragment {
  id: string;
  batchId: string;
  vaccineName: string;
  anomalyIds: string[];
  startTime: Date;
  endTime: Date;
  totalDurationMinutes: number;
  riskLevel: RiskLevel;
  temperatureExposure: {
    min: number;
    max: number;
    avg: number;
  };
  fridgeLocations: string[];
  recommendedAction: ActionRecommendation;
  notes?: string;
}

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export interface ActionRecommendation {
  priority: 'immediate' | 'urgent' | 'standard' | 'monitor';
  actions: string[];
  responsibleRole: string;
  deadlineHours?: number;
}

export interface UnifiedTimeline {
  startTime: Date;
  endTime: Date;
  fridges: FridgeTimeline[];
  batches: BatchTimeline[];
}

export interface FridgeTimeline {
  fridgeId: string;
  records: TemperatureRecord[];
  doorEvents: DoorRecord[];
  anomalies: Anomaly[];
}

export interface BatchTimeline {
  batchId: string;
  batch: VaccineBatch;
  locationHistory: BatchLocationEvent[];
  temperatureHistory: TemperatureRecord[];
  riskFragments: RiskFragment[];
}

export interface BatchLocationEvent {
  timestamp: Date;
  fridgeId: string;
  eventType: 'entry' | 'exit' | 'transfer';
  quantity?: number;
}

export interface ReviewSession {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  sourceFiles: SourceFileInfo[];
  data: SessionData;
  analysis: SessionAnalysis;
  annotations: SessionAnnotation[];
  settings: SessionSettings;
}

export interface SourceFileInfo {
  id: string;
  filename: string;
  filePath: string;
  fileType: 'temperature' | 'door' | 'vaccine';
  size: number;
  importedAt: Date;
  recordCount: number;
  hash: string;
}

export interface SessionData {
  temperatureRecords: TemperatureRecord[];
  doorRecords: DoorRecord[];
  vaccineBatches: VaccineBatch[];
}

export interface SessionAnalysis {
  unifiedTimeline: UnifiedTimeline;
  anomalies: Anomaly[];
  riskFragments: RiskFragment[];
  summary: AnalysisSummary;
}

export interface AnalysisSummary {
  totalRecords: number;
  totalAnomalies: number;
  anomalyByType: Record<AnomalyType, number>;
  totalRiskFragments: number;
  riskByLevel: Record<RiskLevel, number>;
  affectedBatches: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface SessionAnnotation {
  id: string;
  targetType: 'anomaly' | 'riskFragment' | 'batch';
  targetId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface SessionSettings {
  temperatureRules: TemperatureRule[];
  reportTemplate: string;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  overTempThreshold: number;
  underTempThreshold: number;
  missingDataMinutes: number;
  rapidChangeThreshold: number;
  doorOpenMinutes: number;
}

export interface ReportData {
  session: ReviewSession;
  generatedAt: Date;
  format: 'markdown' | 'csv' | 'json';
}

export interface CSVReport {
  anomalies: AnomalyCSVRow[];
  riskFragments: RiskFragmentCSVRow[];
  batches: BatchCSVRow[];
}

export interface AnomalyCSVRow {
  anomalyId: string;
  type: string;
  severity: string;
  fridgeId: string;
  probeId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  description: string;
  metadata: string;
}

export interface RiskFragmentCSVRow {
  fragmentId: string;
  batchId: string;
  vaccineName: string;
  riskLevel: string;
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  fridges: string;
  recommendedActions: string;
}

export interface BatchCSVRow {
  batchId: string;
  vaccineName: string;
  manufacturer: string;
  quantity: number;
  minTemp: number;
  maxTemp: number;
  validFrom: string;
  validTo: string;
  currentFridge: string;
  riskCount: number;
  highestRisk: string;
}
