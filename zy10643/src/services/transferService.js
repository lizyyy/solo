const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const TRANSFER_STATUS = {
  PENDING: 'pending',
  TRANSFERRING: 'transferring',
  BOOKED: 'booked',
  RETURNED: 'returned'
};

const FLOW_TYPES = {
  NORMAL: 'normal',
  REJECT: 'reject',
  MANUAL_REVIEW: 'manual_review'
};

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function addHistory(transferId, oldStatus, newStatus, actionBy, comment) {
  await runExecute(
    'INSERT INTO transfer_history (transfer_id, old_status, new_status, action_by, action_comment) VALUES (?, ?, ?, ?, ?)',
    [transferId, oldStatus, newStatus, actionBy, comment]
  );
}

async function checkConflict(reimbursementOrderId, excludeTransferId = null) {
  let sql = 'SELECT * FROM budget_transfers WHERE reimbursement_order_id = ? AND status IN (?, ?)';
  let params = [reimbursementOrderId, TRANSFER_STATUS.PENDING, TRANSFER_STATUS.TRANSFERRING];
  
  if (excludeTransferId) {
    sql += ' AND id != ?';
    params.push(excludeTransferId);
  }
  
  const conflicts = await runQuery(sql, params);
  return conflicts.length > 0;
}

async function checkBudgetAvailability(subjectId, amount) {
  const subjects = await runQuery(
    'SELECT * FROM budget_subjects WHERE id = ?',
    [subjectId]
  );
  
  if (subjects.length === 0) {
    throw new Error('预算科目不存在');
  }
  
  const subject = subjects[0];
  const available = subject.total_budget - subject.used_budget;
  return available >= amount;
}

async function updateBudgetOccupation(originalSubjectId, targetSubjectId, amount, isRollback = false) {
  const multiplier = isRollback ? -1 : 1;
  
  await runExecute(
    'UPDATE budget_subjects SET used_budget = used_budget - ? WHERE id = ?',
    [amount * multiplier, originalSubjectId]
  );
  
  await runExecute(
    'UPDATE budget_subjects SET used_budget = used_budget + ? WHERE id = ?',
    [amount * multiplier, targetSubjectId]
  );
}

