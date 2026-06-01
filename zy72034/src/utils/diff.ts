import type { FarmState, FieldDiff, DifferenceReport } from '../types';

export function calculateDifference(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): DifferenceReport {
  const diffs: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];

    if (oldVal !== newVal) {
      const diff: FieldDiff = {
        field: key,
        oldValue: oldVal,
        newValue: newVal,
      };

      if (typeof oldVal === 'number' && typeof newVal === 'number') {
        diff.delta = newVal - oldVal;
      }

      diffs.push(diff);
    }
  }

  return {
    hasChanges: diffs.length > 0,
    diffs,
  };
}

export function calculateFarmStateDifference(
  oldState: FarmState,
  newState: FarmState
): DifferenceReport {
  const { carbonQuota: oldQuota, revenue: oldRevenue, ...oldRest } = oldState;
  const { carbonQuota: newQuota, revenue: newRevenue, ...newRest } = newState;

  return calculateDifference(
    { carbonQuota: oldQuota, revenue: oldRevenue, ...oldRest },
    { carbonQuota: newQuota, revenue: newRevenue, ...newRest }
  );
}

export function formatFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    carbonQuota: '碳配额',
    landArea: '土地面积',
    cropType: '作物类型',
    revenue: '收益',
    amount: '数量',
    price: '价格',
  };
  return fieldNames[field] || field;
}

export function formatDiffValue(value: unknown, delta?: number): string {
  if (delta !== undefined) {
    const sign = delta > 0 ? '+' : '';
    return `${String(value)} (${sign}${delta})`;
  }
  return String(value);
}
