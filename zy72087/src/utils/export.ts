import type { HistoricalSample, ReasoningChain, QualityIssue, ManualReview } from '@/types';
import { formatInterval, toSeconds } from '@/engine/validator';

export function exportReportCSV(
  samples: HistoricalSample[],
  chains: ReasoningChain[],
  issues: QualityIssue[],
  reviews: ManualReview[],
  caliberLabel: string
): string {
  const BOM = '\uFEFF';
  const rows: string[] = [];

  rows.push(`公交发车间隔优化报告`);
  rows.push(`导出时间,${new Date().toLocaleString('zh-CN')}`);
  rows.push(`当前口径,${caliberLabel}`);
  rows.push(``);

  rows.push(`=== 数据质量总览 ===`);
  const issueTypes = ['null_value', 'duplicate', 'out_of_bounds', 'unit_mismatch', 'weight_unclosed'] as const;
  const typeLabels: Record<string, string> = {
    null_value: '空值',
    duplicate: '重复项',
    out_of_bounds: '越界',
    unit_mismatch: '单位不一致',
    weight_unclosed: '权重未闭合',
  };
  for (const t of issueTypes) {
    const count = issues.filter((i) => i.type === t).length;
    rows.push(`${typeLabels[t]},${count}条`);
  }
  rows.push(``);

  rows.push(`=== 逐条优化建议 ===`);
  rows.push(`样本ID,线路,日期,时段,实际间隔,建议,建议原因,判断等级,需人工确认,人工审核状态`);

  for (const chain of chains) {
    const sample = samples.find((s) => s.id === chain.sampleId);
    if (!sample) continue;
    const review = reviews.find((r) => r.sampleId === chain.sampleId);
    const interval = sample.actualInterval !== null
      ? formatInterval(toSeconds(sample.actualInterval, sample.actualIntervalUnit))
      : '空值';
    const reviewStatus = review ? (review.action === 'approved' ? '通过' : review.action === 'rejected' ? '驳回' : '待定') : '未审核';
    rows.push([
      sample.id,
      sample.lineName,
      sample.date,
      sample.timePeriod,
      interval,
      chain.finalSuggestion,
      `"${chain.suggestionReason}"`,
      chain.level === 'pass' ? '通过' : chain.level === 'warn' ? '需确认' : '越界驳回',
      chain.needsManualReview ? '是' : '否',
      reviewStatus,
    ].join(','));
  }
  rows.push(``);

  rows.push(`=== 推理链明细 ===`);
  rows.push(`样本ID,步骤类型,描述,引用参数,计算值,比对阈值,结论`);
  for (const chain of chains) {
    for (const step of chain.steps) {
      rows.push([
        chain.sampleId,
        step.stepType,
        `"${step.description}"`,
        step.parameterReferenced,
        step.calculatedValue !== null ? step.calculatedValue.toFixed(2) : '',
        step.thresholdCompared,
        `"${step.conclusion}"`,
      ].join(','));
    }
  }

  return BOM + rows.join('\n');
}

export function exportDetailCSV(
  samples: HistoricalSample[],
  chains: ReasoningChain[],
  issues: QualityIssue[],
  caliberLabel: string
): string {
  const BOM = '\uFEFF';
  const rows: string[] = [];

  rows.push(`公交发车间隔优化明细`);
  rows.push(`导出时间,${new Date().toLocaleString('zh-CN')}`);
  rows.push(`当前口径,${caliberLabel}`);
  rows.push(``);

  rows.push(`样本ID,线路,日期,时段,实际间隔(秒),客流量,单趟成本,准点率,来源,备注,口径,是否越界,数据质量问题`);
  for (const s of samples) {
    const sampleIssues = issues.filter((i) => i.sampleIds.includes(s.id));
    const issueDesc = sampleIssues.map((i) => i.message).join('；');
    const intervalSec = s.actualInterval !== null ? toSeconds(s.actualInterval, s.actualIntervalUnit) : '';
    rows.push([
      s.id,
      s.lineName,
      s.date,
      s.timePeriod,
      intervalSec,
      s.passengerCount ?? '',
      s.costPerTrip ?? '',
      s.onTimeRate !== null ? s.onTimeRate : '',
      s.source,
      `"${s.remarks}"`,
      s.caliberTag,
      s.isOutlier ? '是' : '否',
      `"${issueDesc}"`,
    ].join(','));
  }

  return BOM + rows.join('\n');
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
