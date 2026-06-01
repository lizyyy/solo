export type Unit = 'dB' | 'dBA' | 'dBm' | 'Hz' | 'kHz' | 'RPM' | 'm/s' | 'km/h' | 'm' | 'km' | 'kg' | 'g' | 'N' | 'Pa';

export type Direction = 'CW' | 'CCW' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type ConflictType = 'unit_mismatch' | 'direction_error' | 'timegap_error' | 'value_conflict';
export type Severity = 'warning' | 'error' | 'critical';
export type BatchStatus = 'draft' | 'processing' | 'completed' | 'rework';
export type Assessment = 'normal' | 'warning' | 'critical';
export type DataSource = 'sensor' | 'import' | 'manual';
export type ResolutionType = 'use_sensor' | 'use_import' | 'manual';
export type DiffType = 'added' | 'removed' | 'modified';
export type DiffSignificance = 'low' | 'medium' | 'high';
export type AnomalyType = 'threshold_exceed' | 'outlier' | 'missing_data';

export interface DataPoint {
  id: string;
  timestamp: number;
  value: number;
  unit: Unit;
  direction?: Direction;
  source: DataSource;
  confidence: number;
}

export interface SensorLogEntry {
  id: string;
  timestamp: number;
  parameter: string;
  value: number;
  unit: Unit;
  rawLog: string;
}

export interface ExperimentRecord {
  id: string;
  batchId: string;
  droneModel: string;
  rotorModel: string;
  testDate: string;
  temperature: number;
  humidity: number;
  atmosphericPressure: number;
  dataPoints: DataPoint[];
  sensorLogs: SensorLogEntry[];
  photoUrls?: string[];
}

export interface OperationCondition {
  id: string;
  batchId: string;
  timestamp: number;
  description: string;
  rotorSpeed?: number;
  flightAltitude?: number;
  payload?: number;
  weatherCondition?: string;
}

export interface CalculationNode {
  id: string;
  batchId: string;
  timestamp: number;
  step: number;
  operation: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  formula?: string;
  operator?: string;
  note?: string;
}

export interface UnitConversion {
  id: string;
  fromValue: number;
  fromUnit: Unit;
  toValue: number;
  toUnit: Unit;
  formula: string;
  timestamp: number;
}

export interface ConflictRecord {
  id: string;
  batchId: string;
  timestamp: number;
  type: ConflictType;
  severity: Severity;
  sensorData: {
    value: number;
    unit: Unit;
    timestamp: number;
    rawLog: string;
  };
  importData: {
    value: number;
    unit: Unit;
    timestamp: number;
    source: string;
  };
  suggestedAction: string;
  resolution?: ResolutionType;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface AnomalyRecord {
  id: string;
  batchId: string;
  type: AnomalyType;
  description: string;
  value: number;
  threshold: number;
  timestamp: number;
  highlighted: boolean;
}

export interface ThresholdConfig {
  noiseWarning: number;
  noiseCritical: number;
  timeGapWarning: number;
  timeGapCritical: number;
  valueTolerance: number;
  directionMismatch: boolean;
}

export interface Note {
  id: string;
  batchId: string;
  timestamp: number;
  content: string;
  author: string;
  previousResultSnapshot?: NoisePredictionResult;
}

export interface NoisePredictionResult {
  overallNoiseLevel: number;
  unit: Unit;
  dominantFrequency: number;
  harmonicComponents: number[];
  directionalityIndex: number;
  confidenceLevel: number;
  assessment: Assessment;
  recommendations: string[];
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  createdAt: number;
  updatedAt: number;
  experimentRecord: ExperimentRecord;
  operationConditions: OperationCondition[];
  calculationChain: CalculationNode[];
  unitConversions: UnitConversion[];
  conflicts: ConflictRecord[];
  anomalies: AnomalyRecord[];
  notes: Note[];
  result?: NoisePredictionResult;
}

export interface ComparisonDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  diffType: DiffType;
  significance: DiffSignificance;
}

export interface AppState {
  batches: Batch[];
  currentBatchId: string | null;
  thresholdConfig: ThresholdConfig;
  selectedBatchIds: string[];
  isCalculating: boolean;
}

export interface AppActions {
  setCurrentBatch: (id: string | null) => void;
  addBatch: (batch: Batch) => void;
  updateBatch: (batch: Batch) => void;
  deleteBatch: (id: string) => void;
  selectBatch: (id: string) => void;
  deselectBatch: (id: string) => void;
  clearSelection: () => void;
  setCalculating: (calc: boolean) => void;
  updateThresholdConfig: (config: Partial<ThresholdConfig>) => void;
  addNoteToBatch: (batchId: string, note: Note) => void;
  resolveConflict: (batchId: string, conflictId: string, resolution: ResolutionType, resolvedBy: string) => void;
}

export const UNIT_LABELS: Record<Unit, string> = {
  dB: '分贝',
  dBA: 'A计权分贝',
  dBm: '毫瓦分贝',
  Hz: '赫兹',
  kHz: '千赫兹',
  RPM: '转/分钟',
  'm/s': '米/秒',
  'km/h': '千米/时',
  m: '米',
  km: '千米',
  kg: '千克',
  g: '克',
  N: '牛顿',
  Pa: '帕斯卡',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  CW: '顺时针',
  CCW: '逆时针',
  UP: '向上',
  DOWN: '向下',
  LEFT: '向左',
  RIGHT: '向右',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  unit_mismatch: '单位不匹配',
  direction_error: '方向符号错误',
  timegap_error: '时间间隔异常',
  value_conflict: '数值冲突',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  warning: '警告',
  error: '错误',
  critical: '严重',
};

export const ASSESSMENT_LABELS: Record<Assessment, string> = {
  normal: '正常',
  warning: '警告',
  critical: '严重',
};

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  draft: '草稿',
  processing: '处理中',
  completed: '已完成',
  rework: '返工',
};

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  noiseWarning: 80,
  noiseCritical: 85,
  timeGapWarning: 5,
  timeGapCritical: 10,
  valueTolerance: 5,
  directionMismatch: true,
};
