import { ShortageRecord, ChangeLog } from '@/types';
import { generateId } from './hash';

export interface FieldDiff {
  fieldName: string;
  oldValue: string;
  newValue: string;
}

export function diffRecords(
  oldRecord: Partial<ShortageRecord>,
  newRecord: Partial<ShortageRecord>
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const fieldsToTrack: (keyof ShortageRecord)[] = [
    'trackName',
    'standardTrackName',
    'shortageQuantity',
    'status',
    'currentNote',
    'isBoundaryCase',
    'boundaryType',
    'confirmedBy',
    'reviewedBy'
  ];

  for (const field of fieldsToTrack) {
    const oldVal = String(oldRecord[field] ?? '');
    const newVal = String(newRecord[field] ?? '');
    if (oldVal !== newVal) {
      diffs.push({
        fieldName: field as string,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  }

  return diffs;
}

export function createChangeLogs(
  recordId: string,
  diffs: FieldDiff[],
  operator: string,
  changeReason: string = ''
): ChangeLog[] {
  const now = new Date().toISOString();
  return diffs.map(diff => ({
    id: generateId(),
    recordId,
    fieldName: diff.fieldName,
    oldValue: diff.oldValue,
    newValue: diff.newValue,
    operator,
    changedAt: now,
    changeReason
  }));
}

export function groupChangesByTime(changelogs: ChangeLog[]): Array<{ timestamp: string; operator: string; changes: ChangeLog[] }> {
  const groups = new Map<string, ChangeLog[]>();

  for (const log of changelogs) {
    const key = `${log.changedAt}-${log.operator}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(log);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, changes]) => {
      const [timestamp, operator] = key.split('-');
      return { timestamp: changes[0].changedAt, operator, changes };
    });
}

export function getFieldDisplayName(fieldName: string): string {
  const displayNames: Record<string, string> = {
    trackName: '曲目名',
    standardTrackName: '标准曲目名',
    shortageQuantity: '缺货数量',
    status: '处理状态',
    currentNote: '备注',
    isBoundaryCase: '是否边界场景',
    boundaryType: '边界场景类型',
    confirmedBy: '确认人',
    reviewedBy: '复核人'
  };
  return displayNames[fieldName] || fieldName;
}

export function formatValue(fieldName: string, value: string): string {
  if (fieldName === 'status') {
    const statusMap: Record<string, string> = {
      pending: '待处理',
      alias_mapped: '已匹配别名',
      review_needed: '待巡演统筹复核',
      confirmed: '已确认',
      reviewed: '已复核',
      rejected: '已驳回'
    };
    return statusMap[value] || value;
  }
  if (fieldName === 'isBoundaryCase') {
    return value === 'true' ? '是' : '否';
  }
  if (fieldName === 'shortageQuantity') {
    return value + ' 张';
  }
  return value;
}
