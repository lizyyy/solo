import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll } from '../database';
import { Reconciliation, ReviewRecord, ReviewAction, SampleStatus, Discrepancy } from '../types';
import { performReconciliation } from './reconciliationService';

export async function createReconciliation(
  batchId: string,
  name: string,
  createdBy: string,
  csvImportId?: string,
  jsonImportId?: string
): Promise<Reconciliation> {
  const now = new Date().toISOString();
  const id = uuidv4();

  await runQuery(
    `INSERT INTO reconciliations 
     (id, batch_id, name, status, total_samples, matched_samples, mismatched_samples,
      pending_samples, discrepancies_count, resolved_discrepancies,
      csv_import_id, json_import_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?)`,
    [id, batchId, name, csvImportId || null, jsonImportId || null, createdBy, now, now]
  );

  return {
    id,
    batch_id: batchId,
    name,
    status: 'draft',
    total_samples: 0,
    matched_samples: 0,
    mismatched_samples: 0,
    pending_samples: 0,
    discrepancies_count: 0,
    resolved_discrepancies: 0,
    csv_import_id: csvImportId,
    json_import_id: jsonImportId,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };
}

export async function getReconciliation(id: string): Promise<Reconciliation | undefined> {
  return getOne<Reconciliation>(`SELECT * FROM reconciliations WHERE id = ?`, [id]);
}

export async function getReconciliations(): Promise<Reconciliation[]> {
  return getAll<Reconciliation>(`SELECT * FROM reconciliations ORDER BY created_at DESC`);
}

export async function updateReconciliation(
  id: string,
  updates: Partial<Reconciliation>
): Promise<Reconciliation | undefined> {
  const existing = await getReconciliation(id);
  if (!existing) return undefined;

  const fields: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'created_at' && value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());

  if (fields.length > 0) {
    await runQuery(
      `UPDATE reconciliations SET ${fields.join(', ')} WHERE id = ?`,
      [...params, id]
    );
  }

  return getReconciliation(id);
}

export async function deleteReconciliation(id: string): Promise<boolean> {
  await runQuery(`DELETE FROM review_records WHERE reconciliation_id = ?`, [id]);
  await runQuery(`DELETE FROM discrepancies WHERE reconciliation_id = ?`, [id]);
  const result = await runQuery(`DELETE FROM reconciliations WHERE id = ?`, [id]);
  return result.changes > 0;
}

export async function startReconciliation(id: string): Promise<Reconciliation | undefined> {
  const reconciliation = await getReconciliation(id);
  if (!reconciliation) return undefined;

  await updateReconciliation(id, { status: 'processing' });
  await performReconciliation(id, reconciliation.batch_id);

  return getReconciliation(id);
}

const ACTION_TO_STATUS: Record<ReviewAction, SampleStatus> = {
  approve: 'approved',
  reject: 'rejected',
  supplement: 'supplement',
};

export async function reviewSample(
  reconciliationId: string,
  sampleNo: string,
  action: ReviewAction,
  reviewer: string,
  comment: string,
  discrepancyIds?: string[]
): Promise<ReviewRecord | undefined> {
  const reconciliation = await getReconciliation(reconciliationId);
  if (!reconciliation) return undefined;

  const sample = await getOne(
    `SELECT * FROM sample_records WHERE sample_no = ? AND batch_id = ?`,
    [sampleNo, reconciliation.batch_id]
  ) as any;

  if (!sample) return undefined;

  const previousStatus = sample.status;
  const newStatus = ACTION_TO_STATUS[action];
  const now = new Date().toISOString();
  const reviewId = uuidv4();

  await runQuery(
    `UPDATE sample_records SET status = ?, updated_at = ? WHERE id = ?`,
    [newStatus, now, sample.id]
  );

  const record: ReviewRecord = {
    id: reviewId,
    reconciliation_id: reconciliationId,
    sample_no: sampleNo,
    discrepancy_id: discrepancyIds?.[0],
    action,
    reviewer,
    comment,
    previous_status: previousStatus,
    new_status: newStatus,
    created_at: now,
  };

  await runQuery(
    `INSERT INTO review_records 
     (id, reconciliation_id, sample_no, discrepancy_id, action, reviewer, comment,
      previous_status, new_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.reconciliation_id, record.sample_no, record.discrepancy_id || null,
     record.action, record.reviewer, record.comment, record.previous_status,
     record.new_status, record.created_at]
  );

  if (discrepancyIds && discrepancyIds.length > 0) {
    for (const discrepancyId of discrepancyIds) {
      await runQuery(
        `UPDATE discrepancies SET 
         resolved = 1, resolved_by = ?, resolved_at = ?, resolution_note = ?
         WHERE id = ? AND reconciliation_id = ?`,
        [reviewer, now, comment, discrepancyId, reconciliationId]
      );
    }

    const resolvedCount = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM discrepancies WHERE reconciliation_id = ? AND resolved = 1`,
      [reconciliationId]
    );

    await runQuery(
      `UPDATE reconciliations SET resolved_discrepancies = ?, updated_at = ? WHERE id = ?`,
      [resolvedCount?.count || 0, now, reconciliationId]
    );
  }

  return record;
}

export async function getReviewRecords(
  reconciliationId: string,
  sampleNo?: string
): Promise<ReviewRecord[]> {
  if (sampleNo) {
    return getAll<ReviewRecord>(
      `SELECT * FROM review_records WHERE reconciliation_id = ? AND sample_no = ? ORDER BY created_at DESC`,
      [reconciliationId, sampleNo]
    );
  }
  return getAll<ReviewRecord>(
    `SELECT * FROM review_records WHERE reconciliation_id = ? ORDER BY created_at DESC`,
    [reconciliationId]
  );
}

export async function getSamplesWithStatus(
  reconciliationId: string,
  status?: SampleStatus
): Promise<any[]> {
  const reconciliation = await getReconciliation(reconciliationId);
  if (!reconciliation) return [];

  let query = `SELECT s.*, 
    (SELECT COUNT(*) FROM discrepancies d WHERE d.reconciliation_id = ? AND d.sample_no = s.sample_no) as discrepancy_count,
    (SELECT COUNT(*) FROM discrepancies d WHERE d.reconciliation_id = ? AND d.sample_no = s.sample_no AND d.resolved = 1) as resolved_count
    FROM sample_records s WHERE s.batch_id = ?`;
  const params: any[] = [reconciliationId, reconciliationId, reconciliation.batch_id];

  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY s.sample_no`;

  return getAll(query, params);
}

export async function recalculateReconciliation(reconciliationId: string): Promise<Reconciliation | undefined> {
  const reconciliation = await getReconciliation(reconciliationId);
  if (!reconciliation) return undefined;

  await performReconciliation(reconciliationId, reconciliation.batch_id);
  return getReconciliation(reconciliationId);
}
