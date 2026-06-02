import type { Schedule, Material, ConflictRecord } from '@/types';

export function detectConflicts(
  importedSchedules: Partial<Schedule>[],
  existingSchedules: Schedule[],
  materials: Material[]
): ConflictRecord[] {
  const conflicts: ConflictRecord[] = [];

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
          return (
            linked.volunteerName === imported.volunteerName ||
            linked.timeSlot === imported.timeSlot
          );
        });

    for (const material of matchedMaterials) {
      const linkedSchedule = existingSchedules.find(
        (s) => s.id === material.scheduleId
      );

      if (linkedSchedule && imported.volunteerName) {
        if (linkedSchedule.volunteerName !== imported.volunteerName) {
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
          });
        }

        if (linkedSchedule.timeSlot !== imported.timeSlot) {
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
            importValue: imported.timeSlot ?? '',
            contractValue: linkedSchedule.timeSlot,
            contractEvidence: evidence,
            resolution: null,
            resolvedBy: null,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
          });
        }
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
        const alreadyExists = conflicts.some(
          (c) => c.scheduleId === timeConflict.id && c.importValue === imported.timeSlot
        );

        if (!alreadyExists) {
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
          });
        }
      }
    }
  }

  return conflicts;
}
