import type { Schedule, Material, ConflictRecord } from '@/types';

function extractContractTimeSlot(annotation: string): string | null {
  const patterns = [
    /约定服务时段为(\d{2}:\d{2}-\d{2}:\d{2})/,
    /时段为(\d{2}:\d{2}-\d{2}:\d{2})/,
    /(\d{2}:\d{2}-\d{2}:\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = annotation.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function detectConflicts(
  importedSchedules: Partial<Schedule>[],
  existingSchedules: Schedule[],
  materials: Material[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];
  const seen = new Set<string>();

  const contractScans = materials.filter(
    (m) => m.type === 'contract_scan'
  );

  const confirmedSchedules = existingSchedules.filter(
    (s) => s.status === 'confirmed'
  );

  for (const imported of importedSchedules) {
    const matchedMaterials = imported.id
      ? contractScans.filter((m) => m.scheduleId === imported.id)
      : contractScans.filter((m) => {
          const linked = existingSchedules.find((s) => s.id === m.scheduleId);
          if (!linked) return false;
          return linked.volunteerName === imported.volunteerName;
        });

    for (const material of matchedMaterials) {
      const linkedSchedule = existingSchedules.find(
        (s) => s.id === material.scheduleId
      );
      if (!linkedSchedule) continue;

      const currentValue = imported.timeSlot ?? linkedSchedule.timeSlot;
      const contractTimeSlot = extractContractTimeSlot(material.annotation);

      if (
        contractTimeSlot &&
        currentValue &&
        currentValue !== contractTimeSlot
      ) {
        const dedupeKey = `${material.scheduleId}:timeSlot:${contractTimeSlot}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const evidence = [
          material.name,
          material.description,
          material.annotation,
        ]
          .filter(Boolean)
          .join(' | ');

        conflicts.push({
          id: crypto.randomUUID(),
          scheduleId: material.scheduleId,
          field: 'timeSlot',
          importValue: currentValue,
          contractValue: contractTimeSlot,
          contractEvidence: evidence,
          resolution: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          importedScheduleData: imported,
          isNewSchedule: false,
        });
      }

      if (imported.volunteerName && linkedSchedule.volunteerName !== imported.volunteerName) {
        const dedupeKey = `${material.scheduleId}:volunteerName:${imported.volunteerName}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const evidence = [
          material.name,
          material.description,
          material.annotation,
        ]
          .filter(Boolean)
          .join(' | ');

        conflicts.push({
          id: crypto.randomUUID(),
          scheduleId: material.scheduleId,
          field: 'volunteerName',
          importValue: imported.volunteerName,
          contractValue: linkedSchedule.volunteerName,
          contractEvidence: evidence,
          resolution: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          importedScheduleData: imported,
          isNewSchedule: false,
        });
      }
    }

    if (imported.volunteerName && imported.timeSlot && imported.date) {
      const timeConflict = confirmedSchedules.find(
        (existing) =>
          existing.volunteerName === imported.volunteerName &&
          existing.timeSlot === imported.timeSlot &&
          existing.date === imported.date
      );

      if (timeConflict) {
        const dedupeKey = `${timeConflict.id}:confirmed_dup:${imported.timeSlot}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        conflicts.push({
          id: crypto.randomUUID(),
          scheduleId: timeConflict.id,
          field: 'timeSlot',
          importValue: `${imported.volunteerName} | ${imported.timeSlot}`,
          contractValue: `${timeConflict.volunteerName} | ${timeConflict.timeSlot}`,
          contractEvidence: '与已确认排班存在时段冲突',
          resolution: null,
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          importedScheduleData: imported,
          isNewSchedule: false,
        });
      }
    }
  }

  return conflicts;
}
