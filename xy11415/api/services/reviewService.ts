import { getDatabase } from '../database/init.js';
import crypto from 'crypto';
import { BatchStatus } from '../../shared/types.js';
import { createAuditLog } from './auditService.js';

export function reviewBatch(
  batchId: string,
  action: 'approve' | 'reject',
  reason: string,
  reviewedBy: string,
  reviewedByName: string,
  evidenceAttachments?: string[],
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  if (batch.status !== BatchStatus.PENDING_REVIEW) {
    db.close();
    throw new Error('只有待复核的批次才能进行复核操作');
  }

  const newStatus = action === 'approve' 
    ? BatchStatus.REVIEW_APPROVED 
    : BatchStatus.REVIEW_REJECTED;

  const now = new Date().toISOString();
  const reviewRecordId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO review_records (
      id, batch_id, original_status, new_status, reason,
      reviewed_by, reviewed_at, evidence_attachments
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reviewRecordId,
    batchId,
    batch.status,
    newStatus,
    reason,
    reviewedBy,
    now,
    evidenceAttachments ? JSON.stringify(evidenceAttachments) : null
  );

  db.prepare(`
    INSERT INTO status_transitions (
      id, batch_id, from_status, to_status, transition_type,
      reason, operated_by, operated_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    batchId,
    batch.status,
    newStatus,
    'manual',
    reason,
    reviewedBy,
    now,
    ipAddress || null
  );

  db.prepare(`
    UPDATE batches SET status = ?, updated_at = ? WHERE id = ?
  `).run(newStatus, now, batchId);

  createAuditLog({
    userId: reviewedBy,
    userName: reviewedByName,
    action: `review:${action}`,
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    batchId,
    previousStatus: batch.status,
    newStatus,
    reviewRecordId
  };
}

export function getReviewRecords(batchId: string) {
  const db = getDatabase();
  const records = db.prepare(`
    SELECT rr.*, u.real_name as reviewed_by_name
    FROM review_records rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
    WHERE rr.batch_id = ? ORDER BY reviewed_at DESC
  `).all(batchId);
  db.close();
  return records;
}

export function getPendingReviewBatches(page: number = 1, pageSize: number = 20) {
  const db = getDatabase();
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM batches WHERE status = ?
  `);
  const totalResult = countStmt.get(BatchStatus.PENDING_REVIEW) as { total: number };

  const offset = (page - 1) * pageSize;

  const batches = db.prepare(`
    SELECT b.*, u.real_name as created_by_name
    FROM batches b
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.status = ?
    ORDER BY b.created_at DESC LIMIT ? OFFSET ?
  `).all(BatchStatus.PENDING_REVIEW, pageSize, offset).map((b: any) => ({
    ...b,
    createdByName: b.created_by_name
  }));

  db.close();

  return {
    batches,
    total: totalResult.total,
    page,
    pageSize,
    totalPages: Math.ceil(totalResult.total / pageSize)
  };
}

export function getReviewReasonStats() {
  const db = getDatabase();
  const reasons = db.prepare(`
    SELECT reason, COUNT(*) as count
    FROM review_records
    GROUP BY reason
    ORDER BY count DESC
    LIMIT 10
  `).all();
  db.close();
  return reasons.map((r: any) => ({
    reason: r.reason,
    count: r.count
  }));
}
