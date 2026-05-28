export type AnomalySeverity = 'low' | 'medium' | 'high';

export type AnomalyType =
  | 'material_missing'
  | 'ray_too_dense'
  | 'seat_sampling_error'
  | 'seat_no_reading'
  | 'energy_decay_error'
  | 'data_incomplete';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  affectedIds: string[];
  suggestion: string;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  material_missing: '材料参数缺失',
  ray_too_dense: '反射路径过密',
  seat_sampling_error: '座位采样错误',
  seat_no_reading: '座位无读数',
  energy_decay_error: '能量衰减异常',
  data_incomplete: '数据不完整',
};

export const ANOMALY_SEVERITY_COLORS: Record<AnomalySeverity, string> = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#F44336',
};

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
};
