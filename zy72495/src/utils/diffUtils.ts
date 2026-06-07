import type { DiffResult } from '@/types';

export function deepDiff<T extends Record<string, unknown>>(
  obj1: T,
  obj2: T
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const val1 = obj1[key];
    const val2 = obj2[key];
    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      diff[key] = { before: val1, after: val2 };
    }
  }
  return diff;
}

export function formatDiffResults(
  diff: Record<string, { before: unknown; after: unknown }>
): DiffResult[] {
  return Object.entries(diff).map(([field, values]) => ({
    field,
    before: values.before,
    after: values.after,
  }));
}

export function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    name: '点位名称',
    content: '备注内容',
    boundaryStatus: '边界状态',
    routeName: '线路名称',
    startTime: '开始时间',
    endTime: '结束时间',
    passengerCount: '客流数',
    date: '日期',
    stallNumber: '摊位号',
    vendorName: '摊主姓名',
    rotationDate: '轮换日期',
    status: '状态',
    reviewRemark: '复核意见',
  };
  return fieldNames[field] || field;
}
