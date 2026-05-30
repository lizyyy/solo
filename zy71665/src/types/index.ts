export type LengthUnit = 'km' | 'm';
export type PowerUnit = 'dBm' | 'mW';
export type WavelengthUnit = 'nm' | 'μm';
export type DataSource = 'system' | 'manual';
export type AnomalyType = 'unit_error' | 'zero_length' | 'duplicate_connector';
export type AnomalySeverity = 'error' | 'warning';
export type HistoryAction = 'calculate' | 'modify' | 'supplement' | 'undo' | 'delete';

export interface MeasurementRecord {
  id: string;
  fiberLength: number;
  lengthUnit: LengthUnit;
  inputPower: number;
  outputPower: number;
  powerUnit: PowerUnit;
  wavelength: number;
  wavelengthUnit: WavelengthUnit;
  connectorCount: number;
  connectorIds: string[];
  dataSource: DataSource;
  notes: string;
  createdAt: string;
}

export interface Anomaly {
  id: string;
  recordId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  suggestion: string;
}

export interface CalculationResult {
  id: string;
  recordId: string;
  lossDB: number;
  lossPerKm: number;
  connectorLoss: number;
  totalLoss: number;
  calculatedAt: string;
}

export interface HistoryEntry {
  id: string;
  action: HistoryAction;
  summary: string;
  beforeSnapshot: string;
  afterSnapshot: string;
  timestamp: string;
}

export interface FilterState {
  wavelengthRange: [number, number];
  lengthRange: [number, number];
  anomalyTypes: AnomalyType[];
  dataSource: DataSource[];
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  unit_error: '对数单位错误',
  zero_length: '长度为零',
  duplicate_connector: '接头重复',
};

export const ANOMALY_TYPE_DESCRIPTIONS: Record<AnomalyType, string> = {
  unit_error: '功率值使用了 mW（线性单位）但未转换为 dBm（对数单位），或混用了 dBm 与 mW，直接相减会导致损耗计算错误。需统一为 dBm 后再计算：P(dBm) = 10·lg(P(mW))。',
  zero_length: '光纤长度为 0 km，无法计算每公里损耗系数（除零错误）。通常是因为长度字段漏填或单位选择错误（如实际为 m 却选了 km）。',
  duplicate_connector: '同一光纤段内出现了重复的接头编号，可能是在记录时误录或系统导出重复行。重复的接头会导致接头损耗被重复计入总损耗。',
};
