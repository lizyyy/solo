import type { InspectionMark, ConflictRecord, OriginalNote } from '@/types';

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findDuplicates(marks: InspectionMark[]): InspectionMark[] {
  const seen = new Map<string, InspectionMark[]>();
  const duplicates: InspectionMark[] = [];

  for (const mark of marks) {
    const key = `${mark.x.toFixed(4)}|${mark.y.toFixed(4)}|${mark.z.toFixed(4)}`;
    const existing = seen.get(key) || [];
    existing.push(mark);
    seen.set(key, existing);
  }

  for (const [, group] of seen) {
    if (group.length > 1) {
      duplicates.push(...group.slice(1));
    }
  }

  return duplicates;
}

export function detectConflicts(
  marks: InspectionMark[],
  sketches: Array<{ id: string; referencePoints: Array<{ x: number; y: number; z: number; label: string }>; floorLevel: string }>
): Array<Omit<ConflictRecord, 'id' | 'detectedAt'>> {
  const conflicts: Array<Omit<ConflictRecord, 'id' | 'detectedAt'>> = [];

  for (const mark of marks) {
    if (!mark.isObstacle) continue;

    for (const sketch of sketches) {
      const sketchObstacles = sketch.referencePoints.filter(p => p.label.includes('障碍') || p.label.includes('obstacle'));

      for (const sp of sketchObstacles) {
        const distance = Math.sqrt(
          Math.pow(mark.x - sp.x, 2) +
          Math.pow(mark.y - sp.y, 2) +
          Math.pow(mark.z - sp.z, 2)
        );

        if (distance > 10) {
          const markNote = mark.originalNotes.find(n => n.noteType === 'handwritten' || n.isAmbiguous);
          conflicts.push({
            markId: mark.id,
            sketchId: sketch.id,
            conflictType: distance > 30 ? 'position_mismatch' : 'obstacle_mismatch',
            evidenceFromMark: `巡检标记：障碍物"${mark.obstacleType || '未知'}"，位置(${mark.x.toFixed(2)}, ${mark.y.toFixed(2)}, ${mark.z.toFixed(2)})${markNote ? `，原始备注：${markNote.content}` : ''}`,
            evidenceFromSketch: `楼层剖面草图(${sketch.floorLevel})：参考点"${sp.label}"，位置(${sp.x.toFixed(2)}, ${sp.y.toFixed(2)}, ${sp.z.toFixed(2)})`,
            status: 'pending'
          });
        }
      }

      if (mark.diameter && sketch.referencePoints.length > 0) {
        const sketchDiameter = sketch.referencePoints.find(p => p.label.includes('管径') || p.label.includes('diameter'));
        if (sketchDiameter && mark.diameter !== sketchDiameter.label.replace(/[^0-9.]/g, '')) {
          conflicts.push({
            markId: mark.id,
            sketchId: sketch.id,
            conflictType: 'diameter_mismatch',
            evidenceFromMark: `巡检标记：管径 ${mark.diameter}mm`,
            evidenceFromSketch: `楼层剖面草图(${sketch.floorLevel})：${sketchDiameter.label}`,
            status: 'pending'
          });
        }
      }
    }
  }

  return conflicts;
}

export function compareMarks(
  oldMarks: InspectionMark[],
  newMarks: InspectionMark[]
): Array<{ type: 'added' | 'removed' | 'modified'; mark: InspectionMark; oldMark?: InspectionMark }> {
  const differences: Array<{
    type: 'added' | 'removed' | 'modified';
    mark: InspectionMark;
    oldMark?: InspectionMark;
  }> = [];

  const oldMap = new Map(oldMarks.map(m => [m.id, m]));
  const newMap = new Map(newMarks.map(m => [m.id, m]));

  for (const [id, newMark] of newMap) {
    const oldMark = oldMap.get(id);
    if (!oldMark) {
      differences.push({ type: 'added', mark: newMark });
    } else if (!isEqual(oldMark, newMark)) {
      differences.push({ type: 'modified', mark: newMark, oldMark });
    }
  }

  for (const [id, oldMark] of oldMap) {
    if (!newMap.has(id)) {
      differences.push({ type: 'removed', mark: oldMark });
    }
  }

  return differences;
}

export function extractAmbiguousNotes(marks: InspectionMark[]): OriginalNote[] {
  return marks.flatMap(m => m.originalNotes.filter(n => n.isAmbiguous));
}

export function groupNotesByType(notes: OriginalNote[]): Record<string, OriginalNote[]> {
  return notes.reduce((acc, note) => {
    if (!acc[note.noteType]) {
      acc[note.noteType] = [];
    }
    acc[note.noteType].push(note);
    return acc;
  }, {} as Record<string, OriginalNote[]>);
}
