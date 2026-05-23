const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');

function generateBatchNo(sourceType) {
  const dateStr = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${sourceType.toUpperCase()}-${dateStr}-${random}`;
}

function createBatch(sourceType, operator, mergeStrategy = config.mergeStrategy.APPEND, remark = null) {
  const db = getDatabase();
  
  const batch = {
    id: uuidv4(),
    batch_no: generateBatchNo(sourceType),
    source_type: sourceType,
    operator_id: operator.id,
    operator_name: operator.name,
    merge_strategy: mergeStrategy,
    status: 'processing',
    total_count: 0,
    success_count: 0,
    fail_count: 0,
    remark,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO batches (id, batch_no, source_type, operator_id, operator_name, merge_strategy, status, total_count, success_count, fail_count, remark, created_at, updated_at)
    VALUES (@id, @batch_no, @source_type, @operator_id, @operator_name, @merge_strategy, @status, @total_count, @success_count, @fail_count, @remark, @created_at, @updated_at)
  `);

  stmt.run(batch);
  
  return batch;
}

function updateBatchStats(batchId, totalCount, successCount, failCount, status = 'completed') {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE batches 
    SET total_count = ?, success_count = ?, fail_count = ?, status = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(totalCount, successCount, failCount, status, dayjs().valueOf(), batchId);
}

function getBatchById(batchId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM batches WHERE id = ?');
  const batch = stmt.get(batchId);
  
  if (batch) {
    batch.created_at = dayjs(batch.created_at).format('YYYY-MM-DD HH:mm:ss');
    batch.updated_at = dayjs(batch.updated_at).format('YYYY-MM-DD HH:mm:ss');
  }
  
  return batch;
}

function getBatchList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];

  if (filters.source_type) {
    sql += ' AND source_type = ?';
    params.push(filters.source_type);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.operator_id) {
    sql += ' AND operator_id = ?';
    params.push(filters.operator_id);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const batches = stmt.all(...params);

  return batches.map(batch => ({
    ...batch,
    created_at: dayjs(batch.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(batch.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

module.exports = {
  createBatch,
  updateBatchStats,
  getBatchById,
  getBatchList,
  generateBatchNo,
};
