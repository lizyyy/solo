const { run, get, all } = require('../database');
const crypto = require('crypto');

const STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ACTIVE: 'ACTIVE',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED'
};

const RESOURCE_TYPES = ['CPU', 'STORAGE'];

function generateRequestId() {
  return 'REQ-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

async function logOperation(recordId, action, operator, originalInput, processingRule, finalResult, errorMessage = null) {
  await run(
    `INSERT INTO operation_logs (record_id, action, operator, original_input, processing_rule, final_result, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [recordId, action, operator, JSON.stringify(originalInput), processingRule, JSON.stringify(finalResult), errorMessage]
  );
}

async function getTeamByName(name) {
  return await get('SELECT * FROM teams WHERE name = ?', [name]);
}

async function createTeam(name, cpuQuota, storageQuota) {
  const existing = await getTeamByName(name);
  if (existing) {
    throw { code: 'TEAM_EXISTS', message: '团队 ' + name + ' 已存在' };
  }
  const result = await run(
    'INSERT INTO teams (name, cpu_quota, storage_quota) VALUES (?, ?, ?)',
    [name, cpuQuota, storageQuota]
  );
  return { id: result.id, name, cpuQuota, storageQuota };
}

async function createBorrowRequest(data) {
  const { borrowerTeam, lenderTeam, resourceType, amount, dueDate, operator } = data;

  if (!RESOURCE_TYPES.includes(resourceType)) {
    const error = { code: 'INVALID_RESOURCE_TYPE', message: '资源类型必须是 CPU 或 STORAGE' };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证资源类型是否为 CPU 或 STORAGE',
      null,
      error.message
    );
    throw error;
  }

  if (amount <= 0) {
    const error = { code: 'INVALID_AMOUNT', message: '借用额度必须大于 0' };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证借用额度大于 0',
      null,
      error.message
    );
    throw error;
  }

  const borrower = await getTeamByName(borrowerTeam);
  if (!borrower) {
    const error = { code: 'BORROWER_NOT_FOUND', message: '借用方团队 ' + borrowerTeam + ' 不存在' };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证借用方团队是否存在',
      null,
      error.message
    );
    throw error;
  }

  const lender = await getTeamByName(lenderTeam);
  if (!lender) {
    const error = { code: 'LENDER_NOT_FOUND', message: '出借方团队 ' + lenderTeam + ' 不存在' };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证出借方团队是否存在',
      null,
      error.message
    );
    throw error;
  }

  if (borrowerTeam === lenderTeam) {
    const error = { code: 'SAME_TEAM', message: '借用方和出借方不能是同一个团队' };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证借用方和出借方不是同一个团队',
      null,
      error.message
    );
    throw error;
  }

  const availableKey = resourceType === 'CPU' ? 'cpu_quota' : 'storage_quota';
  const usedKey = resourceType === 'CPU' ? 'cpu_used' : 'storage_used';
  const available = lender[availableKey] - lender[usedKey];
  
  if (amount > available) {
    const error = { 
      code: 'INSUFFICIENT_QUOTA', 
      message: '出借方' + resourceType + '配额不足，可用: ' + available + ', 请求: ' + amount
    };
    await logOperation(
      null,
      'CREATE_REQUEST_FAILED',
      operator,
      data,
      '验证出借方配额是否充足',
      null,
      error.message
    );
    throw error;
  }

  const borrowDate = new Date().toISOString();
  const requestId = generateRequestId();

  const result = await run(
    `INSERT INTO borrow_records 
     (request_id, borrower_team, lender_team, resource_type, amount, borrow_date, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [requestId, borrowerTeam, lenderTeam, resourceType, amount, borrowDate, dueDate, STATUS.PENDING_APPROVAL]
  );

  await logOperation(
    result.id,
    'CREATE_REQUEST',
    operator,
    data,
    '验证团队存在、资源类型有效、额度充足',
    { requestId, status: STATUS.PENDING_APPROVAL }
  );

  return {
    id: result.id,
    requestId,
    status: STATUS.PENDING_APPROVAL
  };
}

async function approveRequest(requestId, approver, comment) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    const error = { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
    await logOperation(
      null,
      'APPROVE_FAILED',
      approver,
      { requestId, approver, comment },
      '验证借用记录是否存在',
      null,
      error.message
    );
    throw error;
  }

  if (record.status !== STATUS.PENDING_APPROVAL) {
    const error = { code: 'INVALID_STATUS', message: '当前状态 ' + record.status + ' 不允许审批' };
    await logOperation(
      record.id,
      'APPROVE_FAILED',
      approver,
      { requestId, approver, comment },
      '验证状态为 PENDING_APPROVAL',
      null,
      error.message
    );
    throw error;
  }

  const lender = await getTeamByName(record.lender_team);
  const resourceKey = record.resource_type === 'CPU' ? 'cpu_used' : 'storage_used';
  
  await run(
    `UPDATE teams SET ${resourceKey} = ${resourceKey} + ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
    [record.amount, record.lender_team]
  );

  await run(
    `UPDATE borrow_records 
     SET status = ?, approver = ?, approval_comment = ?, approval_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [STATUS.ACTIVE, approver, comment, record.id]
  );

  await logOperation(
    record.id,
    'APPROVE',
    approver,
    { requestId, approver, comment },
    '扣减出借方已用配额，状态变更为 ACTIVE',
    { status: STATUS.ACTIVE }
  );

  return { requestId, status: STATUS.ACTIVE };
}

async function rejectRequest(requestId, approver, comment) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    const error = { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
    await logOperation(
      null,
      'REJECT_FAILED',
      approver,
      { requestId, approver, comment },
      '验证借用记录是否存在',
      null,
      error.message
    );
    throw error;
  }

  if (record.status !== STATUS.PENDING_APPROVAL) {
    const error = { code: 'INVALID_STATUS', message: '当前状态 ' + record.status + ' 不允许审批' };
    await logOperation(
      record.id,
      'REJECT_FAILED',
      approver,
      { requestId, approver, comment },
      '验证状态为 PENDING_APPROVAL',
      null,
      error.message
    );
    throw error;
  }

  await run(
    `UPDATE borrow_records 
     SET status = ?, approver = ?, approval_comment = ?, approval_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [STATUS.REJECTED, approver, comment, record.id]
  );

  await logOperation(
    record.id,
    'REJECT',
    approver,
    { requestId, approver, comment },
    '拒绝申请，状态变更为 REJECTED',
    { status: STATUS.REJECTED }
  );

  return { requestId, status: STATUS.REJECTED };
}

async function returnResource(requestId, operator) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    const error = { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
    await logOperation(
      null,
      'RETURN_FAILED',
      operator,
      { requestId },
      '验证借用记录是否存在',
      null,
      error.message
    );
    throw error;
  }

  if (record.status !== STATUS.ACTIVE && record.status !== STATUS.OVERDUE) {
    const error = { code: 'INVALID_STATUS', message: '当前状态 ' + record.status + ' 不允许归还' };
    await logOperation(
      record.id,
      'RETURN_FAILED',
      operator,
      { requestId },
      '验证状态为 ACTIVE 或 OVERDUE',
      null,
      error.message
    );
    throw error;
  }

  const resourceKey = record.resource_type === 'CPU' ? 'cpu_used' : 'storage_used';
  
  await run(
    `UPDATE teams SET ${resourceKey} = ${resourceKey} - ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`,
    [record.amount, record.lender_team]
  );

  const returnDate = new Date().toISOString();
  await run(
    `UPDATE borrow_records 
     SET status = ?, return_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [STATUS.RETURNED, returnDate, record.id]
  );

  await logOperation(
    record.id,
    'RETURN',
    operator,
    { requestId },
    '恢复出借方配额，状态变更为 RETURNED',
    { status: STATUS.RETURNED, returnDate }
  );

  return { requestId, status: STATUS.RETURNED, returnDate };
}

