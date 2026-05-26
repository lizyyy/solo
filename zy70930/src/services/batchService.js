const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../database');
const { ReconciliationEngine } = require('./reconciliationEngine');
const auditService = require('./auditService');

const BATCH_STATUS = {
  DRAFT: 'draft',
  IMPORTING: 'importing',
  READY: 'ready',
  RECONCILING: 'reconciling',
  RECONCILED: 'reconciled',
  REVIEWING: 'reviewing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const REVIEW_RESULTS = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  NEED_MORE_INFO: 'need_more_info'
};

async function createBatch(name, storeId, periodStart, periodEnd, userId, userName) {
  const batchId = uuidv4();
  const batchNo = `BATCH-${moment().format('YYYYMMDDHHmmss')}`;

  await db.run(`
    INSERT INTO reconciliation_batches
    (id, batch_no, name, store_id, period_start, period_end, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [batchId, batchNo, name, storeId, periodStart, periodEnd, BATCH_STATUS.DRAFT, userId]);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.BATCH_CREATED,
    { batchNo, name, storeId, periodStart, periodEnd },
    null, null, batchId, null
  );

  return { batchId, batchNo };
}

async function updateBatchStatus(batchId, newStatus, userId, userName) {
  const batch = await db.get('SELECT * FROM reconciliation_batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const oldStatus = batch.status;
  await db.run(`
    UPDATE reconciliation_batches 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [newStatus, batchId]);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.BATCH_STATUS_CHANGED,
    { batchNo: batch.batch_no },
    oldStatus, newStatus, batchId, null
  );

  return true;
}

async function runReconciliation(batchId, userId, userName) {
  const batch = await db.get('SELECT * FROM reconciliation_batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const pkgCount = await db.get('SELECT COUNT(*) as count FROM packages WHERE reconciliation_batch_id = ?', [batchId]);
  const woCount = await db.get('SELECT COUNT(*) as count FROM work_orders WHERE reconciliation_batch_id = ?', [batchId]);
  const invCount = await db.get('SELECT COUNT(*) as count FROM inventory WHERE reconciliation_batch_id = ?', [batchId]);

  await db.run(`
    UPDATE reconciliation_batches 
    SET total_packages = ?, total_work_orders = ?, total_inventory_items = ?, status = ?
    WHERE id = ?
  `, [pkgCount.count, woCount.count, invCount.count, BATCH_STATUS.RECONCILING, batchId]);

  const engine = new ReconciliationEngine(batchId);
  const result = await engine.runReconciliation();

  await updateBatchStatus(batchId, BATCH_STATUS.RECONCILED, userId, userName);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.RECONCILIATION_RUN,
    { batchNo: batch.batch_no, stats: result.stats },
    null, result, batchId, null
  );

  return result;
}

async function reviewRecord(recordId, reviewResult, reviewComment, userId, userName) {
  const record = await db.get('SELECT * FROM reconciliation_records WHERE id = ?', [recordId]);
  if (!record) {
    throw new Error('记录不存在');
  }

  await db.run(`
    UPDATE reconciliation_records 
    SET review_status = 'reviewed', review_result = ?, review_comment = ?, 
        reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [reviewResult, reviewComment, userId, recordId]);

  if (reviewResult === REVIEW_RESULTS.APPROVED) {
    await db.run(`
      UPDATE reconciliation_discrepancies 
      SET is_resolved = 1, resolution_comment = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE record_id = ? AND is_resolved = 0
    `, [reviewComment || '复核通过，差异已处理', userId, recordId]);
  }

  const batch = await db.get('SELECT * FROM reconciliation_batches WHERE id = ?', [record.batch_id]);
  await recalculateBatchStats(record.batch_id);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.RECORD_REVIEWED,
    { recordId, reviewResult, reviewComment },
    record.review_status, 'reviewed', record.batch_id, recordId
  );

  return true;
}

async function resolveDiscrepancy(discrepancyId, resolutionComment, userId, userName) {
  const disc = await db.get('SELECT * FROM reconciliation_discrepancies WHERE id = ?', [discrepancyId]);
  if (!disc) {
    throw new Error('差异不存在');
  }

  await db.run(`
    UPDATE reconciliation_discrepancies 
    SET is_resolved = 1, resolution_comment = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [resolutionComment, userId, discrepancyId]);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.DISCREPANCY_RESOLVED,
    { discrepancyId, resolutionComment },
    null, null, disc.batch_id, disc.record_id
  );

  return true;
}

