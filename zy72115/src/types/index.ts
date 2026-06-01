export type Direction = 'H' | 'V' | 'A';

export type AmplitudeUnit = 'mm/s' | 'μm' | 'in/s' | 'mil' | 'm/s²' | 'g';

export type DataSource = '实验表' | '照片说明' | '维修微信群';

export type RecordStatus = '正常' | '需确认' | '旧口径';

export type ThresholdLevel = '正常' | '警告' | '危险';

export interface Compressor {
  id: string;
  name: string;
  model: string;
  ratedRpm: number;
}

export interface VibrationRecord {
  id: string;
  compressorId: string;
  direction: Direction;
  frequencyHz: number;
  amplitude: number;
  amplitudeUnit: AmplitudeUnit;
  amplitudeMmPerS: number;
  rpm: number;
  dataSource: DataSource;
  recordTime: string;
  status: RecordStatus;
  validationNotes: string[];
  confirmationNote: string;
  isExtreme: boolean;
}

export interface ThresholdResult {
  level: ThresholdLevel;
  value: number;
  color: string;
}

export interface PhysicsResult {
  fundamentalHz: number;
  harmonics: number[];
  displacementUm: number;
  peakMmPerS: number;
  rmsMmPerS: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  H: '水平 (H)',
  V: '垂直 (V)',
  A: '轴向 (A)',
};

export const THRESHOLD_BOUNDARIES = {
  normal: 4.5,
  warning: 11.2,
} as const;
