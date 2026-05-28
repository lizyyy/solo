export type PigmentStatus = 'processed' | 'pending' | 'rejected';

export type AnomalyType = 'ratio_incomplete' | 'lightfastness_missing' | 'cost_abnormal' | 'data_missing';

export interface FormulaComponent {
  componentName: string;
  ratio: number;
}

export interface Pigment {
  id: string;
  name: string;
  code: string;
  colorHex: string;
  transparency: number;
  lightfastness: number | null;
  cost: number;
  formula: FormulaComponent[];
  status: PigmentStatus;
  anomalies: AnomalyType[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface FilterCriteria {
  transparencyRange: [number, number];
  lightfastnessRange: [number, number];
  costRange: [number, number];
  status: PigmentStatus[];
  anomalies: AnomalyType[];
  searchText: string;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  pigmentIds: string[];
  createdAt: string;
}

export interface SimilarPigmentResult {
  pigment: Pigment;
  similarityScore: number;
  differences: {
    formula: number;
    transparency: number;
    lightfastness: number;
  };
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  ratio_incomplete: '比例不满一',
  lightfastness_missing: '耐光缺测',
  cost_abnormal: '成本异常',
  data_missing: '数据缺失',
};

export const STATUS_LABELS: Record<PigmentStatus, string> = {
  processed: '已处理',
  pending: '待确认',
  rejected: '需退回',
};

export const STATUS_COLORS: Record<PigmentStatus, string> = {
  processed: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
};

export interface CubePosition {
  x: number;
  y: number;
  z: number;
}
