const db = require('../models/database');
const helpers = require('../utils/helpers');

function createBatch(name, createdBy) {
  const batchNo = helpers.generateBatchNo();
  const insert = db.prepare(`
    INSERT INTO batches (batch_no, name, status, created_by)
    VALUES (?, ?, 'pending', ?)
  `);
  const result = insert.run(batchNo, name, createdBy);
  return getBatchById(result.lastInsertRowid);
}

function getBatchById(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

function getBatchByNo(batchNo) {
  return db.prepare('SELECT * FROM batches WHERE batch_no = ?').get(batchNo);
}

function listBatches(filters = {}) {
  let query = 'SELECT * FROM batches WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.created_by) {
    query += ' AND created_by = ?';
    params.push(filters.created_by);
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

function updateBatchStatus(batchId, status, handledBy, reason) {
  const update = db.prepare(`
    UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);
  update.run(status, batchId);

  const orders = db.prepare('SELECT id FROM service_orders WHERE batch_id = ?').all(batchId);
  const insertTrack = db.prepare(`
    INSERT INTO track_records 
    (record_no, service_order_id, batch_id, status, action, reason, handled_by, source_type)
    VALUES (?, ?, ?, ?, 'batch_status_change', ?, ?, 'batch')
  `);

  for (const order of orders) {
    insertTrack.run(
      helpers.generateRecordNo(), order.id, batchId, status, reason || `批次状态变更为${status}`, handledBy
    );
  }

  return getBatchById(batchId);
}

function getBatchStatistics(batchId) {
  const batch = getBatchById(batchId);
  if (!batch) return null;

  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM service_orders 
    WHERE batch_id = ?
    GROUP BY status
  `).all(batchId);

  const statusMap = {};
  for (const stat of stats) {
    statusMap[stat.status] = stat.count;
  }

  return {
    batch,
    statistics: {
      total: batch.total_count,
      pending: statusMap.pending || 0,
      processing: statusMap.processing || 0,
      approved: statusMap.approved || 0,
      returned: statusMap.returned || 0,
      cancelled: statusMap.cancelled || 0,
      completed: statusMap.completed || 0
    }
  };
}

module.exports = {
  createBatch,
  getBatchById,
  getBatchByNo,
  listBatches,
  updateBatchStatus,
  getBatchStatistics
};
