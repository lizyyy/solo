import type { Experiment, TrainingLog, ParamNote, Summary, Conflict, SelfCheckResult } from '@/types';

export const generateExportReport = (
  experiment: Experiment,
  log: TrainingLog | null,
  note: ParamNote | null,
  summaries: Summary[],
  conflicts: Conflict[],
  selfCheckResult: SelfCheckResult | null
): string => {
  const report = {
    reportTitle: '多目标排序权衡实验 - 导出一致性报告',
    exportTime: new Date().toISOString(),
    experiment: {
      id: experiment.id,
      name: experiment.name,
      status: experiment.status,
      createdAt: experiment.createdAt,
    },
    trainingLog: log ? {
      id: log.id,
      importedAt: log.importedAt,
      hasDefaultScores: log.hasDefaultScores,
      featuresCount: log.features.length,
      missingFeatures: log.features.filter((f) => !f.present).map((f) => ({
        name: f.name,
        defaultValue: f.defaultValue,
      })),
      curveDataSummary: (() => {
        const byMetric: Record<string, { first: number; last: number; count: number }> = {};
        log.curveData.forEach((p) => {
          if (!byMetric[p.metric]) byMetric[p.metric] = { first: p.value, last: p.value, count: 0 };
          byMetric[p.metric].last = p.value;
          byMetric[p.metric].count++;
        });
        return byMetric;
      })(),
    } : null,
    paramNote: note ? {
      id: note.id,
      recordedAt: note.recordedAt,
      thresholds: note.thresholds,
      notesPreview: note.notes.substring(0, 100),
    } : null,
    latestSummary: summaries.length > 0 ? {
      version: summaries[summaries.length - 1].version,
      content: summaries[summaries.length - 1].content,
      metrics: summaries[summaries.length - 1].metrics,
      createdAt: summaries[summaries.length - 1].createdAt,
    } : null,
    summaryVersions: summaries.map((s) => ({
      version: s.version,
      createdAt: s.createdAt,
    })),
    conflicts: conflicts.map((c) => ({
      type: c.type,
      description: c.description,
      status: c.status,
      resolvedBy: c.resolvedBy,
      resolvedAt: c.resolvedAt,
    })),
    selfCheck: selfCheckResult ? Object.fromEntries(
      Object.entries(selfCheckResult).map(([key, val]) => [key, { passed: val.passed, details: val.details }])
    ) : null,
    overallConclusion: selfCheckResult
      ? Object.values(selfCheckResult).every((r) => r.passed)
        ? '所有自检项通过，实验数据完整一致，结论可信'
        : '存在自检未通过项，请关注未通过项详情，必要时请推荐负责人复核'
      : '未执行自检',
  };

  return JSON.stringify(report, null, 2);
};

export const downloadExportReport = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
