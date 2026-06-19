export type DecomposeMethod = 'LU' | 'QR' | 'CHOLESKY';
export type PivotStrategy = 'partial' | 'none';

export interface ReplayRequest {
  matrixId: string;
  matrix: number[][];
  method: DecomposeMethod;
  pivot: PivotStrategy;
  tolerance: number;
}

export type EmptySetFlag = 'EMPTY_ANOMALY' | 'NORMAL_EMPTY' | 'NONE';
export type RunStatus = 'pass' | 'fail' | 'override' | 'pending_review';
export type BoundarySeverity = 'div_zero' | 'near_zero';

export interface BoundaryEvent {
  id: string;
  step: string;
  position: { row: number; col: number };
  pivotValue: number;
  impactRange: { rows: number[]; cols: number[] };
  sourceLine: number;
  sourceFile: string;
  severity: BoundarySeverity;
  message: string;
}

export interface Factors {
  L?: number[][];
  U?: number[][];
  Q?: number[][];
  R?: number[][];
  P?: number[];
}

export interface ReplayResult {
  runId: string;
  fingerprint: string;
  matrixId: string;
  method: DecomposeMethod;
  factors: Factors;
  residual: number;
  reconError: number;
  verified: boolean;
  emptySetFlag: EmptySetFlag;
  boundaries: BoundaryEvent[];
  sourceLines: number[];
  tolerance: number;
  createdAt: number;
}

export interface ManualOverride {
  runId: string;
  reason: string;
  overriddenAt: number;
  by: string;
}

export interface SupplementaryNote {
  runId: string;
  note: string;
  updatedAt: number;
}

export interface RunRecord {
  runId: string;
  fingerprint: string;
  matrixId: string;
  status: RunStatus;
  note: string;
  csvToken: string;
  createdAt: number;
  rerunOf?: string;
}

export interface TraceChip {
  label: string;
  value: string;
}

export interface HistoricalAnswer {
  id: string;
  matrixId: string;
  label: string;
  matrix: number[][];
  expectedU?: number[][];
  method: DecomposeMethod;
  emptySet: boolean;
  traces: TraceChip[];
  sourceLine: number;
  createdAt: number;
}

export interface AnomalyItem {
  id: string;
  kind: 'empty_set' | 'div_zero' | 'pending_review' | 'residual';
  severity: 'high' | 'medium' | 'low';
  runId?: string;
  matrixId?: string;
  title: string;
  detail: string;
  sourceLine?: number;
  sourceFile?: string;
  createdAt: number;
}

export interface ReplayOutcome {
  result: ReplayResult;
  run: RunRecord;
  hit: boolean;
}
