import type {
  PhotoEvidence,
  NoteEvidence,
  EvidenceConflict,
  ConflictResolutionStatus,
} from '@/types';

export type ConflictType = 'value_mismatch' | 'unit_mismatch' | 'caliber_mismatch';

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: EvidenceConflict[];
}

export const VALUE_TOLERANCE = 0.05;

export const detectConflicts = (
  photoEvidence: PhotoEvidence[],
  noteEvidence: NoteEvidence[]
): ConflictDetectionResult => {
  const conflicts: EvidenceConflict[] = [];

  const photoMap = new Map(photoEvidence.map(p => [p.recordId, p]));
  const noteMap = new Map(noteEvidence.map(n => [n.recordId, n]));

  const allRecordIds = new Set([...photoMap.keys(), ...noteMap.keys()]);

  allRecordIds.forEach(recordId => {
    const photo = photoMap.get(recordId);
    const note = noteMap.get(recordId);

    if (photo && note) {
      const valueConflict = checkValueConflict(photo, note);
      if (valueConflict) {
        conflicts.push(valueConflict);
      }

      const unitConflict = checkUnitConflict(photo, note);
      if (unitConflict) {
        conflicts.push(unitConflict);
      }
    }
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
};

const checkValueConflict = (
  photo: PhotoEvidence,
  note: NoteEvidence
): EvidenceConflict | null => {
  const diff = Math.abs(photo.extractedValue - note.notedValue);
  const avgValue = (photo.extractedValue + note.notedValue) / 2;
  const deviationRate = (diff / avgValue) * 100;

  if (deviationRate > VALUE_TOLERANCE * 100) {
    return {
      id: `CONFLICT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recordId: photo.recordId,
      conflictType: 'value_mismatch',
      photoEvidenceId: photo.id,
      noteEvidenceId: note.id,
      photoEvidence: `工况照片显示数值为 ${photo.extractedValue}${photo.extractedUnit}，设备自动采集，时间 ${photo.captureTime}`,
      noteEvidence: `手写巡检备注记录数值约 ${note.notedValue}${note.notedUnit}，${note.inspectorName}人工读取，时间 ${note.noteTime}`,
      impactDescription: `差值约 ${diff.toFixed(0)}${photo.extractedUnit}，偏差率 ${deviationRate.toFixed(1)}%，可能影响该批次材料屈服强度评估，涉及后续试验数据的可比性`,
      resolutionStatus: 'pending' as const,
    };
  }

  return null;
};

const checkUnitConflict = (
  photo: PhotoEvidence,
  note: NoteEvidence
): EvidenceConflict | null => {
  if (photo.extractedUnit !== note.notedUnit) {
    return {
      id: `CONFLICT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recordId: photo.recordId,
      conflictType: 'unit_mismatch',
      photoEvidenceId: photo.id,
      noteEvidenceId: note.id,
      photoEvidence: `工况照片单位为 ${photo.extractedUnit}`,
      noteEvidence: `手写巡检备注单位为 ${note.notedUnit}`,
      impactDescription: `单位不一致，可能导致数值换算错误，影响最终结果的准确性`,
      resolutionStatus: 'pending' as const,
    };
  }

  return null;
};

export const getConflictTypeDescription = (type: ConflictType): string => {
  const descriptions: Record<ConflictType, string> = {
    value_mismatch: '数值冲突',
    unit_mismatch: '单位冲突',
    caliber_mismatch: '口径冲突',
  };
  return descriptions[type];
};

export const getResolutionStatusDescription = (status: ConflictResolutionStatus): string => {
  const descriptions: Record<ConflictResolutionStatus, string> = {
    pending: '待裁决',
    accept_photo: '采信照片证据',
    accept_note: '采信备注证据',
    rejected: '驳回待重审',
  };
  return descriptions[status];
};

export const getConflictImpactLevel = (conflict: EvidenceConflict): 'high' | 'medium' | 'low' => {
  if (conflict.conflictType === 'caliber_mismatch') return 'high';
  if (conflict.conflictType === 'value_mismatch') {
    const match = conflict.impactDescription.match(/偏差率\s+([\d.]+)%/);
    if (match) {
      const rate = parseFloat(match[1]);
      if (rate > 20) return 'high';
      if (rate > 10) return 'medium';
    }
    return 'low';
  }
  return 'medium';
};

export const formatResolutionNote = (
  status: ConflictResolutionStatus,
  resolvedBy: string,
  note?: string
): string => {
  const baseNote = `${getResolutionStatusDescription(status)}，裁决人：${resolvedBy}`;
  return note ? `${baseNote}，备注：${note}` : baseNote;
};
