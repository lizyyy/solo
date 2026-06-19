export type RowStatus = "normal" | "boundary" | "withdrawn" | "unit_missing";

export type FormulaType = "linear" | "quadratic" | "exponential";

export type VerdictLevel = "pass" | "warn" | "fail";

export interface UnitTableEntry {
  variable: "x" | "y";
  name: string;
  symbol: string;
  si: string;
}

export interface BoundaryTableEntry {
  variable: "x" | "y";
  min: number;
  max: number;
  tolerancePct: number;
  note?: string;
}

export interface ParamVersion {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  formula: FormulaType;
  note?: string;
  unitTable: UnitTableEntry[];
  boundaryTable: BoundaryTableEntry[];
}

export interface DraftRow {
  id: string;
  seqNo: number;
  studentId: string;
  x: number;
  xUnit?: string | null;
  y: number;
  yUnit?: string | null;
  status: RowStatus;
  withdrawReason?: string | null;
  unitConfirmReason?: string | null;
  unitConfirmScope?: string | null;
  confirmedUnit?: { x?: string; y?: string } | null;
}

export interface FittingIntermediate {
  n: number;
  sumX: number;
  sumY: number;
  sumXY: number;
  sumX2: number;
  sumX3?: number;
  sumX4?: number;
  sumX2Y?: number;
  determinant?: number;
  usedLinearized?: boolean;
}

export interface FittingResultRow {
  rowId: string;
  fittedY: number;
  residual: number;
  deviationPct: number;
  hitBoundary: boolean;
  boundaryDetail?: string;
  usedInFitting: boolean;
}

export interface FittingQuality {
  rSquared: number;
  rmse: number;
  maxDeviationPct: number;
  meanResidual: number;
}

export interface FittingCoefficients {
  a: number;
  b: number;
  c?: number;
  formula: FormulaType;
}

export interface FittingOutput {
  coefficients: FittingCoefficients;
  intermediate: FittingIntermediate;
  quality: FittingQuality;
  perRow: FittingResultRow[];
  scatter: { x: number; y: number; fitted: number; label: string }[];
}

export interface ExceptionGroup {
  type: "withdrawn" | "unit_missing" | "boundary" | "high_deviation";
  label: string;
  count: number;
  rowIds: string[];
}

export interface SummarySnapshot {
  sessionId: string;
  coachName: string;
  auditedAt: string;
  paramVersionId: string;
  paramVersionName: string;
  totalRows: number;
  validRows: number;
  withdrawnRows: number;
  boundaryRows: number;
  missingUnitRows: number;
  highDeviationRows: number;
  formulaLabel: string;
  rSquared: number;
  rmse: number;
  verdictLevel: VerdictLevel;
  verdictText: string;
  boundaryNote: string;
  unitNote: string;
  exceptionNote: string;
  handoffNotes: string[];
  hash: string;
}

export interface FittingSession {
  id: string;
  coachName: string;
  createdAt: string;
  title: string;
}
