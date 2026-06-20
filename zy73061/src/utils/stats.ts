import type { WarningAlert, InspectionRecord, WarningLevel } from '@/types';

export function isRecordPending(r: InspectionRecord): boolean {
  return r.is_duplicate && r.status === 'pending';
}

export function isWarningEffective(w: WarningAlert, pendingRecordIds: Set<string>): boolean {
  return w.status !== 'voided' && !pendingRecordIds.has(w.record_id);
}

export function getEffectiveWarnings(
  warnings: WarningAlert[],
  records: InspectionRecord[],
): WarningAlert[] {
  const pendingRecordIds = new Set(records.filter(isRecordPending).map((r) => r.id));
  return warnings.filter((w) => isWarningEffective(w, pendingRecordIds));
}

export interface DashboardStats {
  red: number;
  yellow: number;
  green: number;
  pending: number;
  total: number;
}

export function getDashboardStats(
  warnings: WarningAlert[],
  records: InspectionRecord[],
): DashboardStats {
  const effective = getEffectiveWarnings(warnings, records);
  const pending = records.filter(isRecordPending).length;
  return {
    red: effective.filter((w) => w.level === 'red').length,
    yellow: effective.filter((w) => w.level === 'yellow').length,
    green: effective.filter((w) => w.level === 'green').length,
    pending,
    total: effective.length + pending,
  };
}

export function levelOfRecord(
  record: InspectionRecord,
  warnings: WarningAlert[],
): WarningLevel {
  const w = warnings.find((x) => x.record_id === record.id);
  if (w) return w.level;
  return 'green';
}
