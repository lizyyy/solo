import type {
  ImportBatch,
  Annotation,
  SampleRecord,
  ConflictItem,
  ConflictEvidence,
  WorkflowStep,
  AuditLog,
  SelfCheckResult,
  MedianAlert,
  MaterialType,
  ConflictType,
  ConflictStatus,
  StepIndex,
  CheckType,
} from '@/types';

let _counter = 0;
function uid(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now()}_${_counter}`;
}

export function createBatch(operator: string, materialType: MaterialType): ImportBatch {
  return {
    id: uid('batch'),
    materialType,
    importTime: new Date().toISOString(),
    operator,
    status: 'pending',
  };
}

export function createAnnotation(
  batchId: string,
  subject: string,
  teacherId: string,
  score: number,
  denominator: string,
  rawDenominator: string,
): Annotation {
  return {
    id: uid('ann'),
    batchId,
    subject,
    teacherId,
    score,
    denominator,
    rawDenominator,
    source: 'teacher_annotation',
  };
}

export function createSampleRecord(
  batchId: string,
  subject: string,
  medianValue: number,
  threshold: number,
  sampleSize: number,
): SampleRecord {
  return {
    id: uid('sample'),
    batchId,
    subject,
    medianValue,
    threshold,
    sampleSize,
    source: 'sampling_list',
  };
}

export function createConflict(
  annotationId: string,
  sampleId: string,
  conflictType: ConflictType,
): ConflictItem {
  return {
    id: uid('conflict'),
    annotationId,
    sampleId,
    conflictType,
    status: 'pending',
    resolution: '',
    resolvedBy: '',
    resolvedAt: '',
  };
}

export function createConflictEvidence(
  conflictId: string,
  annotationValue: string,
  sampleValue: string,
  annotationSource: string,
  sampleSource: string,
): ConflictEvidence {
  return {
    id: uid('evidence'),
    conflictId,
    annotationValue,
    sampleValue,
    annotationSource,
    sampleSource,
  };
}

export function createWorkflowStep(
  batchId: string,
  stepIndex: StepIndex,
  stepName: string,
): WorkflowStep {
  return {
    id: uid('step'),
    batchId,
    stepIndex,
    stepName,
    status: 'pending',
    startedAt: '',
    completedAt: '',
    operator: '',
    snapshot: '',
  };
}

export function createAuditLog(
  batchId: string,
  action: string,
  actor: string,
  detail: string,
): AuditLog {
  return {
    id: uid('log'),
    batchId,
    action,
    actor,
    detail,
    timestamp: new Date().toISOString(),
  };
}

export function createSelfCheckResult(
  batchId: string,
  checkType: CheckType,
  passed: boolean,
  detail: string,
): SelfCheckResult {
  return {
    id: uid('check'),
    batchId,
    checkType,
    passed,
    detail,
    checkedAt: new Date().toISOString(),
  };
}

export function createMedianAlert(
  batchId: string,
  subject: string,
  medianValue: number,
  threshold: number,
): MedianAlert {
  return {
    id: uid('alert'),
    batchId,
    subject,
    medianValue,
    threshold,
    isAlert: Math.abs(medianValue - threshold) > threshold * 0.15,
    calculatedAt: new Date().toISOString(),
  };
}
