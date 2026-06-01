import type { HistoricalSample, ParamConfig, QualityIssue, IssueType } from '@/types';

const NULLABLE_FIELDS: (keyof HistoricalSample)[] = [
  'actualInterval',
  'passengerCount',
  'costPerTrip',
  'onTimeRate',
];

function checkNullValues(samples: HistoricalSample[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const s of samples) {
    const nullFields: string[] = [];
    for (const f of NULLABLE_FIELDS) {
      if (s[f] === null || s[f] === undefined) {
        nullFields.push(f);
      }
    }
    if (nullFields.length > 0) {
      issues.push({
        type: 'null_value',
        sampleIds: [s.id],
        message: `样本 ${s.id}（${s.lineName} ${s.date}）存在空值字段：${nullFields.join('、')}。该记录将无法参与完整优化计算，建议补全或标记排除。`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkDuplicates(samples: HistoricalSample[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const seen = new Map<string, string[]>();
  for (const s of samples) {
    const key = `${s.lineId}_${s.date}_${s.timePeriod}_${s.actualInterval}_${s.passengerCount}`;
    const existing = seen.get(key);
    if (existing) {
      existing.push(s.id);
    } else {
      seen.set(key, [s.id]);
    }
  }
  for (const [, ids] of seen) {
    if (ids.length > 1) {
      issues.push({
        type: 'duplicate',
        sampleIds: ids,
        message: `样本 ${ids.join('、')} 的线路/日期/时段/间隔/客流完全一致，疑似重复录入。去重时保留首条，其余标记为重复。`,
        severity: 'warning',
      });
    }
  }
  return issues;
}

function checkOutOfBounds(
  samples: HistoricalSample[],
  configs: ParamConfig[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const s of samples) {
    if (s.actualInterval === null) continue;
    const intervalSec = s.actualIntervalUnit === 'min' ? s.actualInterval * 60 : s.actualInterval;
    const cfg = configs.find(
      (c) => c.lineId === s.lineId && c.timePeriod === s.timePeriod && c.caliberTag === s.caliberTag
    );
    if (!cfg) continue;
    if (intervalSec > cfg.maxIntervalSec) {
      issues.push({
        type: 'out_of_bounds',
        sampleIds: [s.id],
        message: `样本 ${s.id}（${s.lineName} ${s.date}）实际间隔 ${formatInterval(intervalSec)} 超出上限 ${formatInterval(cfg.maxIntervalSec)}，越界 ${formatInterval(intervalSec - cfg.maxIntervalSec)}。建议人工核实并决定是否排除。`,
        severity: 'error',
      });
    } else if (intervalSec === cfg.maxIntervalSec) {
      issues.push({
        type: 'out_of_bounds',
        sampleIds: [s.id],
        message: `样本 ${s.id}（${s.lineName} ${s.date}）实际间隔 ${formatInterval(intervalSec)} 刚好卡在上限边界，属于临界状态。优化计算时将按边界处理。`,
        severity: 'info',
      });
    }
  }
  return issues;
}

function checkUnitMismatch(
  samples: HistoricalSample[],
  configs: ParamConfig[]
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const s of samples) {
    const cfg = configs.find(
      (c) => c.lineId === s.lineId && c.timePeriod === s.timePeriod && c.caliberTag === s.caliberTag
    );
    if (!cfg) continue;
    if (s.actualIntervalUnit !== cfg.unit) {
      issues.push({
        type: 'unit_mismatch',
        sampleIds: [s.id],
        message: `样本 ${s.id} 间隔单位为"${unitLabel(s.actualIntervalUnit)}"，对应参数配置单位为"${unitLabel(cfg.unit)}"。系统已自动换算为秒进行计算，但建议统一录入单位。`,
        severity: 'info',
      });
    }
  }
  return issues;
}

function checkWeightClosure(configs: ParamConfig[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  for (const c of configs) {
    const sum = c.weightPassenger + c.weightCost + c.weightReliability;
    if (Math.abs(sum - 1.0) > 0.01) {
      issues.push({
        type: 'weight_unclosed',
        sampleIds: [c.id],
        message: `参数配置 ${c.id}（${c.lineName} ${c.timePeriod} 口径${c.caliberTag}）权重之和为 ${sum.toFixed(2)}，不等于1.00。客流=${c.weightPassenger}、成本=${c.weightCost}、准点=${c.weightReliability}。需调整权重使三者闭合。`,
        severity: 'error',
      });
    }
  }
  return issues;
}

export function formatInterval(sec: number): string {
  if (sec >= 60 && sec % 60 === 0) {
    return `${sec / 60}分钟`;
  }
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}分${sec % 60}秒`;
  }
  return `${sec}秒`;
}

function unitLabel(u: 'sec' | 'min'): string {
  return u === 'sec' ? '秒' : '分钟';
}

export function toSeconds(value: number, unit: 'sec' | 'min'): number {
  return unit === 'min' ? value * 60 : value;
}

export function validateData(
  samples: HistoricalSample[],
  configs: ParamConfig[]
): QualityIssue[] {
  return [
    ...checkNullValues(samples),
    ...checkDuplicates(samples),
    ...checkOutOfBounds(samples, configs),
    ...checkUnitMismatch(samples, configs),
    ...checkWeightClosure(configs),
  ];
}

export function getIssueSummary(issues: QualityIssue[]): Record<IssueType, number> {
  const summary: Record<IssueType, number> = {
    null_value: 0,
    duplicate: 0,
    out_of_bounds: 0,
    unit_mismatch: 0,
    weight_unclosed: 0,
  };
  for (const issue of issues) {
    summary[issue.type] += issue.sampleIds.length;
  }
  return summary;
}

export function getSampleIssues(
  sampleId: string,
  issues: QualityIssue[]
): QualityIssue[] {
  return issues.filter((i) => i.sampleIds.includes(sampleId));
}

export function isDuplicate(
  sampleId: string,
  issues: QualityIssue[]
): boolean {
  return issues.some((i) => i.type === 'duplicate' && i.sampleIds.length > 1 && i.sampleIds.indexOf(sampleId) > 0);
}
