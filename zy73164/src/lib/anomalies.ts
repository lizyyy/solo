import type { AnomalyItem, ReplayResult, RunRecord } from '@/types';

export function computeAnomalies(input: {
  runs: RunRecord[];
  results: Record<string, ReplayResult>;
}): AnomalyItem[] {
  const { runs, results } = input;
  const items: AnomalyItem[] = [];
  for (const run of runs) {
    const result = results[run.runId];
    if (!result) continue;
    if (result.emptySetFlag === 'EMPTY_ANOMALY') {
      items.push({
        id: `anm-empty-${run.runId}`,
        kind: 'empty_set',
        severity: 'high',
        runId: run.runId,
        matrixId: run.matrixId,
        title: '空集合历史答案',
        detail: '历史答案为空集合，曾被当正常输入；已拦截为异常，需改判或补材料。',
        sourceLine: 81,
        sourceFile: 'src/lib/validator.ts',
        createdAt: run.createdAt,
      });
    }
    for (const b of result.boundaries) {
      items.push({
        id: `anm-bnd-${b.id}`,
        kind: 'div_zero',
        severity: b.severity === 'div_zero' ? 'high' : 'medium',
        runId: run.runId,
        matrixId: run.matrixId,
        title: `${b.severity === 'div_zero' ? '除零' : '近零'}边界 · ${b.step}`,
        detail: b.message,
        sourceLine: b.sourceLine,
        sourceFile: b.sourceFile,
        createdAt: run.createdAt,
      });
    }
    if (run.status === 'pending_review') {
      items.push({
        id: `anm-pr-${run.runId}`,
        kind: 'pending_review',
        severity: 'medium',
        runId: run.runId,
        matrixId: run.matrixId,
        title: '改判待复核',
        detail: '该回放未通过且未改判，等待人工复核。',
        createdAt: run.createdAt,
      });
    }
    if (
      !result.verified &&
      run.status !== 'override' &&
      result.emptySetFlag !== 'EMPTY_ANOMALY'
    ) {
      items.push({
        id: `anm-res-${run.runId}`,
        kind: 'residual',
        severity: 'low',
        runId: run.runId,
        matrixId: run.matrixId,
        title: '误差超阈',
        detail: `重建误差 ${result.reconError.toExponential(2)} 超过容差 ${result.tolerance}。`,
        createdAt: run.createdAt,
      });
    }
  }
  return items;
}
