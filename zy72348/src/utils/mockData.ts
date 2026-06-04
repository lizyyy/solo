import type { Annotation, SampleRecord } from '@/types';
import { createAnnotation, createSampleRecord } from './factories';

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学'];
const TEACHERS = ['T001', 'T002', 'T003', 'T004', 'T005'];

export function generateNormalAnnotations(batchId: string): Annotation[] {
  return SUBJECTS.flatMap((subject, si) =>
    TEACHERS.slice(0, 3).map((teacherId, ti) =>
      createAnnotation(batchId, subject, teacherId, 80 + si * 3 + ti * 2, '100', '100'),
    ),
  );
}

export function generateWrongCaliberAnnotations(batchId: string): Annotation[] {
  return SUBJECTS.flatMap((subject, si) =>
    TEACHERS.slice(0, 3).map((teacherId, ti) => {
      const isMismatch = si === 1 && ti === 1;
      return createAnnotation(
        batchId,
        subject,
        teacherId,
        isMismatch ? 95 : 80 + si * 3 + ti * 2,
        isMismatch ? '150' : '100',
        isMismatch ? '150' : '100',
      );
    }),
  );
}

export function generateSupplementAnnotations(batchId: string): Annotation[] {
  const extra: Annotation[] = [];
  extra.push(createAnnotation(batchId, '语文', 'T006', 88, '100', '100'));
  extra.push(createAnnotation(batchId, '数学', 'T006', 92, '100', '100'));
  extra.push(createAnnotation(batchId, '英语', 'T007', 76, '100', '100'));
  return extra;
}

export function generateDenominatorZeroAnnotations(batchId: string): Annotation[] {
  const base = generateNormalAnnotations(batchId);
  const problematic = [
    createAnnotation(batchId, '物理', 'T006', 0, '', '0'),
    createAnnotation(batchId, '化学', 'T007', 0, '', '0'),
  ];
  return [...base, ...problematic];
}

export function generateSampleRecords(batchId: string): SampleRecord[] {
  return SUBJECTS.map((subject, si) =>
    createSampleRecord(batchId, subject, 0.82 + si * 0.02, 0.9, 120 + si * 10),
  );
}
