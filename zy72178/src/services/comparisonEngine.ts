import { getFromStore, getFromIndex } from '../db';
import type {
  CheckupRun,
  SampleResult,
  MetricComparison,
  SampleDifference,
  ConflictItem,
  Sample,
  JudgmentType,
  ComparisonResult,
} from '../types';

export async function compareRuns(runId1: string, runId2: string, runs: CheckupRun[]): Promise<ComparisonResult> {
  const run1 = runs.find(r => r.id === runId1);
  const run2 = runs.find(r => r.id === runId2);
  
  if (!run1 || !run2) {
    throw new Error('找不到指定的体检记录');
  }

  const metricChanges = {
    accuracy: (run2.metrics.accuracy as number) - (run1.metrics.accuracy as number),
    precision: (run2.metrics.precision as number) - (run1.metrics.precision as number),
    recall: (run2.metrics.recall as number) - (run1.metrics.recall as number),
    f1: (run2.metrics.f1 as number) - (run1.metrics.f1 as number),
  };

  const sampleDifferences = await findDifferences([runId1, runId2]);

  return {
    run1,
    run2,
    metricChanges,
    sampleDifferences,
  };
}

export async function getConflicts(runId1: string, runId2: string): Promise<ConflictItem[]> {
  const differences = await findDifferences([runId1, runId2]);
  
  const conflicts: ConflictItem[] = differences.map(diff => {
    const diff1 = diff.differences.find(d => d.runId === runId1);
    const diff2 = diff.differences.find(d => d.runId === runId2);
    
    return {
      sampleResultId: `${runId2}-${diff.sampleId}`,
      sampleId: diff.sampleId,
      question: diff.question,
      runId1,
      runId2,
      judgment1: diff1?.judgment || 'unverified',
      judgment2: diff2?.judgment || 'unverified',
      confidence1: diff1?.confidence,
      confidence2: diff2?.confidence,
      type: 'judgment_change',
      description: `判定从 ${diff1?.judgment} 变为 ${diff2?.judgment}`,
      evidences: [],
      createdAt: new Date().toISOString(),
      resolved: false,
      modelJudgment: diff1?.judgment || 'unverified',
      manualJudgment: diff2?.judgment || 'unverified',
      reason: '',
    };
  });

  return conflicts;
}

export async function getAllConflicts(): Promise<ConflictItem[]> {
  const runs = await getFromIndex('checkupRuns', 'by-createdAt', null);
  const sortedRuns = runs
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (sortedRuns.length < 2) return [];

  const allConflicts: ConflictItem[] = [];
  
  for (let i = 0; i < sortedRuns.length - 1; i++) {
    const run1 = sortedRuns[i + 1];
    const run2 = sortedRuns[i];
    const conflicts = await getConflicts(run1.id, run2.id);
    allConflicts.push(...conflicts);
  }

  const manualConflicts = await generateConflictList();
  allConflicts.push(...manualConflicts.map(mc => ({
    ...mc,
    runId1: mc.sampleResultId,
    runId2: mc.sampleResultId,
    type: 'manual_override' as string,
    judgment1: mc.modelJudgment,
    judgment2: mc.manualJudgment,
    resolved: false,
  })));

  return allConflicts;
}

export async function compareMetrics(runIds: string[]): Promise<MetricComparison> {
  const runs: CheckupRun[] = [];
  for (const runId of runIds) {
    const run = await getFromStore('checkupRuns', runId);
    if (run) runs.push(run);
  }

  if (runs.length === 0) {
    return { metrics: [] };
  }

  const metricNames: { key: keyof CheckupRun['metrics']; name: string }[] = [
    { key: 'accuracy', name: '准确率' },
    { key: 'precision', name: '精确率' },
    { key: 'recall', name: '召回率' },
    { key: 'f1', name: 'F1分数' },
    { key: 'manualOverrideRate', name: '人工改判率' },
  ];

  const metrics: MetricComparison['metrics'] = metricNames.map(({ key, name }) => ({
    name,
    values: runs.map((run, idx) => {
      const value = run.metrics[key] as number;
      let change: number | undefined;
      if (idx > 0) {
        const prevValue = runs[idx - 1].metrics[key] as number;
        change = Math.round((value - prevValue) * 10000) / 10000;
      }
      return {
        runId: run.id,
        value,
        change,
      };
    }),
  }));

  return { metrics };
}

