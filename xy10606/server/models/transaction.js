const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const sampleModel = require('./sample');

async function getAllTransactions(filter = {}) {
  let query = `
    SELECT st.*, 
           s.sku, s.name as sample_name, s.category, s.unit_cost,
           hs.schedule_date, hs.description as schedule_description,
           h.name as host_name,
           rp.name as responsible_person_name,
           rp.role as responsible_person_role
    FROM sample_transactions st
    LEFT JOIN samples s ON st.sample_id = s.id
    LEFT JOIN host_schedules hs ON st.schedule_id = hs.id
    LEFT JOIN hosts h ON st.host_id = h.id
    LEFT JOIN responsible_persons rp ON st.responsible_person_id = rp.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filter.transaction_type) {
    query += ' AND st.transaction_type = ?';
    params.push(filter.transaction_type);
  }
  if (filter.status) {
    query += ' AND st.status = ?';
    params.push(filter.status);
  }
  if (filter.sample_id) {
    query += ' AND st.sample_id = ?';
    params.push(filter.sample_id);
  }
  if (filter.schedule_id) {
    query += ' AND st.schedule_id = ?';
    params.push(filter.schedule_id);
  }
  if (filter.host_id) {
    query += ' AND st.host_id = ?';
    params.push(filter.host_id);
  }
  if (filter.responsible_person_id) {
    query += ' AND st.responsible_person_id = ?';
    params.push(filter.responsible_person_id);
  }
  if (filter.start_date) {
    query += ' AND date(st.created_at) >= ?';
    params.push(filter.start_date);
  }
  if (filter.end_date) {
    query += ' AND date(st.created_at) <= ?';
    params.push(filter.end_date);
  }
  if (filter.keyword) {
    query += ' AND (s.sku LIKE ? OR s.name LIKE ? OR h.name LIKE ?)';
    const keyword = `%${filter.keyword}%`;
    params.push(keyword, keyword, keyword);
  }
  
  query += ' ORDER BY st.created_at DESC';
  
  return await all(query, params);
}

async function getTransactionById(id) {
  return await get(`
    SELECT st.*, 
           s.sku, s.name as sample_name, s.category, s.unit_cost,
           hs.schedule_date, hs.description as schedule_description,
           h.name as host_name,
           rp.name as responsible_person_name,
           rp.role as responsible_person_role
    FROM sample_transactions st
    LEFT JOIN samples s ON st.sample_id = s.id
    LEFT JOIN host_schedules hs ON st.schedule_id = hs.id
    LEFT JOIN hosts h ON st.host_id = h.id
    LEFT JOIN responsible_persons rp ON st.responsible_person_id = rp.id
    WHERE st.id = ?
  `, [id]);
}

async function checkDuplicateSubmission(sampleId, scheduleId, transactionType) {
  const existing = await get(`
    SELECT * FROM submitted_transactions 
    WHERE sample_id = ? AND schedule_id = ? AND transaction_type = ?
  `, [sampleId, scheduleId, transactionType]);
  
  return !!existing;
}

async function createTransaction(data) {
  const id = uuidv4();
  
  const isDuplicate = await checkDuplicateSubmission(
    data.sample_id, 
    data.schedule_id, 
    data.transaction_type
  );
  
  if (isDuplicate) {
    throw new Error('该样品在此排期下已存在相同类型的提交，请勿重复操作');
  }
  
  if (data.transaction_type === 'borrow') {
    const sample = await sampleModel.getSampleById(data.sample_id);
    if (sample && sample.quantity_in_stock < data.quantity) {
      throw new Error(`库存不足，当前库存: ${sample.quantity_in_stock}`);
    }
  }
  
  if (data.transaction_type === 'sell') {
    const schedule = await get('SELECT * FROM host_schedules WHERE id = ?', [data.schedule_id]);
    if (schedule && schedule.status !== 'completed') {
      throw new Error('只有已完成的排期才能进行销售转正');
    }
    
    const pendingBorrow = await get(`
      SELECT * FROM sample_transactions 
      WHERE sample_id = ? AND schedule_id = ? AND transaction_type = 'borrow' AND status = 'approved'
    `, [data.sample_id, data.schedule_id]);
    
    if (!pendingBorrow) {
      throw new Error('该样品在此排期下没有已审批通过的借出记录');
    }
  }
  
  await run(`
    INSERT INTO sample_transactions 
    (id, transaction_type, sample_id, schedule_id, host_id, quantity, loss_description, status, responsible_person_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.transaction_type,
    data.sample_id,
    data.schedule_id,
    data.host_id,
    data.quantity,
    data.loss_description || null,
    'pending',
    data.responsible_person_id || null,
    data.created_by || 'system'
  ]);
  
  await run(`
    INSERT INTO submitted_transactions (id, sample_id, schedule_id, transaction_type)
    VALUES (?, ?, ?, ?)
  `, [uuidv4(), data.sample_id, data.schedule_id, data.transaction_type]);
  
  await saveTransactionVersion(id, null, '创建', data.created_by || 'system');
  
  return await getTransactionById(id);
}

