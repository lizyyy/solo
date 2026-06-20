export type GroupId = "A" | "B";

export type ParamStatus = "ok" | "unit_missing" | "blocked" | "out_of_range";

export interface ParamSpec {
  key: string;
  canonicalName: string;
  canonicalUnit: string;
  dimensionless: boolean;
  unitOptions: string[];
  boundary?: { min: number; max: number };
}

export interface Param {
  key: string;
  canonicalName: string;
  rawFieldName: string;
  value: string;
  unit: string;
  status: ParamStatus;
  note?: string;
}

export interface ParamSet {
  id: GroupId;
  label: string;
  source: string;
  params: Param[];
}

export type CalcStepType = "substitute" | "convert" | "compute" | "boundary";

export interface CalcStep {
  order: number;
  type: CalcStepType;
  group: GroupId;
  detail: string;
  before: string;
  after: string;
  unit: string;
}

export interface BoundaryCheck {
  name: string;
  value: number;
  min: number;
  max: number;
  ok: boolean;
  unit: string;
}

export interface GroupResult {
  group: GroupId;
  steps: CalcStep[];
  boundaries: BoundaryCheck[];
  finalValue: number | null;
  finalUnit: string;
  blocked: boolean;
  blockReason?: string;
}

export type ResultStatus = "pass" | "warn" | "blocked";

export interface AttributionResult {
  status: ResultStatus;
  blockReason?: string;
  groups: { A: GroupResult; B: GroupResult };
  delta: number | null;
  deltaPct: number | null;
  markdown: string;
  ts: number;
}

export interface Diff {
  path: string;
  before: string;
  after: string;
}

export interface Snapshot {
  setA: ParamSet;
  setB: ParamSet;
  result: AttributionResult;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  setA: ParamSet;
  setB: ParamSet;
  result: AttributionResult;
  confirmed: boolean;
  confirmedAt?: number;
  preConfirmSnapshot?: Snapshot;
  diffs: Diff[];
  grayscaleNote?: string;
}

export interface ExceptionRecord {
  id: string;
  ts: number;
  group: GroupId;
  paramKey: string;
  paramName: string;
  reason: string;
  source: string;
  resultStatus: ResultStatus;
}

export type SampleTag = "normal" | "unit_missing" | "out_of_range";

export interface Sample {
  id: string;
  name: string;
  tag: SampleTag;
  description: string;
  setA: ParamSet;
  setB: ParamSet;
}