export async function findDifferences(runIds: string[]): Promise<SampleDifference[]> {
  if (runIds.length < 2) {
    return [];
  }

  const allResultsMap = new Map<string, { runId: string; result: SampleResult }[]>();

  for (const runId of runIds) {
    const results = await getFromIndex('sampleResults', 'by-checkupRunId', IDBKeyRange.only(runId));
    for (const result of results) {
      if (!allResultsMap.has(result.sampleId)) {
        allResultsMap.set(result.sampleId, []);
      }
      allResultsMap.get(result.sampleId)!.push({ runId, result });
    }
  }

  const differences: SampleDifference[] = [];

  for (const [sampleId, runResults] of allResultsMap) {
    if (runResults.length < 2) continue;

    const judgments = new Set(runResults.map(r => r.result.judgment));
    const confidences = runResults.map(r => r.result.confidence);
    const confDiff = Math.max(...confidences) - Math.min(...confidences);

    if (judgments.size > 1 || confDiff > 0.1) {
      const sample = await getFromStore('samples', sampleId);
      differences.push({
        sampleId,
        question: sample?.question || '未知问题',
        differences: runResults.map(r => ({
          runId: r.runId,
          judgment: r.result.judgment,
          confidence: r.result.confidence,
        })),
      });
    }
  }

  return differences;
}

export async function generateConflictList(runId?: string): Promise<ConflictItem[]> {
  let results: SampleResult[];
  
  if (runId) {
    results = await getFromIndex('sampleResults', 'by-checkupRunId', IDBKeyRange.only(runId));
  } else {
    results = await getFromIndex('sampleResults', 'by-checkupRunId', null);
  }

  const conflicts: ConflictItem[] = [];

  for (const result of results) {
    if (result.manualJudgment && result.manualJudgment.originalJudgment !== result.manualJudgment.newJudgment) {
      const sample = await getFromStore('samples', result.sampleId);
      conflicts.push({
        sampleResultId: result.id,
        sampleId: result.sampleId,
        question: sample?.question || '未知问题',
        runId1: result.checkupRunId,
        runId2: result.checkupRunId,
        judgment1: result.manualJudgment.originalJudgment,
        judgment2: result.manualJudgment.newJudgment,
        confidence1: result.confidence,
        confidence2: result.confidence,
        type: 'manual_override',
        description: `人工改判: ${result.manualJudgment.reason}`,
        evidences: result.evidences,
        createdAt: result.manualJudgment.createdAt,
        resolved: false,
        modelJudgment: result.manualJudgment.originalJudgment,
        manualJudgment: result.manualJudgment.newJudgment,
        reason: result.manualJudgment.reason,
      });
    }
  }

  return conflicts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getMetricsTrend(limit: number = 5): Promise<{
  runs: { id: string; name: string; version: string; date: string }[];
  metrics: { name: string; values: number[] }[];
}> {
  const runs = await getFromIndex('checkupRuns', 'by-createdAt', null);
  const sortedRuns = runs
    .filter(r => r.status === 'completed')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(-limit);

  const runInfos = await Promise.all(
    sortedRuns.map(async run => {
      const mv = await getFromStore('modelVersions', run.modelVersionId);
      return {
        id: run.id,
        name: run.name,
        version: mv?.version || '未知',
        date: run.startedAt,
      };
    })
  );

  const metricKeys: { key: keyof CheckupRun['metrics']; name: string }[] = [
    { key: 'accuracy', name: '准确率' },
    { key: 'precision', name: '精确率' },
    { key: 'recall', name: '召回率' },
    { key: 'f1', name: 'F1分数' },
  ];

  const metrics = metricKeys.map(({ key, name }) => ({
    name,
    values: sortedRuns.map(r => r.metrics[key] as number),
  }));

  return { runs: runInfos, metrics };
}

export function getJudgmentLabel(judgment: JudgmentType): string {
  const labels: Record<JudgmentType, string> = {
    correct: '正确',
    incorrect: '错误',
    partial: '部分正确',
    unverified: '未验证',
  };
  return labels[judgment];
}

export function getJudgmentColor(judgment: JudgmentType): string {
  const colors: Record<JudgmentType, string> = {
    correct: 'text-accent-emerald-600 bg-accent-emerald-50',
    incorrect: 'text-accent-rose-600 bg-accent-rose-50',
    partial: 'text-accent-amber-600 bg-accent-amber-50',
    unverified: 'text-slate-600 bg-slate-100',
  };
  return colors[judgment];
}