async function updateTransaction(id, data, updatedBy = 'system') {
  const current = await getTransactionById(id);
  if (!current) return null;
  
  if (current.status === 'approved' && data.transaction_type) {
    throw new Error('已审批通过的记录不能修改交易类型');
  }
  
  const newData = {
    sample_id: data.sample_id || current.sample_id,
    schedule_id: data.schedule_id || current.schedule_id,
    host_id: data.host_id || current.host_id,
    quantity: data.quantity || current.quantity,
    loss_description: data.loss_description !== undefined ? data.loss_description : current.loss_description,
    status: data.status || current.status,
    responsible_person_id: data.responsible_person_id !== undefined ? data.responsible_person_id : current.responsible_person_id
  };
  
  await run(`
    UPDATE sample_transactions 
    SET sample_id = ?, schedule_id = ?, host_id = ?, quantity = ?, loss_description = ?, status = ?, responsible_person_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newData.sample_id,
    newData.schedule_id,
    newData.host_id,
    newData.quantity,
    newData.loss_description,
    newData.status,
    newData.responsible_person_id,
    id
  ]);
  
  await saveTransactionVersion(id, current, data.change_reason || '修改', updatedBy);
  
  return await getTransactionById(id);
}

async function saveTransactionVersion(transactionId, oldData, changeReason, createdBy) {
  const id = uuidv4();
  
  if (oldData) {
    await run(`
      INSERT INTO sample_transaction_versions 
      (id, transaction_id, sample_id, schedule_id, host_id, quantity, loss_description, status, responsible_person_id, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      transactionId,
      oldData.sample_id,
      oldData.schedule_id,
      oldData.host_id,
      oldData.quantity,
      oldData.loss_description,
      oldData.status,
      oldData.responsible_person_id,
      changeReason,
      createdBy
    ]);
  } else {
    const current = await getTransactionById(transactionId);
    await run(`
      INSERT INTO sample_transaction_versions 
      (id, transaction_id, sample_id, schedule_id, host_id, quantity, loss_description, status, responsible_person_id, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      transactionId,
      current.sample_id,
      current.schedule_id,
      current.host_id,
      current.quantity,
      current.loss_description,
      current.status,
      current.responsible_person_id,
      changeReason,
      createdBy
    ]);
  }
}

async function getTransactionVersions(transactionId) {
  return await all(`
    SELECT * FROM sample_transaction_versions 
    WHERE transaction_id = ? 
    ORDER BY created_at DESC
  `, [transactionId]);
}

async function approveTransaction(id, data) {
  const current = await getTransactionById(id);
  if (!current) return null;
  
  if (current.status !== 'pending') {
    throw new Error('只有待审批的记录才能审批');
  }
  
  if (current.transaction_type === 'borrow') {
    await sampleModel.updateSampleStock(current.sample_id, -current.quantity);
  } else if (current.transaction_type === 'return') {
    await sampleModel.updateSampleStock(current.sample_id, current.quantity);
  }
  
  await run(`
    UPDATE sample_transactions 
    SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [data.reviewed_by || 'system', id]);
  
  await run(`
    INSERT INTO transaction_reviews (id, transaction_id, review_type, reviewer_id, reviewer_name, review_result, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(),
    id,
    current.transaction_type,
    data.reviewer_id || null,
    data.reviewer_name || null,
    'approved',
    data.comments || null
  ]);
  
  await saveTransactionVersion(id, current, '审批通过', data.reviewed_by || 'system');
  
  return await getTransactionById(id);
}

async function rejectTransaction(id, data) {
  const current = await getTransactionById(id);
  if (!current) return null;
  
  if (current.status !== 'pending') {
    throw new Error('只有待审批的记录才能审批');
  }
  
  await run(`
    UPDATE sample_transactions 
    SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [data.reviewed_by || 'system', id]);
  
  await run(`
    INSERT INTO transaction_reviews (id, transaction_id, review_type, reviewer_id, reviewer_name, review_result, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    uuidv4(),
    id,
    current.transaction_type,
    data.reviewer_id || null,
    data.reviewer_name || null,
    'rejected',
    data.comments || null
  ]);
  
  await saveTransactionVersion(id, current, '审批拒绝', data.reviewed_by || 'system');
  
  return await getTransactionById(id);
}

async function getAnomalies() {
  const anomalies = [];
  
  const pendingCountResult = await get(`
    SELECT COUNT(*) as count FROM sample_transactions WHERE status = 'pending'
  `);
  const pendingCount = pendingCountResult?.count || 0;
  
  if (pendingCount > 0) {
    anomalies.push({
      type: 'pending_approvals',
      title: '待审批记录',
      count: pendingCount,
      description: '需要审批的记录数量',
      status: 'warning'
    });
  }
  
  const lowStock = await all(`
    SELECT * FROM samples WHERE quantity_in_stock <= 5
  `);
  
  if (lowStock.length > 0) {
    anomalies.push({
      type: 'low_stock',
      title: '库存预警',
      count: lowStock.length,
      description: '库存低于或等于5的样品数量',
      status: 'warning',
      details: lowStock
    });
  }
  
  const costMismatch = await all(`
    SELECT 
      st.id, 
      s.sku, 
      s.name as sample_name, 
      s.unit_cost,
      SUM(st.quantity) as total_quantity,
      (s.unit_cost * SUM(st.quantity)) as expected_cost,
      rp.name as responsible_person
    FROM sample_transactions st
    JOIN samples s ON st.sample_id = s.id
    LEFT JOIN responsible_persons rp ON st.responsible_person_id = rp.id
    WHERE st.status = 'approved' AND (st.transaction_type = 'sell' OR st.transaction_type = 'loss')
    GROUP BY st.responsible_person_id, st.sample_id
  `);
  
  if (costMismatch.length > 0) {
    anomalies.push({
      type: 'cost_tracking',
      title: '成本追踪',
      count: costMismatch.length,
      description: '需要关注成本归属的记录',
      status: 'info',
      details: costMismatch
    });
  }
  
  const noLossDescResult = await get(`
    SELECT COUNT(*) as count FROM sample_transactions 
    WHERE transaction_type = 'return' AND status = 'approved' AND loss_description IS NULL
  `);
  const noLossDescription = noLossDescResult?.count || 0;
  
  if (noLossDescription > 0) {
    anomalies.push({
      type: 'missing_loss_description',
      title: '缺少损耗说明',
      count: noLossDescription,
      description: '归还记录中缺少损耗说明的数量',
      status: 'info'
    });
  }
  
  return anomalies;
}

async function getTransactionReviews(transactionId) {
  return await all(`
    SELECT * FROM transaction_reviews 
    WHERE transaction_id = ? 
    ORDER BY created_at DESC
  `, [transactionId]);
}

module.exports = {
  getAllTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  approveTransaction,
  rejectTransaction,
  getTransactionVersions,
  getAnomalies,
  getTransactionReviews,
  checkDuplicateSubmission
};
