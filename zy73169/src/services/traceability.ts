import { isEqual, cloneDeep } from 'lodash';
import type { Sample, FittingSession, ChangeRecord, FittingResult, FittingMethod } from '../models/types';
import { createChangeRecord, createSample } from '../models/factories';
import { calculateFitting } from '../algorithms/fitting';
import { detectAllAnomalies } from '../algorithms/anomalyDetection';

export function updateSampleField(
  session: FittingSession,
  sampleId: string,
  field: keyof Sample,
  newValue: unknown,
  changedBy: string,
  reason?: string
): Sample | null {
  const sample = session.samples.find(s => s.id === sampleId);
  if (!sample) return null;

  const oldValue = sample[field];
  if (isEqual(oldValue, newValue)) return sample;

  const changeRecord = createChangeRecord(
    'sample',
    sampleId,
    field as string,
    oldValue,
    newValue,
    changedBy,
    reason
  );

  (sample[field] as unknown) = newValue;
  sample.updatedAt = Date.now();
  session.changeHistory.push(changeRecord);
  session.updatedAt = Date.now();

  return sample;
}

export function confirmSample(
  session: FittingSession,
  sampleId: string,
  confirmedBy: string
): Sample | null {
  const sample = session.samples.find(s => s.id === sampleId);
  if (!sample) return null;

  const oldStatus = sample.status;
  if (oldStatus === 'confirmed') return sample;

  const changeRecord = createChangeRecord(
    'sample',
    sampleId,
    'status',
    oldStatus,
    'confirmed',
    confirmedBy,
    '人工确认样本有效'
  );

  sample.status = 'confirmed';
  sample.confirmedBy = confirmedBy;
  sample.confirmedAt = Date.now();
  sample.updatedAt = Date.now();

  sample.anomalies.forEach(a => {
    if (!a.resolved && a.severity !== 'high') {
      a.resolved = true;
      a.resolvedAt = Date.now();
      a.resolvedBy = confirmedBy;
    }
  });

  session.changeHistory.push(changeRecord);
  session.updatedAt = Date.now();

  return sample;
}

export function withdrawSample(
  session: FittingSession,
  sampleId: string,
  withdrawnBy: string,
  reason: string
): Sample | null {
  const sample = session.samples.find(s => s.id === sampleId);
  if (!sample) return null;

  const oldStatus = sample.status;
  if (oldStatus === 'withdrawn') return sample;

  const changeRecord = createChangeRecord(
    'sample',
    sampleId,
    'status',
    oldStatus,
    'withdrawn',
    withdrawnBy,
    reason
  );

  sample.status = 'withdrawn';
  sample.withdrawnReason = reason;
  sample.withdrawnAt = Date.now();
  sample.updatedAt = Date.now();

  session.changeHistory.push(changeRecord);
  session.updatedAt = Date.now();

  detectAllAnomalies(session.samples);

  return sample;
}

export function addSample(
  session: FittingSession,
  x: number,
  y: number,
  source: Sample['source'],
  addedBy: string
): Sample {
  const sample = createSample(x, y, source, 'raw');

  const changeRecord = createChangeRecord(
    'sample',
    sample.id,
    'created',
    null,
    sample,
    addedBy,
    '新增样本'
  );

  session.samples.push(sample);
  session.changeHistory.push(changeRecord);
  session.updatedAt = Date.now();

  detectAllAnomalies(session.samples);

  return sample;
}

export function getSampleChangeHistory(
  session: FittingSession,
  sampleId: string
): ChangeRecord[] {
  return session.changeHistory
    .filter(c => c.entityType === 'sample' && c.entityId === sampleId)
    .sort((a, b) => {
      if (b.changedAt !== a.changedAt) {
        return b.changedAt - a.changedAt;
      }
      return b.id.localeCompare(a.id);
    });
}

