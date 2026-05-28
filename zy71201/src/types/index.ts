export type AnomalyType = 'date_mismatch' | 'warning_line_changed' | 'redemption_suspended';
export type ProductStatus = 'normal' | 'warning' | 'stop_loss';
export type ScriptType = 'normal' | 'warning' | 'special';
export type OperationType = 'create' | 'update' | 'import' | 'export';
export type WarningLevel = 'high' | 'medium' | 'low';

export interface Anomaly {
  type: AnomalyType;
  description: string;
  level: WarningLevel;
  detectedAt: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  manager: string;
  establishDate: string;
  scale: number;
  status: ProductStatus;
  latestNetValue: number;
  latestDrawdownRate: number;
  warningLine: number;
  stopLossLine: number;
  anomalies: Anomaly[];
  lastUpdated: string;
}

export interface NetValue {
  id: string;
  productId: string;
  valueDate: string;
  netValue: number;
  accumulatedValue: number;
  drawdownRate: number;
  source: string;
}

export interface Valuation {
  id: string;
  productId: string;
  valuationDate: string;
  holdingName: string;
  holdingRatio: number;
  marketValue: number;
  source: string;
}

export interface Redemption {
  id: string;
  productId: string;
  effectiveDate: string;
  status: 'normal' | 'suspended' | 'restricted';
  restrictionType?: string;
  description?: string;
  source: string;
}

export interface CustomerNote {
  id: string;
  productId: string;
  content: string;
  scriptType: ScriptType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerScript {
  productId: string;
  type: ScriptType;
  title: string;
  content: string;
  lastModified: string;
  modifiedBy: string;
}

export interface VersionRecord {
  id: string;
  productId: string;
  versionNumber: string;
  operationType: OperationType;
  operator: string;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  diffSummary: string;
  createdAt: string;
}

export interface ListFilter {
  search: string;
  status: ProductStatus | 'all';
  anomalyType: AnomalyType | 'all';
  dateRange: {
    start: string;
    end: string;
  };
  page: number;
  pageSize: number;
}

export interface ExportRecord {
  id: string;
  productIds: string[];
  template: string;
  format: 'xlsx' | 'pdf';
  exportedAt: string;
  exportedBy: string;
  fileName: string;
}
