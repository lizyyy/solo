import type { SampleBottle, AbnormalRecord, SeaReport } from '@/types';
import { generateId } from './storage';

const STANDARD_UNITS = ['m', 'cm', 'mm', '米', '厘米', '毫米'];

export function detectTideUnitMixed(
  report: SeaReport,
  bottles: SampleBottle[]
): AbnormalRecord | null {
  const allUnits = new Set<string>();
  allUnits.add(report.tideUnit);
  bottles.forEach((b) => {
    if (b.resultUnit) {
      allUnits.add(b.resultUnit);
    }
  });

  const normalizedUnits = new Set<string>();
  allUnits.forEach((u) => {
    const lower = u.toLowerCase().trim();
    if (lower === 'm' || lower === '米') {
      normalizedUnits.add('m');
    } else if (lower === 'cm' || lower === '厘米') {
      normalizedUnits.add('cm');
    } else if (lower === 'mm' || lower === '毫米') {
      normalizedUnits.add('mm');
    } else {
      normalizedUnits.add(lower);
    }
  });

  if (normalizedUnits.size > 1) {
    return {
      id: generateId(),
      reportId: report.id,
      abnormalType: 'tide_unit_mixed',
      description: `潮位单位混写：检测到 ${normalizedUnits.size} 种不同单位（${Array.from(allUnits).join('、')}）`,
      severity: 'high',
      status: 'pending',
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

export function detectResultTimeMismatch(
  report: SeaReport,
  bottles: SampleBottle[]
): AbnormalRecord[] {
  const abnormals: AbnormalRecord[] = [];
  const reportTime = new Date(report.samplingTime).getTime();

  bottles.forEach((bottle) => {
    const bottleTime = new Date(bottle.sampledAt).getTime();
    const diffHours = Math.abs(reportTime - bottleTime) / (1000 * 60 * 60);

    if (diffHours > 24) {
      abnormals.push({
        id: generateId(),
        reportId: report.id,
        bottleId: bottle.id,
        abnormalType: 'time_mismatch',
        description: `采样瓶 ${bottle.bottleNo} 采样时间与报告采样时间相差 ${diffHours.toFixed(1)} 小时`,
        severity: 'medium',
        status: 'pending',
        detectedAt: new Date().toISOString(),
      });
    }
  });

  return abnormals;
}

export function detectAllAbnormals(
  report: SeaReport,
  bottles: SampleBottle[]
): AbnormalRecord[] {
  const abnormals: AbnormalRecord[] = [];

  const tideUnitAbnormal = detectTideUnitMixed(report, bottles);
  if (tideUnitAbnormal) {
    abnormals.push(tideUnitAbnormal);
  }

  const timeMismatches = detectResultTimeMismatch(report, bottles);
  abnormals.push(...timeMismatches);

  return abnormals;
}

export const abnormalTypeLabels: Record<string, string> = {
  tide_unit_mixed: '潮位单位混写',
  result_mismatch: '实验结果不符',
  time_mismatch: '采样时间不符',
  other: '其他异常',
};

export const abnormalSeverityLabels: Record<string, string> = {
  high: '严重',
  medium: '中等',
  low: '轻微',
};

export const abnormalStatusLabels: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
};

export function isStandardUnit(unit: string): boolean {
  return STANDARD_UNITS.some(
    (u) => u.toLowerCase() === unit.toLowerCase().trim()
  );
}
