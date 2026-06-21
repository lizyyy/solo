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
export type BoundarySeverity = 'zero_boundary' | 'near_zero' | 'div_zero';

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
  updatedAt: number;
  by: string;
  /** 从哪条 run 原样迁来；存在则说明是同一次改判，不计第二份 */
  copiedFromRunId?: string;
  /** 最初发起改判的原始 runId，幂等去重键 */
  originRunId?: string;
}

export interface SupplementaryNote {
  runId: string;
  note: string;
  updatedAt: number;
  /** 从哪条 run 原样迁来 */
  copiedFromRunId?: string;
  /** 最初写后补说明的原始 runId */
  originRunId?: string;
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
  /** 本次重跑时，从上游 run 整体迁来的改判+后补说明的 origin 标识，用于 CSV 去重展示 */
  continuityTag?: string;
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

export type AnomalyKind =
  | 'empty_set'
  | 'zero_boundary'
  | 'pending_review'
  | 'residual'
  | 'div_zero';

export interface AnomalyItem {
  id: string;
  kind: AnomalyKind;
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
