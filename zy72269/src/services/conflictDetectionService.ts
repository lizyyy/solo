import type { InspectionMark, FloorSketch, ConflictRecord, Decision } from '@/types';
import { detectConflicts } from '@/utils/comparison';
import { generateUUID } from '@/utils/coordinate';

export function detectAllConflicts(
  marks: InspectionMark[],
  sketches: FloorSketch[]
): ConflictRecord[] {
  const conflictsData = detectConflicts(marks, sketches);
  const now = new Date().toISOString();

  return conflictsData.map(data => ({
    id: generateUUID(),
    markId: data.markId,
    sketchId: data.sketchId,
    conflictType: data.conflictType,
    evidenceFromMark: data.evidenceFromMark,
    evidenceFromSketch: data.evidenceFromSketch,
    status: data.status,
    detectedAt: now
  }));
}

export function buildConflictEvidence(
  mark: InspectionMark,
  sketch: FloorSketch
): {
  markEvidence: string;
  sketchEvidence: string;
} {
  const markNote = mark.originalNotes.find(n => n.isAmbiguous || n.noteType === 'handwritten');
  const sketchRef = sketch.referencePoints.length > 0
    ? sketch.referencePoints.map(p => `${p.label}:(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`).join('; ')
    : '无参考点数据';

  return {
    markEvidence: `巡检标记#${mark.sequenceNo}: 类型=${mark.pipelineType}, 管径=${mark.diameter}mm, 坐标=(${mark.x.toFixed(2)},${mark.y.toFixed(2)},${mark.z.toFixed(2)})${mark.isObstacle ? `, 障碍物=${mark.obstacleType}` : ''}${markNote ? `, 备注:${markNote.content}` : ''}`,
    sketchEvidence: `楼层剖面草图(${sketch.floorLevel}): ${sketchRef}`
  };
}

export function resolveConflict(
  conflict: ConflictRecord,
  decision: 'confirm' | 'reject',
  reason: string,
  engineerName: string
): ConflictRecord {
  const decisionRecord: Decision = {
    id: generateUUID(),
    conflictId: conflict.id,
    decisionType: decision,
    reason,
    engineerName,
    decidedAt: new Date().toISOString()
  };

  return {
    ...conflict,
    status: decision === 'confirm' ? 'confirmed' : 'rejected',
    decision: decisionRecord
  };
}

export function getConflictTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    obstacle_mismatch: '障碍物不匹配',
    position_mismatch: '位置不匹配',
    diameter_mismatch: '管径不匹配'
  };
  return labels[type] || type;
}

export function getConflictStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待处理',
    confirmed: '已确认',
    rejected: '已驳回'
  };
  return labels[status] || status;
}

export function getConflictSeverity(conflict: ConflictRecord): 'high' | 'medium' | 'low' {
  if (conflict.conflictType === 'position_mismatch') return 'high';
  if (conflict.conflictType === 'obstacle_mismatch') return 'high';
  return 'medium';
}

export function filterConflicts(
  conflicts: ConflictRecord[],
  filters: {
    status?: string;
    type?: string;
    severity?: string;
  }
): ConflictRecord[] {
  return conflicts.filter(c => {
    if (filters.status && c.status !== filters.status) return false;
    if (filters.type && c.conflictType !== filters.type) return false;
    if (filters.severity && getConflictSeverity(c) !== filters.severity) return false;
    return true;
  });
}
