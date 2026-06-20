export type MaterialType = "历史答案" | "后补备注" | "口头备注";
export type Severity = "ok" | "warn" | "divzero";
export type StepStatus = "initial" | "ok" | "divzero";

export interface RecurrenceDecl {
  num: string;
  den: string;
}

export interface BoundaryDecl {
  a0?: number;
  a1?: number;
}

export interface MaterialContribution {
  recurrence?: RecurrenceDecl;
  boundary?: BoundaryDecl;
}

export interface Material {
  id: string;
  type: MaterialType;
  version: string;
  source: string;
  content: string;
  contentHash: string;
  contributes?: MaterialContribution;
  quote: string;
}

export type ValueOrigin =
  | { kind: "boundary"; varName: "a0" | "a1"; materialId: string }
  | { kind: "computed"; fromN: number };

export interface SubstitutedVar {
  token: "a1" | "a2";
  label: string;
  value: number;
  origin: ValueOrigin;
}

export interface Step {
  n: number;
  value: number | null;
  numStr: string;
  denStr: string;
  denIsBin: boolean;
  denomValue: number;
  status: StepStatus;
  substituted: SubstitutedVar[];
  causedBy?: { varName: "a0" | "a1"; value: number; materialId: string };
}

export interface QuoteRef {
  materialId: string;
  quote: string;
}

export interface Conclusion {
  id: string;
  key: string;
  title: string;
  text: string;
  severity: Severity;
  materialIds: string[];
  quoteRefs: QuoteRef[];
}

export interface ReviewRun {
  id: string;
  label: string;
  numExpr: string;
  denExpr: string;
  a0: number;
  a1: number;
  a0MaterialId: string;
  a1MaterialId: string;
  steps: number;
  ts: number;
  result: Step[];
}

export interface ReviewPair {
  old: ReviewRun;
  fixed: ReviewRun;
  primary: "old" | "fixed";
  conclusions: Conclusion[];
  ts: number;
}

export interface Judgment {
  factKey: string;
  value: string;
  ts: number;
}

export interface AuditEntry {
  id: string;
  factKey: string;
  prevValue: string;
  nextValue: string;
  reason: string;
  actor: string;
  ts: number;
}

export interface IngestResult {
  duplicated: boolean;
  refId: string;
  submittedId: string;
}
