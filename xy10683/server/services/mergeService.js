const { runQuery, getQuery, allQuery } = require('../database/db');
const { createLog } = require('./operationLogService');

const getAllMerges = async (status = null) => {
  let sql = `
    SELECT mp.*, 
           q1.queue_number as queue_number_1, q1.customer_name as customer_name_1, q1.party_size as party_size_1,
           q2.queue_number as queue_number_2, q2.customer_name as customer_name_2, q2.party_size as party_size_2,
           t.table_number, tt.name as table_type_name
    FROM merge_preferences mp
    LEFT JOIN queue_numbers q1 ON mp.queue_id_1 = q1.id
    LEFT JOIN queue_numbers q2 ON mp.queue_id_2 = q2.id
    LEFT JOIN tables t ON mp.merged_table_id = t.id
    LEFT JOIN table_types tt ON t.type_id = tt.id
  `;
  const params = [];
  if (status) {
    sql += ' WHERE mp.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY mp.created_at DESC';
  return await allQuery(sql, params);
};

const checkMergeCompatibility = async (queueId1, queueId2) => {
  const q1 = await getQuery('SELECT * FROM queue_numbers WHERE id = ?', [queueId1]);
  const q2 = await getQuery('SELECT * FROM queue_numbers WHERE id = ?', [queueId2]);

  if (!q1 || !q2) {
    return { compatible: false, reason: '排号不存在' };
  }

  if (q1.status !== 'waiting' || q2.status !== 'waiting') {
    return { compatible: false, reason: '排号状态必须为等待中' };
  }

  if (q1.table_type_id !== q2.table_type_id) {
    return { compatible: false, reason: '桌台类型不一致' };
  }

  const totalSize = q1.party_size + q2.party_size;
  const tableType = await getQuery('SELECT * FROM table_types WHERE id = ?', [q1.table_type_id]);
  
  if (totalSize > tableType.capacity) {
    return { compatible: false, reason: '总人数超过桌台容量' };
  }

  return {
    compatible: true,
    totalSize,
    tableTypeId: q1.table_type_id,
    tableTypeName: tableType.name,
    tableCapacity: tableType.capacity
  };
};

const createMerge = async (data, operator) => {
  const compatibility = await checkMergeCompatibility(data.queue_id_1, data.queue_id_2);
  
  if (!compatibility.compatible) {
    throw new Error(compatibility.reason);
  }

  const result = await runQuery(
    'INSERT INTO merge_preferences (queue_id_1, queue_id_2, status) VALUES (?, ?, ?)',
    [data.queue_id_1, data.queue_id_2, 'pending']
  );
  await createLog('CREATE', 'merge_preferences', result.id, null, data, operator, '创建拼桌申请');
  return result;
};

const approveMerge = async (id, mergedTableId, operator) => {
  const oldData = await getQuery('SELECT * FROM merge_preferences WHERE id = ?', [id]);
  const result = await runQuery(
    `UPDATE merge_preferences 
     SET status = ?, merged_table_id = ?, approved_by = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    ['approved', mergedTableId, operator, new Date().toISOString(), id]
  );
  await createLog('UPDATE', 'merge_preferences', id, oldData, { status: 'approved', merged_table_id: mergedTableId }, operator, '批准拼桌');
  return result;
};

const rejectMerge = async (id, operator) => {
  const oldData = await getQuery('SELECT * FROM merge_preferences WHERE id = ?', [id]);
  const result = await runQuery(
    'UPDATE merge_preferences SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['rejected', id]
  );
  await createLog('UPDATE', 'merge_preferences', id, oldData, { status: 'rejected' }, operator, '拒绝拼桌');
  return result;
};

module.exports = {
  getAllMerges,
  checkMergeCompatibility,
  createMerge,
  approveMerge,
  rejectMerge
};