async function createTransfer(data) {
  const { employeeId, reimbursementOrderId, originalSubjectId, targetSubjectId, transferAmount, flowType = FLOW_TYPES.NORMAL } = data;

  if (!Object.values(FLOW_TYPES).includes(flowType)) {
    throw new Error('无效的流程类型');
  }

  const hasConflict = await checkConflict(reimbursementOrderId);
  if (hasConflict) {
    throw new Error('该报销单存在进行中的调拨记录，请勿重复提交');
  }

  const orders = await runQuery(
    'SELECT * FROM reimbursement_orders WHERE id = ?',
    [reimbursementOrderId]
  );
  
  if (orders.length === 0) {
    throw new Error('报销单不存在');
  }

  const order = orders[0];
  if (Math.abs(order.amount - transferAmount) > 0.01) {
    throw new Error('调拨金额与报销单金额不一致');
  }

  const hasBudget = await checkBudgetAvailability(targetSubjectId, transferAmount);
  if (!hasBudget) {
    throw new Error('目标科目预算不足');
  }

  const transferId = uuidv4();
  
  await runExecute(
    `INSERT INTO budget_transfers 
     (id, employee_id, reimbursement_order_id, original_subject_id, target_subject_id, transfer_amount, status, flow_type) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [transferId, employeeId, reimbursementOrderId, originalSubjectId, targetSubjectId, transferAmount, TRANSFER_STATUS.PENDING, flowType]
  );

  await addHistory(transferId, null, TRANSFER_STATUS.PENDING, employeeId, '创建调拨申请');

  return getTransferById(transferId);
}

async function processTransfer(transferId, reviewerId) {
  const transfers = await runQuery('SELECT * FROM budget_transfers WHERE id = ?', [transferId]);
  
  if (transfers.length === 0) {
    throw new Error('调拨记录不存在');
  }

  const transfer = transfers[0];
  
  if (transfer.status !== TRANSFER_STATUS.PENDING) {
    throw new Error('只有待处理状态的调拨可以执行');
  }

  await runExecute(
    'UPDATE budget_transfers SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [TRANSFER_STATUS.TRANSFERRING, reviewerId, transferId]
  );

  await addHistory(transferId, TRANSFER_STATUS.PENDING, TRANSFER_STATUS.TRANSFERRING, reviewerId, '开始调拨处理');

  return getTransferById(transferId);
}

async function confirmBooking(transferId, reviewerId, paymentAmount) {
  const transfers = await runQuery('SELECT * FROM budget_transfers WHERE id = ?', [transferId]);
  
  if (transfers.length === 0) {
    throw new Error('调拨记录不存在');
  }

  const transfer = transfers[0];
  
  if (transfer.status !== TRANSFER_STATUS.TRANSFERRING) {
    throw new Error('只有调拨中状态的记录可以入账');
  }

  if (Math.abs(transfer.transfer_amount - paymentAmount) > 0.01) {
    throw new Error('付款金额与调拨金额不一致，无法入账');
  }

  await updateBudgetOccupation(transfer.original_subject_id, transfer.target_subject_id, transfer.transfer_amount);

  await runExecute(
    'UPDATE budget_transfers SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [TRANSFER_STATUS.BOOKED, reviewerId, transferId]
  );

  await runExecute(
    'UPDATE reimbursement_orders SET payment_amount = ?, status = ? WHERE id = ?',
    [paymentAmount, 'paid', transfer.reimbursement_order_id]
  );

  await addHistory(transferId, TRANSFER_STATUS.TRANSFERRING, TRANSFER_STATUS.BOOKED, reviewerId, '调拨已入账');

  return getTransferById(transferId);
}

async function rejectTransfer(transferId, reviewerId, reason) {
  const transfers = await runQuery('SELECT * FROM budget_transfers WHERE id = ?', [transferId]);
  
  if (transfers.length === 0) {
    throw new Error('调拨记录不存在');
  }

  const transfer = transfers[0];
  
  if (transfer.status === TRANSFER_STATUS.BOOKED) {
    throw new Error('已入账的调拨无法驳回');
  }

  const oldStatus = transfer.status;

  await runExecute(
    'UPDATE budget_transfers SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [TRANSFER_STATUS.RETURNED, reason, reviewerId, transferId]
  );

  await addHistory(transferId, oldStatus, TRANSFER_STATUS.RETURNED, reviewerId, `驳回原因: ${reason}`);

  return getTransferById(transferId);
}

async function resubmitTransfer(transferId, employeeId, newData = {}) {
  const transfers = await runQuery('SELECT * FROM budget_transfers WHERE id = ?', [transferId]);
  
  if (transfers.length === 0) {
    throw new Error('调拨记录不存在');
  }

  const transfer = transfers[0];
  
  if (transfer.status !== TRANSFER_STATUS.RETURNED) {
    throw new Error('只有被退回的调拨可以重新提交');
  }

  const hasConflict = await checkConflict(transfer.reimbursement_order_id, transferId);
  if (hasConflict) {
    throw new Error('该报销单存在进行中的调拨记录');
  }

  const targetSubjectId = newData.targetSubjectId || transfer.target_subject_id;
  const transferAmount = newData.transferAmount || transfer.transfer_amount;

  const hasBudget = await checkBudgetAvailability(targetSubjectId, transferAmount);
  if (!hasBudget) {
    throw new Error('目标科目预算不足');
  }

  await runExecute(
    'UPDATE budget_transfers SET status = ?, target_subject_id = ?, transfer_amount = ?, flow_type = ? WHERE id = ?',
    [TRANSFER_STATUS.PENDING, targetSubjectId, transferAmount, FLOW_TYPES.REJECT, transferId]
  );

  await addHistory(transferId, TRANSFER_STATUS.RETURNED, TRANSFER_STATUS.PENDING, employeeId, '驳回后重新提交');

  return getTransferById(transferId);
}

async function manualReviewTransfer(transferId, reviewerId, approved, comment) {
  const transfers = await runQuery('SELECT * FROM budget_transfers WHERE id = ?', [transferId]);
  
  if (transfers.length === 0) {
    throw new Error('调拨记录不存在');
  }

  const transfer = transfers[0];
  
  if (transfer.flow_type !== FLOW_TYPES.MANUAL_REVIEW) {
    throw new Error('只有人工复核流程的调拨需要复核');
  }

  if (transfer.status !== TRANSFER_STATUS.PENDING) {
    throw new Error('该调拨已处理');
  }

  if (approved) {
    return processTransfer(transferId, reviewerId);
  } else {
    return rejectTransfer(transferId, reviewerId, comment);
  }
}

async function getTransferById(transferId) {
  const transfers = await runQuery(`
    SELECT bt.*, e.name as employee_name, ro.amount as order_amount,
           bs1.name as original_subject_name, bs2.name as target_subject_name
    FROM budget_transfers bt
    JOIN employees e ON bt.employee_id = e.id
    JOIN reimbursement_orders ro ON bt.reimbursement_order_id = ro.id
    JOIN budget_subjects bs1 ON bt.original_subject_id = bs1.id
    JOIN budget_subjects bs2 ON bt.target_subject_id = bs2.id
    WHERE bt.id = ?
  `, [transferId]);

  return transfers[0] || null;
}

async function getTransferList(filters = {}) {
  let sql = `
    SELECT bt.*, e.name as employee_name, ro.amount as order_amount,
           bs1.name as original_subject_name, bs2.name as target_subject_name
    FROM budget_transfers bt
    JOIN employees e ON bt.employee_id = e.id
    JOIN reimbursement_orders ro ON bt.reimbursement_order_id = ro.id
    JOIN budget_subjects bs1 ON bt.original_subject_id = bs1.id
    JOIN budget_subjects bs2 ON bt.target_subject_id = bs2.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    sql += ' AND bt.status = ?';
    params.push(filters.status);
  }

  if (filters.employeeId) {
    sql += ' AND bt.employee_id = ?';
    params.push(filters.employeeId);
  }

  if (filters.flowType) {
    sql += ' AND bt.flow_type = ?';
    params.push(filters.flowType);
  }

  sql += ' ORDER BY bt.created_at DESC';

  return runQuery(sql, params);
}

async function getTransferHistory(transferId) {
  return runQuery(
    'SELECT * FROM transfer_history WHERE transfer_id = ? ORDER BY created_at ASC',
    [transferId]
  );
}

module.exports = {
  TRANSFER_STATUS,
  FLOW_TYPES,
  createTransfer,
  processTransfer,
  confirmBooking,
  rejectTransfer,
  resubmitTransfer,
  manualReviewTransfer,
  getTransferById,
  getTransferList,
  getTransferHistory,
  checkConflict
};
