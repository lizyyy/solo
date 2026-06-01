import { DiffEntry, Notification } from '../types';

export function calculateDiff(
  oldObj: Partial<Notification>,
  newObj: Partial<Notification>
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldVal = oldObj[key as keyof Notification];
    const newVal = newObj[key as keyof Notification];

    if (oldVal === undefined && newVal !== undefined) {
      diffs.push({
        field: key,
        oldValue: undefined,
        newValue: newVal,
        action: 'add'
      });
    } else if (newVal === undefined && oldVal !== undefined) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: undefined,
        action: 'remove'
      });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        action: 'update'
      });
    }
  }

  return diffs;
}

export function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    title: '标题',
    status: '状态',
    studentName: '学生姓名',
    instrument: '乐器',
    piece: '曲目',
    rehearsalTime: '排练时间',
    reason: '替补原因'
  };
  return fieldMap[field] || field;
}

export function formatValue(value: any): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}
