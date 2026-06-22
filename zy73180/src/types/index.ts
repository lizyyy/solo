export type AnomalyType = 'unit_missing' | 'unit_invalid' | 'boundary_sample' | 'bad_data' | 'calculation_error';

export type ProcessingStatus = 'pending' | 'reviewing' | 'resolved' | 'ignored';

export interface HistoricalAnswer {
  id: string;
  source: string;
  sourceBatch: string;
  rawData: Record<string, any>;
  importedAt: string;
  fieldMappingId: string;
}

export interface CalculationResult {
  value: number | null;
  unit: string | null;
  formula: string;
  variables: Record<string, number>;
  success: boolean;
  errorMessage?: string;
}

export interface FieldMappingInfo {
  rawFieldName: string;
  targetFieldName: string;
  rawValue: any;
  mappedValue: any;
}

export interface AnomalyRecord {
  id: string;
  answerId: string;
  runId: string;
  type: AnomalyType;
  status: ProcessingStatus;
  calculation: CalculationResult;
  isBoundary: boolean;
  boundaryReason?: string;
  unitIssue?: {
    type: 'missing' | 'invalid';
    affectedFields: FieldMappingInfo[];
    invalidUnits?: { field: string; value: string; allowed: string[] }[];
  };
  fieldMappingInfo: FieldMappingInfo[];
  suggestion?: string;
  rawSnapshot: Record<string, any>;
  sourceInfo: {
    source: string;
    sourceBatch: string;
    originalRowIndex: number;
    originalFieldNames: string[];
  };
  detectedAt: string;
}

export interface CalculationRun {
  id: string;
  name: string;
  createdAt: string;
  params: CalculationParams;
  totalCount: number;
  anomalyCount: number;
  anomalies: AnomalyRecord[];
}

export interface CalculationParams {
  id: string;
  formula: string;
  boundaryConfig: BoundaryConfig;
  unitConfig: UnitConfig;
  tolerance: number;
}

export interface BoundaryConfig {
  minValue?: number;
  maxValue?: number;
  percentileThreshold?: number;
  sampleSizeThreshold?: number;
}

export interface UnitConfig {
  requiredFields: string[];
  allowedUnits: string[];
}

export interface FieldMapping {
  id: string;
  name: string;
  mappings: Record<string, string>;
  createdAt: string;
}

export interface AnomalyFilter {
  types: AnomalyType[];
  statuses: ProcessingStatus[];
  sources: string[];
  searchKeyword: string;
}

export interface ComparisonResult {
  runA: CalculationRun;
  runB: CalculationRun;
  changedRecords: ChangedRecord[];
  summary: ComparisonSummary;
}

export interface ChangedRecord {
  answerId: string;
  anomalyA?: AnomalyRecord;
  anomalyB?: AnomalyRecord;
  changeType: 'added' | 'removed' | 'type_changed' | 'status_changed' | 'value_changed';
  valueChange?: {
    oldValue: number | null;
    newValue: number | null;
    delta: number | null;
  };
  reasons: ChangeReason[];
}

export type ChangeReason = 'formula' | 'parameter' | 'unit' | 'boundary' | 'data_quality';

export interface ComparisonSummary {
  totalChanged: number;
  byReason: Record<ChangeReason, number>;
  addedCount: number;
  removedCount: number;
  typeChangedCount: number;
  valueChangedCount: number;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  unit_missing: '单位缺失',
  unit_invalid: '单位不合法',
  boundary_sample: '边界样本',
  bad_data: '坏数据',
  calculation_error: '计算异常',
};

export const STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: '待处理',
  reviewing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

export const TARGET_FIELDS = [
  'id',
  'title',
  'value',
  'unit',
  'category',
  'description',
  'constraint_min',
  'constraint_max',
  'coefficient',
  'base_value',
] as const;

export type TargetField = typeof TARGET_FIELDS[number];

export const FIELD_SYNONYMS: Record<string, TargetField> = {
  'id': 'id',
  '编号': 'id',
  '序号': 'id',
  'ID': 'id',
  'title': 'title',
  '标题': 'title',
  '名称': 'title',
  '题目': 'title',
  'name': 'title',
  'value': 'value',
  '数值': 'value',
  '值': 'value',
  '结果': 'value',
  'result': 'value',
  'amount': 'value',
  'unit': 'unit',
  '单位': 'unit',
  '计量单位': 'unit',
  'category': 'category',
  '类别': 'category',
  '分类': 'category',
  '类型': 'category',
  'type': 'category',
  'description': 'description',
  '描述': 'description',
  '说明': 'description',
  '备注': 'description',
  'constraint_min': 'constraint_min',
  '约束最小值': 'constraint_min',
  '最小值': 'constraint_min',
  '下限': 'constraint_min',
  'min': 'constraint_min',
  'min_value': 'constraint_min',
  'constraint_max': 'constraint_max',
  '约束最大值': 'constraint_max',
  '最大值': 'constraint_max',
  '上限': 'constraint_max',
  'max': 'constraint_max',
  'max_value': 'constraint_max',
  'coefficient': 'coefficient',
  '系数': 'coefficient',
  '比例系数': 'coefficient',
  'factor': 'coefficient',
  'base_value': 'base_value',
  '基准值': 'base_value',
  '基础值': 'base_value',
  'base': 'base_value',
};
