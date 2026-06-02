import db from '../database';
import { detectConflicts } from '../utils';
import type { DataConflict } from '../types';

export function checkAndCreateConflicts(feedbackId: number): DataConflict[] {
  const feedback = db.resident_feedbacks.get(feedbackId);
  if (!feedback) return [];

  const existingFeedbacks = db.resident_feedbacks.filter((f: any) => 
    f.locationId === feedback.locationId && f.id !== feedbackId
  );

  const conflicts = detectConflicts(feedback, existingFeedbacks);
  const createdConflicts: DataConflict[] = [];

  for (const conflict of conflicts) {
    const existing = db.data_conflicts.findOne((c: any) => 
      c.feedbackId === conflict.feedbackId && 
      c.relatedFeedbackId === conflict.relatedFeedbackId &&
      c.resolvedAt === null
    );

    if (!existing) {
      const result = db.data_conflicts.insert({
        locationId: conflict.locationId,
        feedbackId: conflict.feedbackId,
        relatedFeedbackId: conflict.relatedFeedbackId,
        conflictType: conflict.conflictType,
        description: conflict.description,
        feedbackValue: conflict.feedbackValue,
        existingValue: conflict.existingValue,
        suggestedAction: conflict.suggestedAction,
        resolvedAt: null,
        resolvedBy: null,
        resolution: null
      });

      createdConflicts.push(db.data_conflicts.get(result.lastInsertRowid) as DataConflict);
    }
  }

  return createdConflicts;
}

export function getConflicts(filters?: {
  locationId?: number;
  resolved?: boolean;
}): DataConflict[] {
  let results = db.data_conflicts.all();

  if (filters?.locationId) {
    results = results.filter((c: any) => c.locationId === filters.locationId);
  }

  if (filters?.resolved !== undefined) {
    if (filters.resolved) {
      results = results.filter((c: any) => c.resolvedAt !== null);
    } else {
      results = results.filter((c: any) => c.resolvedAt === null);
    }
  }

  results.sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return results as DataConflict[];
}

export function getConflictById(id: number): DataConflict | undefined {
  return db.data_conflicts.get(id) as DataConflict | undefined;
}

export function resolveConflict(
  id: number,
  resolution: 'use_feedback' | 'use_existing' | 'manual',
  resolvedBy: string,
  notes?: string
): DataConflict | undefined {
  const conflict = getConflictById(id);
  if (!conflict) return undefined;

  let resolutionNotes = notes || '';
  if (resolution === 'use_feedback') {
    resolutionNotes = notes || `采用新反馈内容: ${conflict.feedbackValue}`;
  } else if (resolution === 'use_existing') {
    resolutionNotes = notes || `保留原有内容: ${conflict.existingValue}`;
  }

  db.data_conflicts.update(id, {
    resolvedAt: new Date().toISOString(),
    resolvedBy,
    resolution: resolutionNotes
  });

  const result = getConflictById(id);
  
  if (result && resolution === 'use_feedback' && result.feedbackId) {
    db.resident_feedbacks.update(result.feedbackId, {
      status: 'in_progress'
    });
  }

  return result;
}

export function getConflictDetail(conflictId: number) {
  const conflict = getConflictById(conflictId);
  if (!conflict) return null;

  const feedback = conflict.feedbackId ? db.resident_feedbacks.get(conflict.feedbackId) : null;
  const relatedFeedback = conflict.relatedFeedbackId ? 
    db.resident_feedbacks.get(conflict.relatedFeedbackId) : null;

  return {
    conflict,
    feedback,
    relatedFeedback
  };
}