async function recalculateBatchStats(batchId) {
  const totalRecords = await db.get('SELECT COUNT(*) as count FROM reconciliation_records WHERE batch_id = ?', [batchId]);
  const reviewedRecords = await db.get('SELECT COUNT(*) as count FROM reconciliation_records WHERE batch_id = ? AND review_status = "reviewed"', [batchId]);
  const unresolvedDisc = await db.get('SELECT COUNT(*) as count FROM reconciliation_discrepancies WHERE batch_id = ? AND is_resolved = 0', [batchId]);
  const matchedRecords = await db.get('SELECT COUNT(*) as count FROM reconciliation_records WHERE batch_id = ? AND status = "matched"', [batchId]);

  await db.run(`
    UPDATE reconciliation_batches 
    SET reviewed_count = ?, discrepancy_count = ?, matched_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [reviewedRecords.count, unresolvedDisc.count, matchedRecords.count, batchId]);

  return true;
}

async function completeBatch(batchId, userId, userName) {
  const batch = await db.get('SELECT * FROM reconciliation_batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const unresolvedDisc = await db.get('SELECT COUNT(*) as count FROM reconciliation_discrepancies WHERE batch_id = ? AND is_resolved = 0', [batchId]);
  if (unresolvedDisc.count > 0) {
    throw new Error(`还有${unresolvedDisc.count}条差异未处理，无法完成对账`);
  }

  await db.run(`
    UPDATE reconciliation_batches 
    SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [BATCH_STATUS.COMPLETED, batchId]);

  await auditService.logAction(
    userId, userName, auditService.ACTIONS.BATCH_COMPLETED,
    { batchNo: batch.batch_no },
    batch.status, BATCH_STATUS.COMPLETED, batchId, null
  );

  return true;
}

async function getBatchList(storeId = null, status = null, limit = 20, offset = 0) {
  let sql = `
    SELECT b.*, s.name as store_name, u.real_name as creator_name
    FROM reconciliation_batches b
    LEFT JOIN stores s ON b.store_id = s.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (storeId) {
    sql += ' AND b.store_id = ?';
    params.push(storeId);
  }
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await db.all(sql, params);
}

async function getBatchDetail(batchId) {
  const batch = await db.get(`
    SELECT b.*, s.name as store_name, u.real_name as creator_name
    FROM reconciliation_batches b
    LEFT JOIN stores s ON b.store_id = s.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.id = ?
  `, [batchId]);

  if (!batch) return null;

  const records = await db.all(`
    SELECT r.*,
      (SELECT COUNT(*) FROM reconciliation_discrepancies d WHERE d.record_id = r.id) as discrepancy_count,
      (SELECT COUNT(*) FROM reconciliation_discrepancies d WHERE d.record_id = r.id AND d.is_resolved = 0) as unresolved_count
    FROM reconciliation_records r
    WHERE r.batch_id = ?
    ORDER BY r.created_at DESC
  `, [batchId]);

  const discrepancies = await db.all(`
    SELECT d.*
    FROM reconciliation_discrepancies d
    WHERE d.batch_id = ?
    ORDER BY d.severity DESC, d.created_at DESC
  `, [batchId]);

  const auditLogs = await auditService.getAuditLogs(batchId);

  return {
    batch,
    records,
    discrepancies,
    auditLogs
  };
}

module.exports = {
  BATCH_STATUS,
  REVIEW_RESULTS,
  createBatch,
  updateBatchStatus,
  runReconciliation,
  reviewRecord,
  resolveDiscrepancy,
  completeBatch,
  getBatchList,
  getBatchDetail,
  recalculateBatchStats
};
