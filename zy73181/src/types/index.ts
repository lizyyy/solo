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

export interface StepDetail {
  rawBoundaryValue: number;
  rawBoundaryUnit: string | null;
  adjustedValue: number;
  adjustedUnit: string;
  convertedValue: number | null;
  convertedUnit: string | null;
  conversionFormula: string | null;
  toleranceValue: number;
  lowerBound: number;
  upperBound: number;
  boundUnit: string;
  actualValue: number;
  actualUnit: string;
  deviationAbsolute: number;
  deviationRelative: number;
  deviationSource: string;
  threshold: number;
  isNormal: boolean;
  strictMultiplier: number;
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
  stepDetail?: StepDetail | null;
}

export interface FilterCriteria {
  difficulties: Difficulty[];
  constraintTypes: ConstraintType[];
  reviewStatuses: ReviewStatus[];
  showUnitIssuesOnly: boolean;
  keyword: string;
}

export interface ProblematicRowInfo {
  id: string;
  problemId: string;
  originalRow: number;
  title: string;
  deviation: number;
  deviationAbs: number;
  remarkStatus: 'none' | 'normal' | 'supplementary';
  unitStatus: 'present' | 'missing' | 'mismatch';
  rawBoundaryValue: number | null;
  rawBoundaryUnit: string | null;
  convertedValue: number | null;
  convertedUnit: string | null;
  judgmentA: 'pending' | 'normal' | 'abnormal' | 'unit_issue';
  judgmentB: 'pending' | 'normal' | 'abnormal' | 'unit_issue';
  judgmentChanged: boolean;
  changedJudgments: string[];
}

export interface ExportReport {
  exportTime: string;
  activeGroup: 'A' | 'B';
  filterCriteria: FilterCriteria;
  filterSummary: string;
  statistics: {
    total: number;
    normal: number;
    abnormal: number;
    unitIssue: number;
    pending: number;
  };
  problematicRows: ProblematicRowInfo[];
  unitIssueRows: ProblematicRowInfo[];
  records: Array<{
    problem: Problem;
    result: ReviewResult;
  }>;
}

export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
}
