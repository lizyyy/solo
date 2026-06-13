import { db } from '../db/index';
import { buildHistoryItem, uuid } from './common';
import type {
  ConflictEvidence,
  ConflictResolution,
  ResolveConflictInput,
} from '../../shared/types';

function labelText(label: string): string {
  if (label === 'pass') return '通过';
  if (label === 'reject') return '拒绝';
  return '待定';
}

export async function detectConflicts(batchId: string): Promise<ConflictEvidence[]> {
  await db.read();
  const samples = db.data.samples.filter((s) => s.batchId === batchId);
  const existing = new Set(
    db.data.conflicts.filter((c) => c.batchId === batchId).map((c) => c.sampleId),
  );
  const created: ConflictEvidence[] = [];

  for (const sample of samples) {
    if (existing.has(sample.id)) continue;
    const hasLabelMismatch = sample.labelA !== sample.labelB || sample.labelA !== sample.grayLabel;
    const hasNoteContradiction =
      !!sample.annotatorNote &&
      (sample.annotatorNote.includes('应通过') || sample.annotatorNote.includes('应拒绝')) &&
      ((sample.annotatorNote.includes('应通过') && sample.grayLabel !== 'pass') ||
        (sample.annotatorNote.includes('应拒绝') && sample.grayLabel !== 'reject'));

    if (hasLabelMismatch) {
      const evidence: ConflictEvidence = {
        id: uuid(),
        sampleId: sample.id,
        batchId,
        type: 'label_mismatch',
        graySide: `灰度批次判定：${labelText(sample.grayLabel)}（模型A:${labelText(sample.labelA)} / 模型B:${labelText(sample.labelB)}）`,
        annotatorSide: sample.annotatorNote ? `标注员留言：${sample.annotatorNote}` : '标注员未留言，但多模型标签不一致',
        resolved: false,
      };
      db.data.conflicts.push(evidence);
      created.push(evidence);
    } else if (hasNoteContradiction) {
      const evidence: ConflictEvidence = {
        id: uuid(),
        sampleId: sample.id,
        batchId,
        type: 'note_contradicts_gray',
        graySide: `灰度批次判定：${labelText(sample.grayLabel)}`,
        annotatorSide: `标注员留言：${sample.annotatorNote}`,
        resolved: false,
      };
      db.data.conflicts.push(evidence);
      created.push(evidence);
    }
  }
  await db.write();
  return created;
}

export async function listConflicts(batchId: string): Promise<ConflictEvidence[]> {
  await db.read();
  await detectConflicts(batchId);
  return db.data.conflicts
    .filter((c) => c.batchId === batchId)
    .sort((a, b) => Number(a.resolved) - Number(b.resolved));
}

export async function resolveConflict(
  conflictId: string,
  input: ResolveConflictInput,
): Promise<ConflictEvidence> {
  await db.read();
  const conflict = db.data.conflicts.find((c) => c.id === conflictId);
  if (!conflict) throw new Error('conflict not found');

  conflict.resolved = true;
  conflict.resolution = input.resolution;
  conflict.resolvedBy = input.operator;
  conflict.resolvedReason = input.reason;
  conflict.resolvedAt = Date.now();

  const sample = db.data.samples.find((s) => s.id === conflict.sampleId);
  if (sample) {
    const action = input.resolution === 'confirm_gray' ? 'confirm' : 'reject';
    sample.finalLabel =
      input.resolution === 'confirm_gray'
        ? (sample.grayLabel === 'uncertain' ? 'reject' : (sample.grayLabel as 'pass' | 'reject'))
        : sample.annotatorNote?.includes('应通过')
          ? 'pass'
          : 'reject';
    sample.reviewedBy = input.operator;
    sample.reviewedAt = Date.now();
    sample.history.push(
      buildHistoryItem(sample.id, action, input.operator, {
        finalLabel: sample.finalLabel,
      }, input.reason),
    );
  }
  await db.write();
  return conflict;
}
