export type ReviewStatus = 'pending' | 'calculating' | 'completed' | 'error' | 'warning';

export type BlockType = 'formula' | 'unit' | 'threshold' | 'extrapolation' | 'alias';

export type ExtrapolationDirection = 'up' | 'down' | 'both';

export interface ObjectAlias {
  id: string;
  canonicalName: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FormulaDefinition {
  id: string;
  name: string;
  expression: string;
  variables: string[];
  description: string;
}

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  category: string;
  conversionFactor: number;
}

export interface ThresholdDefinition {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  unit: string;
  description: string;
}

export interface CaliberVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  formulas: FormulaDefinition[];
  units: UnitDefinition[];
  thresholds: ThresholdDefinition[];
  createdAt: string;
  createdBy: string;
  isActive: boolean;
  changeLog: string;
}

export interface MaterialSource {
  type: 'file' | 'remark' | 'oral';
  name: string;
  content: string;
  uploadTime: string;
  caliberVersionId: string;
}

export interface MaterialItem {
  id: string;
  objectName: string;
  value: number;
  unit: string;
  sourceIndex: number;
  confidence: number;
}

export interface Material {
  id: string;
  title: string;
  materials: MaterialSource[];
  items: MaterialItem[];
  scoreRemark: string;
  oralNote: string;
  caliberVersionId: string;
  createdAt: string;
  updatedAt: string;
  status: ReviewStatus;
}

export interface AnomalyRecord {
  id: string;
  boundaryRecordId: string;
  blockType: BlockType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: Record<string, unknown>;
  resolved: boolean;
  resolution?: string;
  createdAt: string;
}

export interface ExtrapolationInfo {
  direction: ExtrapolationDirection;
  originalRange: [number, number];
  extrapolatedValue: number;
  impactScope: string[];
  suggestion: string;
  method: string;
}

export interface CalculationTrace {
  step: number;
  formula: string;
  inputs: Record<string, number>;
  result: number;
  source: string;
}

export interface BoundaryRecord {
  id: string;
  materialId: string;
  objectName: string;
  canonicalName: string;
  inputValue: number;
  inputUnit: string;
  calculatedValue: number;
  probability: number;
  lowerBound: number;
  upperBound: number;
  isWithinBounds: boolean;
  status: ReviewStatus;
  caliberVersionId: string;
  anomalies: AnomalyRecord[];
  extrapolation?: ExtrapolationInfo;
  calculationTrace: CalculationTrace[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
}

export interface ReviewSummary {
  totalRecords: number;
  withinBounds: number;
  outOfBounds: number;
  errors: number;
  warnings: number;
  extrapolations: number;
  aliasResolved: number;
}

export interface CSVExportConfig {
  includeCaliberInfo: boolean;
  includeCalculationTrace: boolean;
  includeAnomalies: boolean;
  format: 'detailed' | 'summary';
}
