const { runQuery, getQuery, allQuery } = require('../database/db');
const { createLog } = require('./operationLogService');

const getAllQueues = async (filters = {}) => {
  let sql = `
    SELECT q.*, tt.name as table_type_name, tt.capacity, t.table_number
    FROM queue_numbers q
    LEFT JOIN table_types tt ON q.table_type_id = tt.id
    LEFT JOIN tables t ON q.assigned_table_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    sql += ' AND q.status = ?';
    params.push(filters.status);
  }
  if (filters.table_type_id) {
    sql += ' AND q.table_type_id = ?';
    params.push(filters.table_type_id);
  }

  sql += ' ORDER BY q.created_at DESC';
  return await allQuery(sql, params);
};

const getQueueById = async (id) => {
  return await getQuery(`
    SELECT q.*, tt.name as table_type_name, tt.capacity
    FROM queue_numbers q
    LEFT JOIN table_types tt ON q.table_type_id = tt.id
    WHERE q.id = ?
  `, [id]);
};

const createQueue = async (data, operator) => {
  const result = await runQuery(
    `INSERT INTO queue_numbers 
     (queue_number, party_size, customer_name, phone, table_type_id, status, checkin_time) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.queue_number,
      data.party_size,
      data.customer_name || '',
      data.phone || '',
      data.table_type_id,
      'waiting',
      new Date().toISOString()
    ]
  );
  await createLog('CREATE', 'queue_numbers', result.id, null, data, operator, '创建排号');
  return result;
};

const updateQueue = async (id, data, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    `UPDATE queue_numbers 
     SET party_size = ?, customer_name = ?, phone = ?, table_type_id = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [data.party_size, data.customer_name || '', data.phone || '', data.table_type_id, id]
  );
  await createLog('UPDATE', 'queue_numbers', id, oldData, data, operator, '更新排号信息');
  return result;
};

const callQueue = async (id, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    'UPDATE queue_numbers SET status = ?, call_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['calling', new Date().toISOString(), id]
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status }, { status: 'calling' }, operator, '呼叫排号');
  return result;
};

const seatQueue = async (id, tableId, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    `UPDATE queue_numbers 
     SET status = ?, assigned_table_id = ?, seating_time = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    ['seated', tableId, new Date().toISOString(), id]
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status, assigned_table_id: oldData.assigned_table_id }, 
    { status: 'seated', assigned_table_id: tableId }, operator, '安排入座');
  return result;
};

const completeQueue = async (id, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    'UPDATE queue_numbers SET status = ?, completed_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['completed', new Date().toISOString(), id]
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status }, { status: 'completed' }, operator, '完成用餐');
  return result;
};

const cancelQueue = async (id, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    'UPDATE queue_numbers SET status = ?, cancelled_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['cancelled', new Date().toISOString(), id]
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status }, { status: 'cancelled' }, operator, '取消排号');
  return result;
};

const skipQueue = async (id, reason, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    'UPDATE queue_numbers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['skipped', id]
  );
  await runQuery(
    'INSERT INTO skip_records (queue_id, skip_count, skip_reason, skipped_by, status) VALUES (?, ?, ?, ?, ?)',
    [id, 1, reason, operator, 'skipped']
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status }, { status: 'skipped' }, operator, '过号处理');
  return result;
};

const restoreQueue = async (id, operator) => {
  const oldData = await getQueueById(id);
  const result = await runQuery(
    'UPDATE queue_numbers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['waiting', id]
  );
  await runQuery(
    'UPDATE skip_records SET status = ?, restored_at = ?, restored_by = ? WHERE queue_id = ? AND status = ?',
    ['restored', new Date().toISOString(), operator, id, 'skipped']
  );
  await createLog('UPDATE', 'queue_numbers', id, { status: oldData.status }, { status: 'waiting' }, operator, '过号恢复');
  return result;
};

const getWaitingCount = async (tableTypeId = null) => {
  let sql = 'SELECT COUNT(*) as count FROM queue_numbers WHERE status = "waiting"';
  const params = [];
  if (tableTypeId) {
    sql += ' AND table_type_id = ?';
    params.push(tableTypeId);
  }
  const result = await getQuery(sql, params);
  return result.count;
};

module.exports = {
  getAllQueues,
  getQueueById,
  createQueue,
  updateQueue,
  callQueue,
  seatQueue,
  completeQueue,
  cancelQueue,
  skipQueue,
  restoreQueue,
  getWaitingCount
};
