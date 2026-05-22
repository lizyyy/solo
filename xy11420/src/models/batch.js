const { run, get, all, transaction } = require('../db');
const { v4: uuidv4 } = require('uuid');

function generateBatchNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PB${dateStr}${random}`;
}

function createBatch(data, userId) {
  const batchNo = data.batch_no || generateBatchNo();
  
  const result = run(
    `INSERT INTO batches 
     (batch_no, vin, plate_number, car_model, status, entry_user_id, current_return_count)
     VALUES (?, ?, ?, ?, 'draft', ?, 1)`,
    [batchNo, data.vin, data.plate_number, data.car_model, userId]
  );
  
  run(
    `INSERT INTO status_history (batch_id, from_status, to_status, operator_id, reason)
     VALUES (?, NULL, 'draft', ?, '批次创建')`,
    [result.lastID, userId]
  );
  
  return getBatchById(result.lastID);
}

function getBatchById(id) {
  return get(
    `SELECT b.*, 
            u1.real_name as entry_user_name,
            u2.real_name as reviewer_name,
            u3.real_name as manager_name
     FROM batches b
     LEFT JOIN users u1 ON b.entry_user_id = u1.id
     LEFT JOIN users u2 ON b.reviewer_id = u2.id
     LEFT JOIN users u3 ON b.manager_id = u3.id
     WHERE b.id = ?`,
    [id]
  );
}

function getBatchByNo(batchNo) {
  return get('SELECT * FROM batches WHERE batch_no = ?', [batchNo]);
}

function listBatches(filters = {}, page = 1, pageSize = 20) {
  const conditions = [];
  const params = [];
  
  if (filters.vin) {
    conditions.push('b.vin LIKE ?');
    params.push(`%${filters.vin}%`);
  }
  if (filters.status) {
    conditions.push('b.status = ?');
    params.push(filters.status);
  }
  if (filters.plate_number) {
    conditions.push('b.plate_number LIKE ?');
    params.push(`%${filters.plate_number}%`);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const total = get(
    `SELECT COUNT(*) as count FROM batches b ${whereClause}`,
    params
  );
  
  const offset = (page - 1) * pageSize;
  const items = all(
    `SELECT b.*, 
            u1.real_name as entry_user_name
     FROM batches b
     LEFT JOIN users u1 ON b.entry_user_id = u1.id
     ${whereClause}
     ORDER BY b.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  
  return {
    items,
    total: total.count,
    page,
    pageSize
  };
}

function updateBatchStatus(batchId, newStatus, operatorId, reason = '', details = {}) {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  run(
    `UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newStatus, batchId]
  );
  
  run(
    `INSERT INTO status_history (batch_id, from_status, to_status, operator_id, reason, change_details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [batchId, batch.status, newStatus, operatorId, reason, JSON.stringify(details)]
  );
  
  return getBatchById(batchId);
}

function freezeBatch(batchId, operatorId, reason) {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  run(
    `UPDATE batches 
     SET status = 'frozen', 
         frozen_status = ?, 
         freeze_reason = ?, 
         freeze_time = CURRENT_TIMESTAMP,
         manager_id = ?,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [batch.status, reason, operatorId, batchId]
  );
  
  run(
    `INSERT INTO status_history (batch_id, from_status, to_status, operator_id, reason)
     VALUES (?, ?, 'frozen', ?, ?)`,
    [batchId, batch.status, operatorId, reason]
  );
  
  return getBatchById(batchId);
}

function unfreezeBatch(batchId, operatorId, reason) {
  const batch = getBatchById(batchId);
  if (!batch || batch.status !== 'frozen') {
    throw new Error('批次不存在或未冻结');
  }
  
  const targetStatus = batch.frozen_status || 'draft';
  
  run(
    `UPDATE batches 
     SET status = ?, 
         freeze_reason = NULL, 
         freeze_time = NULL,
         frozen_status = NULL,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [targetStatus, batchId]
  );
  
  run(
    `INSERT INTO status_history (batch_id, from_status, to_status, operator_id, reason)
     VALUES (?, 'frozen', ?, ?, ?)`,
    [batchId, targetStatus, operatorId, reason]
  );
  
  return getBatchById(batchId);
}

function archiveBatch(batchId, operatorId, reason) {
  return updateBatchStatus(batchId, 'archived', operatorId, reason);
}

function cancelBatch(batchId, operatorId, reason) {
  return updateBatchStatus(batchId, 'cancelled', operatorId, reason);
}

function getBatchHistory(batchId) {
  return all(
    `SELECT sh.*, u.real_name as operator_name
     FROM status_history sh
     LEFT JOIN users u ON sh.operator_id = u.id
     WHERE sh.batch_id = ?
     ORDER BY sh.created_at ASC`,
    [batchId]
  );
}

function getBatchDetails(batchId) {
  const batch = getBatchById(batchId);
  if (!batch) return null;
  
  const inspections = all('SELECT * FROM inspection_orders WHERE batch_id = ? ORDER BY created_at', [batchId]);
  const quotes = all('SELECT * FROM repair_quotes WHERE batch_id = ? ORDER BY created_at', [batchId]);
  const photos = all('SELECT * FROM photo_lists WHERE batch_id = ? ORDER BY created_at', [batchId]);
  const scans = all('SELECT * FROM scan_details WHERE batch_id = ? ORDER BY created_at', [batchId]);
  const history = getBatchHistory(batchId);
  const returns = all('SELECT * FROM return_records WHERE batch_id = ? ORDER BY return_number', [batchId]);
  
  return {
    batch,
    inspections,
    quotes,
    photos,
    scans,
    history,
    returns,
    returnCount: returns.length,
    inspectionCount: inspections.length,
    quoteCount: quotes.length,
    photoCount: photos.length,
    scanCount: scans.length
  };
}

function addReturnRecord(batchId, data, operatorId) {
  const batch = getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  const returnNumber = batch.current_return_count + 1;
  
  run(
    `INSERT INTO return_records 
     (batch_id, vin, return_number, return_reason, return_date, responsible_person, additional_cost, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchId, batch.vin, returnNumber, data.return_reason, data.return_date, 
     data.responsible_person, data.additional_cost || 0, data.remarks]
  );
  
  run(
    `UPDATE batches SET current_return_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [returnNumber, batchId]
  );
  
  return get('SELECT * FROM return_records WHERE batch_id = ? AND return_number = ?', [batchId, returnNumber]);
}

module.exports = {
  createBatch,
  getBatchById,
  getBatchByNo,
  listBatches,
  updateBatchStatus,
  freezeBatch,
  unfreezeBatch,
  archiveBatch,
  cancelBatch,
  getBatchHistory,
  getBatchDetails,
  addReturnRecord,
  generateBatchNo
};
