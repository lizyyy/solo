export type SampleStatus = '异常' | '空集合' | '重复' | '待确认' | '可放行';
export type Verdict = '需补材料' | '可放行' | null;
export type StatusFilter = '全部' | SampleStatus;

export interface DraftLine {
  id: string;
  sampleId: string;
  lineNumber: number;
  content: string;
  isWithdrawn: boolean;
  withdrawnAt?: string;
  clueColor?: string;
}

export interface CalculationStep {
  id: string;
  sampleId: string;
  stepNumber: number;
  description: string;
  value: string;
  sourceClue: string;
  sourceRef: string;
  clueColor?: string;
}

export interface HistoryRecord {
  id: string;
  sampleId: string;
  operator: string;
  changedAt: string;
  beforeStatus: SampleStatus;
  afterStatus: SampleStatus;
  beforeVerdict: Verdict;
  afterVerdict: Verdict;
  note: string;
}

export interface CalculationCriterion {
  id: string;
  ruleNumber: string;
  title: string;
  description: string;
  isEmptySetRule: boolean;
  version: string;
}

export interface StudentSample {
  id: string;
  studentId: string;
  studentName: string;
  problemTitle: string;
  resultSummary: string;
  status: SampleStatus;
  isDuplicate: boolean;
  duplicateOf?: string;
  reviewNote?: string;
  finalVerdict: Verdict;
  submittedAt: string;
  batch: string;
  draftLines: DraftLine[];
  calculationSteps: CalculationStep[];
  history: HistoryRecord[];
}
