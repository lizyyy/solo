import type {
  BoundarySeverity,
  HistoricalAnswer,
  ManualOverride,
  ReplayRequest,
  ReplayResult,
  RunRecord,
  RunStatus,
  SupplementaryNote,
} from '@/types';
import { fingerprint } from './fingerprint';
import { runDecomposition, validate, type ValidationResult } from './validator';

let counter = 0;
export function genRunId(fp: string): string {
  counter += 1;
  return `run-${fp.slice(0, 6)}-${counter.toString(36)}`;
}

export function computeBaseStatus(
  validation: ValidationResult,
  boundaries: { severity: BoundarySeverity }[],
): RunStatus {
  if (validation.verified) return 'pass';
  if (validation.emptySetFlag === 'EMPTY_ANOMALY') return 'pending_review';
  if (
    boundaries.some((b) => b.severity === 'zero_boundary' || b.severity === 'div_zero')
  )
    return 'pending_review';
  return 'fail';
}

export function finalStatus(base: RunStatus, overridden: boolean): RunStatus {
  return overridden ? 'override' : base;
}

export interface BuiltReplay {
  result: ReplayResult;
  run: RunRecord;
  validation: ValidationResult;
}

export function buildReplay(
  req: ReplayRequest,
  historical: HistoricalAnswer | undefined,
  opts?: { runId?: string; createdAt?: number; note?: string; rerunOf?: string; csvToken?: string },
): BuiltReplay {
  const fp = fingerprint(req);
  const out = runDecomposition(req);
  const validation = validate(out, req, historical);
  const runId = opts?.runId ?? genRunId(fp);
  const createdAt = opts?.createdAt ?? Date.now();

  const result: ReplayResult = {
    runId,
    fingerprint: fp,
    matrixId: req.matrixId,
    method: req.method,
    factors: out.factors,
    residual: validation.residual,
    reconError: out.reconError,
    verified: validation.verified,
    emptySetFlag: validation.emptySetFlag,
    boundaries: out.boundaries,
    sourceLines: out.sourceLines,
    tolerance: req.tolerance,
    createdAt,
  };

  const base = computeBaseStatus(validation, out.boundaries);
  const run: RunRecord = {
    runId,
    fingerprint: fp,
    matrixId: req.matrixId,
    status: finalStatus(base, false),
    note: opts?.note ?? '',
    csvToken: opts?.csvToken ?? `csv-${runId}`,
    createdAt,
    rerunOf: opts?.rerunOf,
  };

  return { result, run, validation };
}

export function csvRowsForResult(
  result: ReplayResult,
  run: RunRecord,
  historical: HistoricalAnswer | undefined,
  override: ManualOverride | undefined,
  note: SupplementaryNote | undefined,
): (string | number)[][] {
  const overrideOrigin = override?.originRunId ?? override?.runId ?? '—';
  const overrideLabel = override
    ? override.copiedFromRunId
      ? `${override.reason}  [同一次改判，origin=${overrideOrigin}]`
      : override.reason
    : '—';
  const noteLabel = note
    ? note.copiedFromRunId
      ? `${note.note}  [同一份后补，origin=${note.originRunId ?? note.runId}]`
      : note.note
    : '—';

  const header = [
    'runId',
    'continuityTag',
    'rerunOf',
    'fingerprint',
    '类别',
    '位置',
    '影响范围行',
    '影响范围列',
    '来源行',
    '来源文件',
    '严重度',
    '数值',
    '说明',
    '状态',
    '运行备注',
    '改判理由(幂等去重)',
    '改判人',
    '改判时间',
    '后补说明(幂等去重)',
  ];
  const rows: (string | number)[][] = [header];
  rows.push([
    run.runId,
    run.continuityTag ?? '—',
    run.rerunOf ?? '—',
    run.fingerprint,
    '汇总',
    '—',
    '—',
    '—',
    result.sourceLines.join(';'),
    'src/lib/decompose.ts',
    '—',
    result.reconError.toExponential(2),
    historical?.label ?? '—',
    run.status,
    run.note || '—',
    overrideLabel,
    override?.by ?? '—',
    override ? new Date(override.updatedAt).toISOString() : '—',
    noteLabel,
  ]);
  for (const b of result.boundaries) {
    rows.push([
      run.runId,
      run.continuityTag ?? '—',
      run.rerunOf ?? '—',
      run.fingerprint,
      '除零边界',
      `(${b.position.row + 1},${b.position.col + 1})`,
      b.impactRange.rows.map((r) => r + 1).join(';'),
      b.impactRange.cols.map((c) => c + 1).join(';'),
      b.sourceLine,
      b.sourceFile,
      b.severity,
      b.pivotValue.toExponential(2),
      b.message,
      run.status,
      run.note || '—',
      overrideLabel,
      override?.by ?? '—',
      override ? new Date(override.updatedAt).toISOString() : '—',
      noteLabel,
    ]);
  }
  const traces = historical?.traces ?? [];
  for (const t of traces) {
    rows.push([
      run.runId,
      run.continuityTag ?? '—',
      run.rerunOf ?? '—',
      run.fingerprint,
      '现场痕迹',
      t.label,
      '—',
      '—',
      historical?.sourceLine ?? '—',
      'src/lib/seed.ts',
      '—',
      t.value,
      `${run.status} / 改判:${override ? '是' : '否'}`,
      '—',
      '—',
      overrideLabel,
      override?.by ?? '—',
      override ? new Date(override.updatedAt).toISOString() : '—',
      noteLabel,
    ]);
  }
  return rows;
}
