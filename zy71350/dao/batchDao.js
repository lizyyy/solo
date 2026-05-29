const { getDb } = require('./database');

function createBatch(batchNo, settlementMonth, totalItems, sourceFile, remarks) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO consignment_batches 
    (batch_no, settlement_month, total_items, source_file, remarks, status)
    VALUES (?, ?, ?, ?, ?, 'imported')
  `);
  const result = stmt.run(batchNo, settlementMonth, totalItems, sourceFile, remarks || '');
  return result.lastInsertRowid;
}

function getBatchById(batchId) {
  const db = getDb();
  return db.prepare('SELECT * FROM consignment_batches WHERE id = ?').get(batchId);
}

function getBatchByNo(batchNo) {
  const db = getDb();
  return db.prepare('SELECT * FROM consignment_batches WHERE batch_no = ?').get(batchNo);
}

function updateBatchStatus(batchId, status, processedItems) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE consignment_batches 
    SET status = ?, processed_items = ?, processed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  return stmt.run(status, processedItems, batchId);
}

function listBatches(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM consignment_batches 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit);
}

function getBatchStats(batchId) {
  const db = getDb();
  return db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'imported' THEN 1 ELSE 0 END) as imported,
      SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status = 'authorized' THEN 1 ELSE 0 END) as authorized,
      SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN has_issues = 1 THEN 1 ELSE 0 END) as has_issues,
      SUM(CASE WHEN highest_severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN highest_severity = 'warning' THEN 1 ELSE 0 END) as warning_count,
      COALESCE(SUM(final_commission_amount), 0) as total_commission,
      COALESCE(SUM(final_artist_amount), 0) as total_artist_amount
    FROM consignment_items 
    WHERE batch_id = ?
  `).get(batchId);
}

module.exports = {
  createBatch,
  getBatchById,
  getBatchByNo,
  updateBatchStatus,
  listBatches,
  getBatchStats
};