async function checkOverdue() {
  const now = new Date().toISOString();
  const overdueRecords = await all(
    `SELECT * FROM borrow_records 
     WHERE status = ? AND due_date < ?`,
    [STATUS.ACTIVE, now]
  );

  for (const record of overdueRecords) {
    await run(
      `UPDATE borrow_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [STATUS.OVERDUE, record.id]
    );
    await logOperation(
      record.id,
      'OVERDUE_DETECT',
      'SYSTEM',
      { recordId: record.id, dueDate: record.due_date, now },
      '系统检测到逾期，状态变更为 OVERDUE',
      { status: STATUS.OVERDUE }
    );
  }

  return { count: overdueRecords.length, records: overdueRecords.map(r => r.request_id) };
}

async function manualCorrect(requestId, data, operator) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    const error = { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
    await logOperation(
      null,
      'MANUAL_CORRECT_FAILED',
      operator,
      { requestId, changes: data },
      '验证借用记录是否存在',
      null,
      error.message
    );
    throw error;
  }

  const originalRecord = { ...record };
  const updates = [];
  const params = [];

  if (data.amount !== undefined) {
    updates.push('amount = ?');
    params.push(data.amount);
  }
  if (data.dueDate !== undefined) {
    updates.push('due_date = ?');
    params.push(data.dueDate);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }
  if (data.settlementSummary !== undefined) {
    updates.push('settlement_summary = ?');
    params.push(data.settlementSummary);
  }

  if (updates.length === 0) {
    const error = { code: 'NO_CHANGES', message: '没有提供需要修改的字段' };
    await logOperation(
      record.id,
      'MANUAL_CORRECT_FAILED',
      operator,
      { requestId, changes: data },
      '验证至少提供一个需要修改的字段',
      null,
      error.message
    );
    throw error;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(record.id);

  await run(
    `UPDATE borrow_records SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  await logOperation(
    record.id,
    'MANUAL_CORRECT',
    operator,
    { requestId, changes: data, original: originalRecord },
    '人工修正记录字段',
    { changes: data }
  );

  return { requestId, changes: data };
}

async function getBorrowRecord(requestId) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    throw { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
  }
  return record;
}

async function listBorrowRecords(filters = {}) {
  let sql = 'SELECT * FROM borrow_records WHERE 1=1';
  const params = [];

  if (filters.borrowerTeam) {
    sql += ' AND borrower_team = ?';
    params.push(filters.borrowerTeam);
  }
  if (filters.lenderTeam) {
    sql += ' AND lender_team = ?';
    params.push(filters.lenderTeam);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.resourceType) {
    sql += ' AND resource_type = ?';
    params.push(filters.resourceType);
  }

  sql += ' ORDER BY created_at DESC';

  return await all(sql, params);
}

async function getOperationLogs(recordId) {
  return await all(
    'SELECT * FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC',
    [recordId]
  );
}

async function settleRecord(requestId, settlementSummary, operator) {
  const record = await get('SELECT * FROM borrow_records WHERE request_id = ?', [requestId]);
  if (!record) {
    const error = { code: 'RECORD_NOT_FOUND', message: '借用记录不存在' };
    await logOperation(
      null,
      'SETTLE_FAILED',
      operator,
      { requestId, settlementSummary },
      '验证借用记录是否存在',
      null,
      error.message
    );
    throw error;
  }

  if (record.status !== STATUS.RETURNED && record.status !== STATUS.OVERDUE) {
    const error = { code: 'INVALID_STATUS', message: '当前状态 ' + record.status + ' 不允许结算' };
    await logOperation(
      record.id,
      'SETTLE_FAILED',
      operator,
      { requestId, settlementSummary },
      '验证状态为 RETURNED 或 OVERDUE',
      null,
      error.message
    );
    throw error;
  }

  await run(
    `UPDATE borrow_records 
     SET status = ?, settlement_summary = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [STATUS.SETTLED, settlementSummary, record.id]
  );

  await logOperation(
    record.id,
    'SETTLE',
    operator,
    { requestId, settlementSummary },
    '记录结算，状态变更为 SETTLED',
    { status: STATUS.SETTLED }
  );

  return { requestId, status: STATUS.SETTLED };
}

async function exportSettlementReport(startDate, endDate) {
  return await all(
    `SELECT 
      request_id,
      borrower_team,
      lender_team,
      resource_type,
      amount,
      borrow_date,
      due_date,
      return_date,
      status,
      settlement_summary,
      approval_comment,
      approver
     FROM borrow_records 
     WHERE created_at >= ? AND created_at <= ?
     ORDER BY created_at DESC`,
    [startDate, endDate]
  );
}

async function listTeams() {
  return await all('SELECT * FROM teams ORDER BY name');
}

module.exports = {
  STATUS,
  RESOURCE_TYPES,
  createTeam,
  getTeamByName,
  createBorrowRequest,
  approveRequest,
  rejectRequest,
  returnResource,
  checkOverdue,
  manualCorrect,
  getBorrowRecord,
  listBorrowRecords,
  getOperationLogs,
  settleRecord,
  exportSettlementReport,
  listTeams
};
