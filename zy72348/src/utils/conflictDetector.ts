import type { Annotation, SampleRecord, ConflictItem, ConflictEvidence } from '@/types';
import { createConflict, createConflictEvidence } from './factories';

export function detectConflicts(
  annotations: Annotation[],
  samples: SampleRecord[],
): { conflicts: ConflictItem[]; evidences: ConflictEvidence[] } {
  const conflicts: ConflictItem[] = [];
  const evidences: ConflictEvidence[] = [];

  for (const ann of annotations) {
    const sample = samples.find((s) => s.subject === ann.subject);
    if (!sample) continue;

    if (ann.rawDenominator === '0' && (ann.denominator === '' || ann.denominator.trim() === '')) {
      const conflict = createConflict(ann.id, sample.id, 'denominator_zero_empty');
      conflict.status = 'needs_review';
      const evidence = createConflictEvidence(
        conflict.id,
        `分母原始值="${ann.rawDenominator}"，填写值="${ann.denominator}"`,
        `抽样名单中位数=${sample.medianValue}，样本量=${sample.sampleSize}`,
        `老师批注 [${ann.teacherId}]`,
        `抽样名单 [${ann.subject}]`,
      );
      conflicts.push(conflict);
      evidences.push(evidence);
      continue;
    }

    const annMedian = ann.score / (Number(ann.denominator) || 1);
    const deviation = Math.abs(annMedian - sample.medianValue);
    if (deviation > sample.threshold * 0.15) {
      const conflict = createConflict(ann.id, sample.id, 'median_deviation');
      const evidence = createConflictEvidence(
        conflict.id,
        `批注计算值=${annMedian.toFixed(2)} (分数=${ann.score}/分母=${ann.denominator})`,
        `抽样名单中位数=${sample.medianValue}`,
        `老师批注 [${ann.teacherId}]`,
        `抽样名单 [${ann.subject}]`,
      );
      conflicts.push(conflict);
      evidences.push(evidence);
    }

    if (ann.score !== sample.sampleSize) {
      const conflict = createConflict(ann.id, sample.id, 'score_mismatch');
      const evidence = createConflictEvidence(
        conflict.id,
        `批注分数=${ann.score}`,
        `抽样名单样本量=${sample.sampleSize}`,
        `老师批注 [${ann.teacherId}]`,
        `抽样名单 [${ann.subject}]`,
      );
      conflicts.push(conflict);
      evidences.push(evidence);
    }
  }

  return { conflicts, evidences };
}
