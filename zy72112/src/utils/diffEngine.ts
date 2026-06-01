import type { SensorRecord, Difference } from '../types';

const FIELD_LABELS: Record<string, string> = {
  'gap.calculated': '轨道间隙',
  'height.calculated': '悬浮高度',
  'current.calculated': '推进电流',
  'direction.x': 'X方向偏移',
  'direction.y': 'Y方向偏移',
};

function getNestedValue(obj: Record<string, unknown>, path: string): number {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return 0;
    }
  }
  return typeof current === 'number' ? current : 0;
}

export function compareRecords(
  oldRecord: SensorRecord,
  newRecord: SensorRecord
): Difference[] {
  const differences: Difference[] = [];
  const fields = [
    'gap.calculated',
    'height.calculated',
    'current.calculated',
    'direction.x',
    'direction.y',
  ];

  for (const field of fields) {
    const oldVal = getNestedValue(oldRecord as unknown as Record<string, unknown>, field);
    const newVal = getNestedValue(newRecord as unknown as Record<string, unknown>, field);
    if (Math.abs(oldVal - newVal) > 0.001) {
      differences.push({
        field,
        fieldLabel: FIELD_LABELS[field] || field,
        oldValue: oldVal,
        newValue: newVal,
        change: newVal - oldVal,
        changePercent: oldVal !== 0 ? ((newVal - oldVal) / Math.abs(oldVal)) * 100 : 0,
      });
    }
  }

  return differences;
}

export function formatDiffValue(value: number, field: string): string {
  if (field.includes('direction')) {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}mm`;
  }
  if (field.includes('current')) {
    return `${value.toFixed(3)}A`;
  }
  return `${value.toFixed(3)}mm`;
}

export function formatChangePercent(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}
