const { run, get, all } = require('../models/database');
const helpers = require('../utils/helpers');

async function createBatch(name, createdBy) {
  const batchNo = helpers.generateBatchNo();
  const result = await run(
    'INSERT INTO batches (batch_no, name, status, created_by) VALUES (?, ?, ?, ?)',
    [batchNo, name, 'pending', createdBy]
  );
  return getBatchById(result.lastID);
}

async function getBatchById(id) {
  return get('SELECT * FROM batches WHERE id = ?', [id]);
}

async function getBatchByNo(batchNo) {
  return get('SELECT * FROM batches WHERE batch_no = ?', [batchNo]);
}

async function listBatches(filters = {}) {
  let query = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
  if (filters.created_by) { query += ' AND created_by = ?'; params.push(filters.created_by); }
  query += ' ORDER BY created_at DESC';
  return all(query, params);
}

async function updateBatchStatus(batchId, status, handledBy, reason) {
  await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, batchId]);
  const orders = await all('SELECT id FROM service_orders WHERE batch_id = ?', [batchId]);
  for (const order of orders) {
    await run(
      'INSERT INTO track_records (record_no, service_order_id, batch_id, status, action, reason, handled_by, source_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [helpers.generateRecordNo(), order.id, batchId, status, 'batch_status_change', reason || '批次状态变更', handledBy, 'batch']
    );
  }
  return getBatchById(batchId);
}

async function getBatchStatistics(batchId) {
  const batch = await getBatchById(batchId);
  if (!batch) return null;
  const stats = await all(
    'SELECT status, COUNT(*) as count FROM service_orders WHERE batch_id = ? GROUP BY status',
    [batchId]
  );
  const statusMap = {};
  for (const stat of stats) statusMap[stat.status] = stat.count;
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
