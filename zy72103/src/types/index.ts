export type DetectionStepType =
  | 'raw'
  | 'qualityCheck'
  | 'extremeDetection'
  | 'thresholdCompare'
  | 'riskRating';

export type ResultType = 'normal' | 'warning' | 'danger';

export type RiskLevelType = 'low' | 'medium' | 'high';

export type FieldType = 'temperature' | 'voltage' | 'current' | 'internalResistance';

export interface DetectionStep {
  step: DetectionStepType;
  timestamp: Date;
  value: number;
  threshold: number;
  result: ResultType;
  formula: string;
}

export interface SupplementNote {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  affectedFields: FieldType[];
  beforeAnalysis: AnalysisResult;
  afterAnalysis: AnalysisResult;
}

export interface DataQuality {
  isNull: boolean;
  isDuplicate: boolean;
  isBoundary: boolean;
  isExtreme: boolean;
}

export interface BatteryRecord {
  id: string;
  timestamp: Date;
  temperature: number | null;
  voltage: number | null;
  current: number | null;
  internalResistance: number | null;
  dataQuality: DataQuality;
  detectionSteps: DetectionStep[];
  supplementNote?: SupplementNote;
}

export interface AnalysisResult {
  meanTemperature: number;
  meanVoltage: number;
  meanTemperatureWithExtremes: number;
  extremeCount: number;
  riskLevel: RiskLevelType;
  excludedRecords: string[];
  stdDev?: number;
  iqr?: number;
  q1?: number;
  q3?: number;
}

export interface ThresholdConfig {
  temperatureDanger: number;
  temperatureWarning: number;
  voltageDanger: number;
  voltageWarning: number;
  extremeStdDev: number;
  extremeIQR: number;
}

export interface ExtremeDetectionResult {
  flags: boolean[];
  method: 'stddev' | 'iqr' | 'any';
  meanWithExtremes: number;
  meanWithoutExtremes: number;
  excludedCount: number;
  stdDev?: number;
  iqr?: number;
  q1?: number;
  q3?: number;
}

export interface DataQualityReport {
  totalRecords: number;
  nullCount: number;
  duplicateCount: number;
  boundaryCount: number;
  extremeCount: number;
  nullRecords: string[];
  duplicateRecords: string[];
  boundaryRecords: string[];
  extremeRecords: string[];
}

export interface RecommendationItem {
  level: 'danger' | 'warning' | 'info';
  title: string;
  description: string;
  action: string;
  relatedRecordIds: string[];
}

export interface PhotoAttachment {
  id: string;
  name: string;
  url: string;
  annotation?: string;
  timestamp: Date;
}

export interface AppState {
  records: BatteryRecord[];
  photos: PhotoAttachment[];
  currentAnalysis: AnalysisResult | null;
  previousAnalysis: AnalysisResult | null;
  dataQualityReport: DataQualityReport | null;
  recommendations: RecommendationItem[];
  selectedRecordId: string | null;
  isAnalyzed: boolean;
}
