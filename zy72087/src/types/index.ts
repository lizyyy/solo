export interface ParamConfig {
  id: string;
  lineId: string;
  lineName: string;
  timePeriod: string;
  minIntervalSec: number;
  maxIntervalSec: number;
  targetLoadRate: number;
  weightPassenger: number;
  weightCost: number;
  weightReliability: number;
  unit: 'sec' | 'min';
  caliberTag: string;
}

export interface HistoricalSample {
  id: string;
  lineId: string;
  lineName: string;
  date: string;
  timePeriod: string;
  actualInterval: number | null;
  actualIntervalUnit: 'sec' | 'min';
  passengerCount: number | null;
  costPerTrip: number | null;
  onTimeRate: number | null;
  source: string;
  remarks: string;
  caliberTag: string;
  isOutlier: boolean;
}

export type StepType = 'param_ref' | 'weight_calc' | 'threshold_cmp' | 'conclusion';

export interface ReasoningStep {
  stepType: StepType;
  description: string;
  parameterReferenced: string;
  calculatedValue: number | null;
  thresholdCompared: string;
  conclusion: string;
}

export type SuggestionLevel = 'pass' | 'warn' | 'fail';

export interface ReasoningChain {
  id: string;
  sampleId: string;
  steps: ReasoningStep[];
  finalSuggestion: string;
  suggestionReason: string;
  level: SuggestionLevel;
  needsManualReview: boolean;
}

export type ReviewAction = 'approved' | 'rejected' | 'pending';

export interface ManualReview {
  id: string;
  sampleId: string;
  action: ReviewAction;
  note: string;
  operator: string;
  timestamp: string;
}

export type IssueType = 'null_value' | 'duplicate' | 'out_of_bounds' | 'unit_mismatch' | 'weight_unclosed';

export interface QualityIssue {
  type: IssueType;
  sampleIds: string[];
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface FilterState {
  lineId: string;
  timePeriod: string;
  dateRange: [string, string];
  source: string;
  issueType: string;
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  null_value: '空值',
  duplicate: '重复项',
  out_of_bounds: '越界',
  unit_mismatch: '单位不一致',
  weight_unclosed: '权重未闭合',
};

export const SUGGESTION_LEVEL_LABELS: Record<SuggestionLevel, string> = {
  pass: '通过',
  warn: '需确认',
  fail: '越界驳回',
};
