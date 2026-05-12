const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDB } = require('../database/connection');
const { createAuditLog, getAuditLogs } = require('../utils/audit');
const { getPartById, updatePartStock } = require('./partsService');
const { getEngineerById } = require('./engineersService');
const { getWorkOrderById } = require('./workOrdersService');

const LOAN_STATUS = {
  BORROWED: 'borrowed',
  OVERDUE: 'overdue',
  PARTIAL_RETURNED: 'partial_returned',
  RETURNED: 'returned',
  CONSUMED: 'consumed',
  DAMAGED: 'damaged',
  CLOSED: 'closed',
  EXCEPTION: 'exception'
};

const ACTION_TYPE = {
  BORROW: 'borrow',
  BIND_WORKORDER: 'bind_workorder',
  UNBIND_WORKORDER: 'unbind_workorder',
  PARTIAL_RETURN: 'partial_return',
  RETURN: 'return',
  CONSUME: 'consume',
  DAMAGED: 'damaged',
  COMPENSATE: 'compensate',
  MANUAL_CORRECT: 'manual_correct',
  RESOLVE_EXCEPTION: 'resolve_exception'
};

function checkPartAvailability(partId, quantity) {
  const part = getPartById(partId);
  if (!part) {
    throw new Error(`备件不存在: ${partId}`);
  }
  
  if (part.stock_quantity < quantity) {
    throw new Error(`库存不足: 当前库存 ${part.stock_quantity}, 需要 ${quantity}`);
  }
  
  return part;
}

function checkEngineerActive(engineerId) {
  const engineer = getEngineerById(engineerId);
  if (!engineer) {
    throw new Error(`工程师不存在: ${engineerId}`);
  }
  
  if (engineer.status !== 'active') {
    throw new Error(`工程师状态异常: ${engineer.status}`);
  }
  
  return engineer;
}

function checkActiveBorrow(partId, engineerId) {
  const db = getDB();
  
  const active = db.prepare(`
    SELECT * FROM loans 
    WHERE part_id = ? AND engineer_id = ? 
      AND status IN ('borrowed', 'overdue', 'partial_returned', 'exception')
  `).get(partId, engineerId);
  
  return active;
}

function generateLoanCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LOAN-${timestamp}-${random}`;
}

function createLoanItem(loanId, actionType, quantity, operator, options = {}) {
  const db = getDB();
  
  const itemId = uuidv4();
  
  db.prepare(`
    INSERT INTO loan_items (
      id, loan_id, action_type, quantity, action_at, operator, 
      remark, work_order_id, damage_level, compensation_amount
    ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
  `).run(
    itemId,
    loanId,
    actionType,
    quantity,
    operator,
    options.remark || null,
    options.work_order_id || null,
    options.damage_level || null,
    options.compensation_amount || null
  );
  
  return itemId;
}

function getLoanItems(loanId) {
  const db = getDB();
  return db.prepare(`
    SELECT * FROM loan_items 
    WHERE loan_id = ? 
    ORDER BY action_at ASC, created_at ASC
  `).all(loanId);
}

function calculateLoanStatus(loan) {
  const db = getDB();
  
  const items = getLoanItems(loan.id);
  
  let totalReturned = 0;
  let totalConsumed = 0;
  let totalDamaged = 0;
  
  items.forEach(item => {
    switch (item.action_type) {
      case ACTION_TYPE.PARTIAL_RETURN:
      case ACTION_TYPE.RETURN:
        totalReturned += item.quantity;
        break;
      case ACTION_TYPE.CONSUME:
        totalConsumed += item.quantity;
        break;
      case ACTION_TYPE.DAMAGED:
        totalDamaged += item.quantity;
        break;
    }
  });
  
  const totalProcessed = totalReturned + totalConsumed + totalDamaged;
  const remaining = loan.quantity - totalProcessed;
  
  return {
    totalReturned,
    totalConsumed,
    totalDamaged,
    totalProcessed,
    remaining,
    items
  };
}

function createLoan(loanData, operator = 'system') {
  const db = getDB();
  
  const { part_id, engineer_id, quantity, loan_reason, expected_return_days = 7, work_order_id } = loanData;
  
  checkPartAvailability(part_id, quantity);
  checkEngineerActive(engineer_id);
  
  const activeBorrow = checkActiveBorrow(part_id, engineer_id);
  if (activeBorrow) {
    throw new Error(`该工程师已借用此备件且未归还，借用单号: ${activeBorrow.loan_code}`);
  }
  
  if (work_order_id) {
    const workOrder = getWorkOrderById(work_order_id);
    if (!workOrder) {
      throw new Error(`工单不存在: ${work_order_id}`);
    }
    if (workOrder.status === 'closed') {
      throw new Error('不能将备件绑定到已关闭的工单');
    }
  }
  
  const loanId = uuidv4();
  const loanCode = generateLoanCode();
  const now = new Date().toISOString();
  const expectedReturnAt = dayjs().add(expected_return_days, 'day').toISOString();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO loans (
        id, loan_code, part_id, engineer_id, work_order_id, 
        quantity, borrowed_at, expected_return_at, status, loan_reason,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      loanId,
      loanCode,
      part_id,
      engineer_id,
      work_order_id || null,
      quantity,
      now,
      expectedReturnAt,
      LOAN_STATUS.BORROWED,
      loan_reason || null,
      now,
      now
    );
    
    createLoanItem(loanId, ACTION_TYPE.BORROW, quantity, operator, {
      work_order_id: work_order_id,
      remark: loan_reason
    });
    
    updatePartStock(part_id, -quantity, operator, `借用: ${loanCode}`);
    
    createAuditLog('loan', loanId, 'create', null, {
      loan_code: loanCode,
      quantity,
      engineer_id,
      work_order_id
    }, operator);
  });
  
  transaction();
  
  return getLoanDetail(loanId);
}

function getLoanById(loanId) {
  const db = getDB();
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
}

function getLoanByCode(loanCode) {
  const db = getDB();
  return db.prepare('SELECT * FROM loans WHERE loan_code = ?').get(loanCode);
}

function getLoanDetail(loanId) {
  const db = getDB();
  
  const loan = db.prepare(`
    SELECT l.*, 
           p.part_code, p.part_name, p.unit, p.price,
           e.name as engineer_name, e.engineer_code,
           wo.order_code, wo.customer_name, wo.status as work_order_status, wo.closed_at
    FROM loans l
    JOIN parts p ON l.part_id = p.id
    JOIN engineers e ON l.engineer_id = e.id
    LEFT JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE l.id = ?
  `).get(loanId);
  
  if (!loan) return null;
  
  const calculated = calculateLoanStatus(loan);
  
  return {
    ...loan,
    ...calculated,
    is_overdue: dayjs().isAfter(loan.expected_return_at) && !['returned', 'consumed', 'closed'].includes(loan.status)
  };
}

function listLoans(filters = {}) {
  const db = getDB();
  
  let sql = `
    SELECT l.*, 
           p.part_code, p.part_name,
           e.name as engineer_name, e.engineer_code,
           wo.order_code, wo.customer_name
    FROM loans l
    JOIN parts p ON l.part_id = p.id
    JOIN engineers e ON l.engineer_id = e.id
    LEFT JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.status) {
    sql += ' AND l.status = ?';
    params.push(filters.status);
  }
  if (filters.engineer_id) {
    sql += ' AND l.engineer_id = ?';
    params.push(filters.engineer_id);
  }
  if (filters.part_id) {
    sql += ' AND l.part_id = ?';
    params.push(filters.part_id);
  }
  if (filters.work_order_id) {
    sql += ' AND l.work_order_id = ?';
    params.push(filters.work_order_id);
  }
  
  sql += ' ORDER BY l.created_at DESC';
  
  const loans = db.prepare(sql).all(...params);
  
  return loans.map(loan => ({
    ...loan,
    is_overdue: dayjs().isAfter(loan.expected_return_at) && !['returned', 'consumed', 'closed'].includes(loan.status)
  }));
}

