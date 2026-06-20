export type ConstraintType = 'linear' | 'nonlinear' | 'integer' | 'binary';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type ReviewStatus = 'pending' | 'normal' | 'abnormal' | 'unit_issue';
export type UnitCheckResult = 'pass' | 'missing' | 'mismatch' | 'conversion_error';
export type UnitSystem = 'metric' | 'imperial';
export type ReviewResultStatus = 'normal' | 'abnormal' | 'unit_issue' | 'skipped';

export interface Problem {
  id: string;
  title: string;
  constraintType: ConstraintType;
  boundaryValue: number;
  boundaryUnit: string | null;
  difficulty: Difficulty;
  knowledgePoint: string;
  reviewStatus: ReviewStatus;
  hasUnitIssue: boolean;
  remark: string;
  isRemarkSupplementary: boolean;
  grayReleaseNote?: string;
  originalRow: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewParams {
  groupId: 'A' | 'B';
  tolerance: number;
  unitSystem: UnitSystem;
  strictMode: boolean;
  boundaryMultiplier: number;
}

export interface CalculationStep {
  stepIndex: number;
  description: string;
  formula: string;
  inputValue: number;
  inputUnit: string;
  outputValue: number;
  outputUnit: string;
  unitConversion?: string;
}

export interface ReviewResult {
  id: string;
  problemId: string;
  groupId: 'A' | 'B';
  status: ReviewResultStatus;
  deviation: number;
  deviationUnit: string;
  unitCheckResult: UnitCheckResult;
  changedJudgments: string[];
  problematicRow?: string;
  calculationSteps: CalculationStep[];
  isDirtyDemo?: boolean;
  reviewedAt: string;
}

export interface FilterCriteria {
  difficulties: Difficulty[];
  constraintTypes: ConstraintType[];
  reviewStatuses: ReviewStatus[];
  showUnitIssuesOnly: boolean;
  keyword: string;
}

export interface ExportReport {
  exportTime: string;
  filterCriteria: FilterCriteria;
  filterSummary: string;
  totalCount: number;
  normalCount: number;
  abnormalCount: number;
  unitIssueCount: number;
  pendingCount: number;
  problematicRows: { rowNumber: number; problemId: string; title: string; deviation: number }[];
  problems: Problem[];
  reviewResults: ReviewResult[];
}

export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
}
