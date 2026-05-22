import { getDatabase } from '../database/init.js';
import { BatchStatus } from '../../shared/types.js';
import { getPermissionDeniedCount } from './auditService.js';
import { getReviewReasonStats } from './reviewService.js';

export function getSummaryReport() {
  const db = getDatabase();

  const statusCounts: Record<string, number> = {} as any;
  for (const status of Object.values(BatchStatus)) {
    statusCounts[status] = 0;
  }

  const statusResults = db.prepare(`
    SELECT status, COUNT(*) as count FROM batches GROUP BY status
  `).all();

  for (const result of statusResults) {
    const r = result as any;
    statusCounts[r.status] = r.count;
  }

  const frozenBeforeCounts: Record<string, number> = {} as any;
  for (const status of Object.values(BatchStatus)) {
    frozenBeforeCounts[status] = 0;
  }

  const frozenBeforeResults = db.prepare(`
    SELECT status_before_freeze, COUNT(*) as count 
    FROM batches 
    WHERE status_before_freeze IS NOT NULL
    GROUP BY status_before_freeze
  `).all();

  for (const result of frozenBeforeResults) {
    const r = result as any;
    if (r.status_before_freeze) {
      frozenBeforeCounts[r.status_before_freeze] = r.count;
    }
  }

  const totalResult = db.prepare('SELECT COUNT(*) as count FROM batches').get() as { count: number };
  
  const timeResult = db.prepare(`
    SELECT 
      AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) * 24 as avg_hours
    FROM batches 
    WHERE status IN (?, ?, ?)
  `).get(BatchStatus.SETTLED, BatchStatus.ARCHIVED, BatchStatus.FROZEN) as { avg_hours: number };

  const reviewReasons = getReviewReasonStats();
  const permissionDeniedCount = getPermissionDeniedCount();

  db.close();

  return {
    totalBatches: totalResult.count,
    statusCounts,
    frozenBeforeStatus: frozenBeforeCounts,
    reviewReasons,
    permissionDeniedCount,
    avgProcessingTime: timeResult.avg_hours || 0
  };
}