function bindWorkOrder(loanId, workOrderId, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanById(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (['returned', 'consumed', 'closed'].includes(loan.status)) {
    throw new Error('该借用已结束，无法绑定工单');
  }
  
  const workOrder = getWorkOrderById(workOrderId);
  if (!workOrder) {
    throw new Error('工单不存在');
  }
  if (workOrder.status === 'closed') {
    throw new Error('不能绑定已关闭的工单');
  }
  
  const beforeValue = { work_order_id: loan.work_order_id };
  
  db.prepare(`
    UPDATE loans SET work_order_id = ?, updated_at = datetime('now') WHERE id = ?
  `).run(workOrderId, loanId);
  
  createLoanItem(loanId, ACTION_TYPE.BIND_WORKORDER, 0, operator, {
    work_order_id: workOrderId,
    remark: reason
  });
  
  const afterValue = { work_order_id: workOrderId };
  createAuditLog('loan', loanId, 'bind_workorder', beforeValue, afterValue, operator, reason);
  
  return getLoanDetail(loanId);
}

function unbindWorkOrder(loanId, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanById(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (!loan.work_order_id) {
    return getLoanDetail(loanId);
  }
  
  const beforeValue = { work_order_id: loan.work_order_id };
  
  db.prepare(`
    UPDATE loans SET work_order_id = NULL, updated_at = datetime('now') WHERE id = ?
  `).run(loanId);
  
  createLoanItem(loanId, ACTION_TYPE.UNBIND_WORKORDER, 0, operator, {
    remark: reason
  });
  
  const afterValue = { work_order_id: null };
  createAuditLog('loan', loanId, 'unbind_workorder', beforeValue, afterValue, operator, reason);
  
  return getLoanDetail(loanId);
}

function returnPart(loanId, returnQuantity, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanDetail(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (['returned', 'consumed', 'closed'].includes(loan.status)) {
    throw new Error('该借用已结束');
  }
  
  if (returnQuantity <= 0) {
    throw new Error('归还数量必须大于0');
  }
  
  if (returnQuantity > loan.remaining) {
    throw new Error(`归还数量超过未归还数量: 未归还${loan.remaining}, 归还${returnQuantity}`);
  }
  
  const calculated = calculateLoanStatus(loan);
  const newRemaining = loan.remaining - returnQuantity;
  
  const transaction = db.transaction(() => {
    if (newRemaining === 0) {
      db.prepare(`
        UPDATE loans 
        SET status = ?, actual_return_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(LOAN_STATUS.RETURNED, loanId);
      
      createLoanItem(loanId, ACTION_TYPE.RETURN, returnQuantity, operator, {
        remark: reason
      });
    } else {
      db.prepare(`
        UPDATE loans 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(LOAN_STATUS.PARTIAL_RETURNED, loanId);
      
      createLoanItem(loanId, ACTION_TYPE.PARTIAL_RETURN, returnQuantity, operator, {
        remark: reason
      });
    }
    
    updatePartStock(loan.part_id, returnQuantity, operator, `归还: ${loan.loan_code}`);
    
    createAuditLog('loan', loanId, newRemaining === 0 ? 'return' : 'partial_return', {
      remaining: loan.remaining
    }, {
      remaining: newRemaining,
      returnQuantity
    }, operator, reason);
  });
  
  transaction();
  
  return getLoanDetail(loanId);
}

function consumePart(loanId, consumeQuantity, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanDetail(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (['returned', 'consumed', 'closed'].includes(loan.status)) {
    throw new Error('该借用已结束');
  }
  
  if (consumeQuantity <= 0) {
    throw new Error('消耗数量必须大于0');
  }
  
  if (consumeQuantity > loan.remaining) {
    throw new Error(`消耗数量超过未归还数量: 未归还${loan.remaining}, 消耗${consumeQuantity}`);
  }
  
  const newRemaining = loan.remaining - consumeQuantity;
  
  const transaction = db.transaction(() => {
    if (newRemaining === 0) {
      db.prepare(`
        UPDATE loans 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(LOAN_STATUS.CONSUMED, loanId);
    }
    
    createLoanItem(loanId, ACTION_TYPE.CONSUME, consumeQuantity, operator, {
      remark: reason
    });
    
    createAuditLog('loan', loanId, 'consume', {
      remaining: loan.remaining
    }, {
      remaining: newRemaining,
      consumeQuantity
    }, operator, reason);
  });
  
  transaction();
  
  return getLoanDetail(loanId);
}

function reportDamage(loanId, damageQuantity, damageLevel, compensationAmount, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanDetail(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (['returned', 'consumed', 'closed'].includes(loan.status)) {
    throw new Error('该借用已结束');
  }
  
  if (damageQuantity <= 0) {
    throw new Error('损坏数量必须大于0');
  }
  
  if (damageQuantity > loan.remaining) {
    throw new Error(`损坏数量超过未归还数量: 未归还${loan.remaining}, 损坏${damageQuantity}`);
  }
  
  if (!['minor', 'medium', 'major', 'total'].includes(damageLevel)) {
    throw new Error('损坏等级必须是: minor(轻微), medium(中等), major(严重), total(完全损坏)');
  }
  
  const newRemaining = loan.remaining - damageQuantity;
  
  const transaction = db.transaction(() => {
    if (newRemaining === 0) {
      db.prepare(`
        UPDATE loans 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(LOAN_STATUS.DAMAGED, loanId);
    }
    
    createLoanItem(loanId, ACTION_TYPE.DAMAGED, damageQuantity, operator, {
      damage_level: damageLevel,
      compensation_amount: compensationAmount || 0,
      remark: reason
    });
    
    createAuditLog('loan', loanId, 'damage', {
      remaining: loan.remaining
    }, {
      remaining: newRemaining,
      damageQuantity,
      damageLevel,
      compensationAmount
    }, operator, reason);
  });
  
  transaction();
  
  return getLoanDetail(loanId);
}

function processCompensation(loanId, compensationAmount, operator = 'system', reason = '') {
  const db = getDB();
  
  const loan = getLoanById(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  createLoanItem(loanId, ACTION_TYPE.COMPENSATE, 0, operator, {
    compensation_amount: compensationAmount,
    remark: reason
  });
  
  createAuditLog('loan', loanId, 'compensation', null, {
    compensationAmount
  }, operator, reason);
  
  return getLoanDetail(loanId);
}

function checkOverdue() {
  const db = getDB();
  const now = dayjs().toISOString();
  
  const overdueLoans = db.prepare(`
    SELECT * FROM loans 
    WHERE status IN ('borrowed', 'partial_returned')
      AND expected_return_at < ?
  `).all(now);
  
  overdueLoans.forEach(loan => {
    const beforeValue = { status: loan.status };
    const afterValue = { status: LOAN_STATUS.OVERDUE };
    
    db.prepare(`
      UPDATE loans SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(LOAN_STATUS.OVERDUE, loan.id);
    
    createAuditLog('loan', loan.id, 'overdue', beforeValue, afterValue, 'system', '超过归还期限自动标记');
  });
  
  return overdueLoans.length;
}

function checkWorkOrderClosed() {
  const db = getDB();
  
  const affected = db.prepare(`
    SELECT l.*, wo.closed_at 
    FROM loans l
    JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE l.status IN ('borrowed', 'overdue', 'partial_returned')
      AND wo.status = 'closed'
  `).all();
  
  affected.forEach(loan => {
    const beforeValue = { status: loan.status };
    const afterValue = { status: LOAN_STATUS.EXCEPTION };
    
    db.prepare(`
      UPDATE loans SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(LOAN_STATUS.EXCEPTION, loan.id);
    
    createAuditLog('loan', loan.id, 'exception', beforeValue, afterValue, 'system', 
      `工单已关闭但备件未归还，关闭时间: ${loan.closed_at}`);
  });
  
  return affected.length;
}

function manualCorrect(loanId, correction, operator, reason) {
  const db = getDB();
  
  const loan = getLoanById(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  const beforeValue = {};
  const afterValue = {};
  const updates = [];
  const params = [];
  
  if (correction.status !== undefined) {
    beforeValue.status = loan.status;
    afterValue.status = correction.status;
    updates.push('status = ?');
    params.push(correction.status);
  }
  
  if (correction.quantity !== undefined) {
    beforeValue.quantity = loan.quantity;
    afterValue.quantity = correction.quantity;
    updates.push('quantity = ?');
    params.push(correction.quantity);
  }
  
  if (updates.length === 0) {
    throw new Error('没有需要修正的字段');
  }
  
  params.push(loanId);
  updates.push('updated_at = datetime(\'now\')');
  
  db.prepare(`UPDATE loans SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  createLoanItem(loanId, ACTION_TYPE.MANUAL_CORRECT, 0, operator, {
    remark: reason || '人工修正'
  });
  
  createAuditLog('loan', loanId, 'manual_correct', beforeValue, afterValue, operator, reason || '人工修正');
  
  return getLoanDetail(loanId);
}

function resolveException(loanId, resolution, operator, reason) {
  const db = getDB();
  
  const loan = getLoanById(loanId);
  if (!loan) {
    throw new Error('借用记录不存在');
  }
  
  if (loan.status !== LOAN_STATUS.EXCEPTION) {
    throw new Error('该借用不是异常状态');
  }
  
  const beforeValue = { status: loan.status };
  const afterValue = { status: resolution.new_status };
  
  db.prepare(`
    UPDATE loans SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(resolution.new_status, loanId);
  
  createLoanItem(loanId, ACTION_TYPE.RESOLVE_EXCEPTION, 0, operator, {
    remark: reason || resolution.remark
  });
  
  createAuditLog('loan', loanId, 'resolve_exception', beforeValue, afterValue, operator, reason || '异常解决');
  
  return getLoanDetail(loanId);
}

function getPartFlow(partId) {
  const db = getDB();
  
  return db.prepare(`
    SELECT l.loan_code, l.status, l.quantity,
           li.action_type, li.quantity as item_quantity, li.action_at, li.operator, li.remark,
           e.name as engineer_name,
           wo.order_code
    FROM loans l
    JOIN loan_items li ON l.id = li.loan_id
    JOIN engineers e ON l.engineer_id = e.id
    LEFT JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE l.part_id = ?
    ORDER BY li.action_at ASC
  `).all(partId);
}

function getUnreturnedLoans() {
  const db = getDB();
  
  checkOverdue();
  checkWorkOrderClosed();
  
  return db.prepare(`
    SELECT l.*, 
           p.part_code, p.part_name, p.unit, p.price,
           e.name as engineer_name, e.engineer_code, e.phone,
           wo.order_code, wo.customer_name, wo.status as work_order_status
    FROM loans l
    JOIN parts p ON l.part_id = p.id
    JOIN engineers e ON l.engineer_id = e.id
    LEFT JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE l.status IN ('borrowed', 'overdue', 'partial_returned', 'exception')
    ORDER BY 
      CASE l.status 
        WHEN 'exception' THEN 1 
        WHEN 'overdue' THEN 2 
        WHEN 'partial_returned' THEN 3 
        ELSE 4 
      END,
      l.expected_return_at ASC
  `).all().map(loan => ({
    ...loan,
    is_overdue: dayjs().isAfter(loan.expected_return_at),
    overdue_days: dayjs().diff(loan.expected_return_at, 'day')
  }));
}

module.exports = {
  LOAN_STATUS,
  ACTION_TYPE,
  createLoan,
  getLoanById,
  getLoanByCode,
  getLoanDetail,
  listLoans,
  bindWorkOrder,
  unbindWorkOrder,
  returnPart,
  consumePart,
  reportDamage,
  processCompensation,
  checkOverdue,
  checkWorkOrderClosed,
  manualCorrect,
  resolveException,
  getPartFlow,
  getUnreturnedLoans,
  getLoanItems
};
