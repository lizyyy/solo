import type { SampleBottle, AbnormalRecord, SeaReport, ChangeLog } from '@/types';
import { generateId } from './storage';

const STANDARD_TIDE_UNITS = ['m', 'cm', 'mm', '米', '厘米', '毫米'];

function normalizeTideUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  if (lower === 'm' || lower === '米') return 'm';
  if (lower === 'cm' || lower === '厘米') return 'cm';
  if (lower === 'mm' || lower === '毫米') return 'mm';
  return lower;
}

export function detectTideUnitMixed(
  report: SeaReport,
  _bottles: SampleBottle[],
  changeLogs: ChangeLog[] = []
): AbnormalRecord | null {
  const tideUnit = report.tideUnit?.trim() || '';

  if (!tideUnit) {
    return {
      id: generateId(),
      reportId: report.id,
      abnormalType: 'tide_unit_mixed',
      description: '潮位单位为空，请补充填写',
      severity: 'high',
      status: 'pending',
      detectedAt: new Date().toISOString(),
    };
  }

  const isStandard = STANDARD_TIDE_UNITS.some(
    (u) => u.toLowerCase() === tideUnit.toLowerCase()
  );
  if (!isStandard) {
    return {
      id: generateId(),
      reportId: report.id,
      abnormalType: 'tide_unit_mixed',
      description: `潮位单位"${tideUnit}"不是标准单位，请使用 m/cm/mm 或 米/厘米/毫米`,
      severity: 'high',
      status: 'pending',
      detectedAt: new Date().toISOString(),
    };
  }

  const tideUnitChanges = changeLogs.filter((log) => log.fieldName === 'tideUnit');
  if (tideUnitChanges.length > 0) {
    const allUsedUnits = new Set<string>();
    tideUnitChanges.forEach((log) => {
      if (log.oldValue) allUsedUnits.add(normalizeTideUnit(log.oldValue));
      if (log.newValue) allUsedUnits.add(normalizeTideUnit(log.newValue));
    });
    allUsedUnits.add(normalizeTideUnit(tideUnit));

    if (allUsedUnits.size > 1) {
      const displayUnits = Array.from(
        new Set([
          ...tideUnitChanges.map((l) => l.oldValue),
          ...tideUnitChanges.map((l) => l.newValue),
          tideUnit,
        ])
      ).filter(Boolean);
      return {
        id: generateId(),
        reportId: report.id,
        abnormalType: 'tide_unit_mixed',
        description: `潮位单位混用：历史记录中出现过 ${displayUnits.join('、')} 等多种单位，请统一`,
        severity: 'high',
        status: 'pending',
        detectedAt: new Date().toISOString(),
      };
    }
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
  bottles: SampleBottle[],
  changeLogs: ChangeLog[] = []
): AbnormalRecord[] {
  const abnormals: AbnormalRecord[] = [];

  const tideUnitAbnormal = detectTideUnitMixed(report, bottles, changeLogs);
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
  return STANDARD_TIDE_UNITS.some(
    (u) => u.toLowerCase() === unit.toLowerCase().trim()
  );
}