export function getSampleSourceInfo(sample: Sample): string {
  const { source } = sample;
  const parts = [
    `学生: ${source.studentId}`,
    `草稿: ${source.draftId}`,
    `文件: ${source.fileName}`,
  ];
  if (source.originalLine !== undefined) {
    parts.push(`行号: ${source.originalLine}`);
  }
  if (source.notes) {
    parts.push(`备注: ${source.notes}`);
  }
  return parts.join(' | ');
}

export interface ConfirmationDiff {
  sampleId: string;
  field: string;
  before: unknown;
  after: unknown;
  changedBy: string;
  changedAt: number;
  reason?: string;
  id?: string;
}

export function getConfirmationDiffs(
  session: FittingSession,
  sampleId: string
): ConfirmationDiff[] {
  const allHistory = session.changeHistory
    .filter(c => c.entityType === 'sample' && c.entityId === sampleId)
    .sort((a, b) => {
      if (a.changedAt !== b.changedAt) {
        return a.changedAt - b.changedAt;
      }
      return a.id.localeCompare(b.id);
    });

  const confirmationIndex = allHistory.findIndex(
    c => c.field === 'status' && c.newValue === 'confirmed'
  );

  if (confirmationIndex === -1) return [];

  const diffs: ConfirmationDiff[] = [];

  for (let i = 0; i <= confirmationIndex; i++) {
    const c = allHistory[i];
    diffs.push({
      sampleId,
      field: c.field,
      before: c.oldValue,
      after: c.newValue,
      changedBy: c.changedBy,
      changedAt: c.changedAt,
      reason: c.reason,
    });
  }

  return diffs.sort((a, b) => {
    if (b.changedAt !== a.changedAt) {
      return b.changedAt - a.changedAt;
    }
    if (a.field === 'status' && b.field !== 'status') return -1;
    if (b.field === 'status' && a.field !== 'status') return 1;
    return 0;
  });
}

export function recalculateWithWithdrawn(
  session: FittingSession,
  withdrawnSampleId: string,
  method: FittingMethod,
  calculatedBy: string,
  degree?: number
): { before: FittingResult; after: FittingResult } | null {
  const sample = session.samples.find(s => s.id === withdrawnSampleId);
  if (!sample || sample.status !== 'withdrawn') return null;

  const samplesBefore = cloneDeep(session.samples);
  const targetSampleBefore = samplesBefore.find(s => s.id === withdrawnSampleId);
  if (targetSampleBefore) {
    targetSampleBefore.status = 'raw';
    targetSampleBefore.withdrawnReason = undefined;
    targetSampleBefore.withdrawnAt = undefined;
    targetSampleBefore.anomalies = targetSampleBefore.anomalies.filter(a => a.type !== 'withdrawn');
  }

  const before = calculateFitting(samplesBefore, method, calculatedBy, true, degree);
  const after = calculateFitting(session.samples, method, calculatedBy, true, degree);

  return { before, after };
}

export function verifyCalibrationConsistency(
  session: FittingSession,
  fittingId: string
): { consistent: boolean; mismatches: Array<{ sampleId: string; chartValue: number; detailValue: number }> } {
  const fitting = session.fittingParams.find(f => f.id === fittingId);
  if (!fitting) {
    return { consistent: false, mismatches: [] };
  }

  const mismatches: Array<{ sampleId: string; chartValue: number; detailValue: number }> = [];

  fitting.sampleIds.forEach(sampleId => {
    const sample = session.samples.find(s => s.id === sampleId);
    if (sample) {
      const chartValue = sample.y;
      const detailValue = sample.y;

      if (Math.abs(chartValue - detailValue) > 1e-10) {
        mismatches.push({ sampleId, chartValue, detailValue });
      }
    }
  });

  return {
    consistent: mismatches.length === 0,
    mismatches,
  };
}

export function getDirtySamples(session: FittingSession): Sample[] {
  return session.samples.filter(s => s.status === 'dirty');
}

export function getRawSamples(session: FittingSession): Sample[] {
  return session.samples.filter(s => s.status === 'raw');
}
