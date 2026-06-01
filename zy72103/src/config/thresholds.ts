import type { ThresholdConfig } from '@/types';

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  temperatureDanger: 80,
  temperatureWarning: 60,
  voltageDanger: 4.5,
  voltageWarning: 4.3,
  extremeStdDev: 3,
  extremeIQR: 1.5,
};

export const STEP_LABELS: Record<string, string> = {
  raw: '原始数据',
  qualityCheck: '质量检查',
  extremeDetection: '极端值检测',
  thresholdCompare: '阈值比对',
  riskRating: '风险评级',
};

export const RESULT_LABELS: Record<string, string> = {
  normal: '正常',
  warning: '警告',
  danger: '危险',
};

export const RISK_LABELS: Record<string, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

export const FIELD_LABELS: Record<string, string> = {
  temperature: '温度',
  voltage: '电压',
  current: '电流',
  internalResistance: '内阻',
};

export const FIELD_UNITS: Record<string, string> = {
  temperature: '°C',
  voltage: 'V',
  current: 'A',
  internalResistance: 'mΩ',
};
