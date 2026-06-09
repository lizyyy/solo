import type { InspectionRecord, DuplicateGroup, WarningAlert } from '@/types';

export function detectDuplicates(records: InspectionRecord[], warnings: WarningAlert[]): DuplicateGroup[] {
  const noMap = new Map<string, InspectionRecord[]>();
  records.forEach((r) => {
    const list = noMap.get(r.equipment_no) || [];
    list.push(r);
    noMap.set(r.equipment_no, list);
  });

  const groups: DuplicateGroup[] = [];
  for (const [equipment_no, list] of noMap.entries()) {
    if (list.length > 1) {
      const values = list.map((r) => `${r.measured_value}${r.measure_unit}`);
      const times = list.map((r) => r.inspect_time.slice(5, 16));
      const conflictPoints: string[] = [];
      values.forEach((v, i) => {
        conflictPoints.push(`${times[i]} 测得 ${v}（${list[i].inspector}）`);
      });
      const affectedWarnings = warnings
        .filter((w) => list.some((r) => r.id === w.record_id))
        .map((w) => w.id);
      groups.push({
        equipment_no,
        record_ids: list.map((r) => r.id),
        count: list.length,
        conflict_points: conflictPoints,
        affected_warnings: affectedWarnings,
      });
    }
  }
  return groups;
}

export function getDuplicateRecordsByEquipment(
  equipmentNo: string,
  records: InspectionRecord[],
): InspectionRecord[] {
  return records.filter((r) => r.equipment_no === equipmentNo);
}

export function markDuplicatesInRecords(records: InspectionRecord[]): InspectionRecord[] {
  const noMap = new Map<string, number>();
  records.forEach((r) => {
    noMap.set(r.equipment_no, (noMap.get(r.equipment_no) || 0) + 1);
  });
  return records.map((r) => ({
    ...r,
    is_duplicate: (noMap.get(r.equipment_no) || 0) > 1,
    status: (noMap.get(r.equipment_no) || 0) > 1 ? 'pending' : r.status,
  }));
}
