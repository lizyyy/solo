export type ProductStatus = 'NEW' | 'HOT' | 'NORMAL' | 'SLOW' | 'CLEAR';

export type ConfirmationStatus = 'CONFIRMED' | 'TEMPORARY';

export type AnomalyType = 'MISSING_SAMPLE' | 'PROMO_DISTORT' | 'ABSORBING_MISSET';

export type MatrixType = 'FULL' | 'PROMO' | 'NON_PROMO';

export type ContentType = 'FULL_REPORT' | 'MATRIX_ONLY' | 'FORECAST_ONLY' | 'ANOMALY_ONLY';

export type ReportFormat = 'EXCEL' | 'PDF' | 'JSON';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export const PRODUCT_STATUSES: ProductStatus[] = ['NEW', 'HOT', 'NORMAL', 'SLOW', 'CLEAR'];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  NEW: '新品',
  HOT: '畅销',
  NORMAL: '正常',
  SLOW: '滞销',
  CLEAR: '清仓',
};

export const STATUS_COLORS: Record<ProductStatus, string> = {
  NEW: '#3b82f6',
  HOT: '#ef4444',
  NORMAL: '#22c55e',
  SLOW: '#f59e0b',
  CLEAR: '#6b7280',
};

export const CONFIRMATION_LABELS: Record<ConfirmationStatus | 'ALL', string> = {
  CONFIRMED: '已确认',
  TEMPORARY: '临时备注',
  ALL: '全部',
};

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  MISSING_SAMPLE: '状态跳转缺样',
  PROMO_DISTORT: '促销干扰',
  ABSORBING_MISSET: '吸收态误设',
};

export const ANOMALY_SEVERITY_COLORS: Record<Severity, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

export interface Product {
  sku: string;
  name: string;
  category: string;
  cost: number;
  launchDate: Date;
}

export interface WeeklyRecord {
  id: string;
  sku: string;
  productName: string;
  category: string;
  weekNum: number;
  year: number;
  salesVolume: number;
  inventory: number;
  turnoverDays: number;
  isPromotion: boolean;
  status: ProductStatus;
  confirmationStatus: ConfirmationStatus;
  notes?: string;
}

export interface StatusTransition {
  id: string;
  sku: string;
  fromStatus: ProductStatus;
  toStatus: ProductStatus;
  weekNum: number;
  isPromotion: boolean;
  confirmationStatus: ConfirmationStatus;
}

export interface TransitionMatrix {
  id: string;
  states: ProductStatus[];
  probabilities: number[][];
  sampleCounts: number[][];
  windowSize: number;
  includePromo: boolean;
  matrixType: MatrixType;
  generatedAt: Date;
}

export interface ForecastResult {
  week: number;
  probabilities: Record<ProductStatus, number>;
  confidenceInterval: {
    lower: Record<ProductStatus, number>;
    upper: Record<ProductStatus, number>;
  };
}

export interface AbsorbingAnalysis {
  absorbingStates: ProductStatus[];
  transientStates: ProductStatus[];
  absorptionProbabilities: Record<ProductStatus, Record<ProductStatus, number>>;
  expectedTimeToAbsorption: Record<ProductStatus, number>;
  fundamentalMatrix: number[][];
}

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  fromStatus?: ProductStatus;
  toStatus?: ProductStatus;
  severity: Severity;
  description: string;
  suggestion: string;
  affectedTransitions?: string[];
  sampleCount?: number;
  distortionFactor?: number;
  isResolved: boolean;
}

export interface ReportBatch {
  batchId: string;
  name: string;
  contentType: ContentType;
  format: ReportFormat;
  generatedAt: Date;
  generatedBy: string;
  downloadUrl: string;
}

export interface AppState {
  weeklyRecords: WeeklyRecord[];
  transitionMatrix: TransitionMatrix | null;
  promoMatrix: TransitionMatrix | null;
  nonPromoMatrix: TransitionMatrix | null;
  forecastResults: ForecastResult[];
  absorbingAnalysis: AbsorbingAnalysis | null;
  anomalies: AnomalyRecord[];
  reportBatches: ReportBatch[];
  selectedCell: { from: ProductStatus; to: ProductStatus } | null;
  drillDownRecords: WeeklyRecord[];
  confirmationFilter: ConfirmationStatus | 'ALL';
  forecastWeeks: number;
  windowSize: number;
  isLoading: boolean;
}
