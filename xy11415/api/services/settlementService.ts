import { getDatabase } from '../database/init.js';
import crypto from 'crypto';
import { BatchStatus } from '../../shared/types.js';
import { createAuditLog } from './auditService.js';
import * as XLSX from 'xlsx';

export function freezeBatch(
  batchId: string,
  operatedBy: string,
  operatedByName: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  if (batch.status !== BatchStatus.REVIEW_APPROVED) {
    db.close();
    throw new Error('只有复核通过的批次才能冻结');
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE batches 
    SET status = ?, status_before_freeze = ?, frozen_at = ?, frozen_by = ?, updated_at = ?
    WHERE id = ?
  `).run(
    BatchStatus.FROZEN,
    batch.status,
    now,
    operatedBy,
    now,
    batchId
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
    BatchStatus.FROZEN,
    'manual',
    '项目经理冻结结算',
    operatedBy,
    now,
    ipAddress || null
  );

  createAuditLog({
    userId: operatedBy,
    userName: operatedByName,
    action: 'settlement:freeze',
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    batchId,
    previousStatus: batch.status,
    newStatus: BatchStatus.FROZEN
  };
}

export function unfreezeBatch(
  batchId: string,
  operatedBy: string,
  operatedByName: string,
  reason: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status, status_before_freeze FROM batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  if (batch.status !== BatchStatus.FROZEN) {
    db.close();
    throw new Error('只有已冻结的批次才能解冻');
  }

  const now = new Date().toISOString();
  const newStatus = batch.status_before_freeze || BatchStatus.REVIEW_APPROVED;

  db.prepare(`
    UPDATE batches 
    SET status = ?, status_before_freeze = NULL, frozen_at = NULL, frozen_by = NULL, updated_at = ?
    WHERE id = ?
  `).run(newStatus, now, batchId);

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
    `解冻: ${reason}`,
    operatedBy,
    now,
    ipAddress || null
  );

  createAuditLog({
    userId: operatedBy,
    userName: operatedByName,
    action: 'settlement:unfreeze',
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    batchId,
    previousStatus: batch.status,
    newStatus
  };
}

export function settleBatch(
  batchId: string,
  operatedBy: string,
  operatedByName: string,
  ipAddress?: string
) {
  const db = getDatabase();
  
  const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId) as any;
  if (!batch) {
    db.close();
    throw new Error('批次不存在');
  }

  if (batch.status !== BatchStatus.FROZEN) {
    db.close();
    throw new Error('只有已冻结的批次才能结算');
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE batches SET status = ?, updated_at = ? WHERE id = ?
  `).run(BatchStatus.SETTLED, now, batchId);

  db.prepare(`
    INSERT INTO status_transitions (
      id, batch_id, from_status, to_status, transition_type,
      reason, operated_by, operated_at, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    batchId,
    batch.status,
    BatchStatus.SETTLED,
    'manual',
    '财务结算完成',
    operatedBy,
    now,
    ipAddress || null
  );

  createAuditLog({
    userId: operatedBy,
    userName: operatedByName,
    action: 'settlement:settle',
    resourceType: 'batch',
    resourceId: batchId,
    ipAddress,
    success: true
  });

  db.close();

  return {
    batchId,
    previousStatus: batch.status,
    newStatus: BatchStatus.SETTLED
  };
}

export function getFrozenBatches(page: number = 1, pageSize: number = 20) {
  const db = getDatabase();
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total FROM batches WHERE status = ?
  `);
  const totalResult = countStmt.get(BatchStatus.FROZEN) as { total: number };

  const offset = (page - 1) * pageSize;

  const batches = db.prepare(`
    SELECT b.*, u1.real_name as created_by_name, u2.real_name as frozen_by_name
    FROM batches b
    LEFT JOIN users u1 ON b.created_by = u1.id
    LEFT JOIN users u2 ON b.frozen_by = u2.id
    WHERE b.status = ?
    ORDER BY b.frozen_at DESC LIMIT ? OFFSET ?
  `).all(BatchStatus.FROZEN, pageSize, offset).map((b: any) => ({
    ...b,
    createdByName: b.created_by_name,
    frozenByName: b.frozen_by_name
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

export function getFreezeComparison(batchId: string) {
  const db = getDatabase();
  
  const batch = db.prepare(`
    SELECT b.*, 
           u1.real_name as created_by_name, 
           u2.real_name as frozen_by_name
    FROM batches b
    LEFT JOIN users u1 ON b.created_by = u1.id
    LEFT JOIN users u2 ON b.frozen_by = u2.id
    WHERE b.id = ?
  `).get(batchId) as any;

  if (!batch) {
    db.close();
    return null;
  }

  const transitions = db.prepare(`
    SELECT st.*, u.real_name as operated_by_name
    FROM status_transitions st
    LEFT JOIN users u ON st.operated_by = u.id
    WHERE st.batch_id = ?
    ORDER BY operated_at
  `).all(batchId);

  const reviewRecords = db.prepare(`
    SELECT rr.*, u.real_name as reviewed_by_name
    FROM review_records rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
    WHERE rr.batch_id = ?
    ORDER BY reviewed_at DESC
  `).all(batchId);

  db.close();

  return {
    batch: {
      ...batch,
      createdByName: batch.created_by_name,
      frozenByName: batch.frozen_by_name
    },
    transitions,
    reviewRecords,
    statusBeforeFreeze: batch.status_before_freeze
  };
}

export function exportReport(batchIds?: string[]) {
  const db = getDatabase();
  
  let query = `
    SELECT 
      b.batch_no,
      b.title,
      b.status,
      b.status_before_freeze,
      b.created_at,
      u1.real_name as created_by,
      u2.real_name as frozen_by,
      b.frozen_at,
      b.remark
    FROM batches b
    LEFT JOIN users u1 ON b.created_by = u1.id
    LEFT JOIN users u2 ON b.frozen_by = u2.id
  `;

  let params: any[] = [];
  if (batchIds && batchIds.length > 0) {
    query += ` WHERE b.id IN (${batchIds.map(() => '?').join(',')})`;
    params = batchIds;
  }

  query += ' ORDER BY b.created_at DESC';

  const batches = db.prepare(query).all(...params);

  const reviewQuery = `
    SELECT 
      batch_id,
      reason,
      new_status,
      u.real_name as reviewed_by,
      reviewed_at
    FROM review_records rr
    LEFT JOIN users u ON rr.reviewed_by = u.id
  `;
  
  const reviewRecords = db.prepare(reviewQuery).all();
  
  const reviewMap = new Map();
  for (const record of reviewRecords) {
    const r = record as any;
    if (!reviewMap.has(r.batch_id)) {
      reviewMap.set(r.batch_id, []);
    }
    reviewMap.get(r.batch_id).push(r);
  }

  db.close();

  const exportData = (batches as any[]).map(batch => ({
    '批次号': batch.batch_no,
    '标题': batch.title,
    '当前状态': batch.status,
    '冻结前状态': batch.status_before_freeze || '-',
    '创建人': batch.created_by,
    '创建时间': batch.created_at,
    '冻结人': batch.frozen_by || '-',
    '冻结时间': batch.frozen_at || '-',
    '备注': batch.remark || '',
    '改判记录': (reviewMap.get(batch.id) || [])
      .map((r: any) => `${r.reviewed_by} ${r.reviewed_at}: ${r.reason}`)
      .join('; ')
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  ws['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
    { wch: 30 },
    { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '批次汇总');

  return wb;
}
