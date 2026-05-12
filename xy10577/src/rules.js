const dbModule = require('./database');
const utils = require('./utils');

let db = null;

const ensureDb = async () => {
  if (!db) {
    db = await dbModule.initDb();
  }
  return db;
};

const checkIdempotency = async (key, operation) => {
  const database = await ensureDb();
  const existing = database.prepare('SELECT * FROM idempotency_keys WHERE key = ?').get(key);
  if (existing) {
    return {
      exists: true,
      response: utils.safeJsonParse(existing.response_data)
    };
  }
  return { exists: false };
};

const recordIdempotency = async (key, operation, entityId, response) => {
  const database = await ensureDb();
  database.prepare(`
    INSERT OR REPLACE INTO idempotency_keys (key, operation, entity_id, response_data, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(key, operation, entityId, JSON.stringify(response), utils.nowString());
};

const recordStatusHistory = async (entityType, entityId, fromStatus, toStatus, action, operator, reason, beforeState, afterState) => {
  const database = await ensureDb();
  database.prepare(`
    INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, action, operator, reason, before_state, after_state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    utils.generateId(),
    entityType,
    entityId,
    fromStatus,
    toStatus,
    action,
    operator,
    reason,
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    utils.nowString()
  );
};

const recordFailedOperation = async (operation, requestId, entityType, entityId, errorCode, errorMessage, requestData) => {
  const database = await ensureDb();
  database.prepare(`
    INSERT INTO failed_operations (id, operation, request_id, entity_type, entity_id, error_code, error_message, request_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    utils.generateId(),
    operation,
    requestId || utils.generateId(),
    entityType,
    entityId,
    errorCode,
    errorMessage,
    requestData ? JSON.stringify(requestData) : null,
    utils.nowString()
  );
};

const getDepartmentBudget = async (departmentId) => {
  const database = await ensureDb();
  const dept = database.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
  if (!dept) return null;
  return {
    ...dept,
    remaining_budget: Number(dept.budget_amount) - Number(dept.used_amount)
  };
};

const checkBudget = async (departmentId, amount) => {
  const dept = await getDepartmentBudget(departmentId);
  if (!dept) {
    return { valid: false, code: utils.ERROR_CODES.DEPARTMENT_NOT_FOUND, message: `部门不存在: ${departmentId}` };
  }
  if (dept.remaining_budget < amount) {
    return {
      valid: false,
      code: utils.ERROR_CODES.BUDGET_INSUFFICIENT,
      message: `预算不足。当前剩余: ${dept.remaining_budget}元, 需要: ${amount}元`
    };
  }
  return { valid: true, department: dept };
};

const consumeBudget = async (departmentId, amount, operator) => {
  const database = await ensureDb();
  const deptBefore = await getDepartmentBudget(departmentId);
  const result = database.prepare(`
    UPDATE departments 
    SET used_amount = used_amount + ?, updated_at = ?
    WHERE id = ?
  `).run(amount, utils.nowString(), departmentId);
  
  const deptAfter = await getDepartmentBudget(departmentId);
  await recordStatusHistory(
    'DEPARTMENT',
    departmentId,
    null,
    null,
    'CONSUME_BUDGET',
    operator,
    `消耗预算: ${amount}元`,
    { used_amount: deptBefore.used_amount, remaining: deptBefore.remaining_budget },
    { used_amount: deptAfter.used_amount, remaining: deptAfter.remaining_budget }
  );
  return result;
};

const refundBudget = async (departmentId, amount, operator, reason) => {
  const database = await ensureDb();
  const deptBefore = await getDepartmentBudget(departmentId);
  const result = database.prepare(`
    UPDATE departments 
    SET used_amount = used_amount - ?, updated_at = ?
    WHERE id = ?
  `).run(amount, utils.nowString(), departmentId);
  
  const deptAfter = await getDepartmentBudget(departmentId);
  await recordStatusHistory(
    'DEPARTMENT',
    departmentId,
    null,
    null,
    'REFUND_BUDGET',
    operator,
    reason || `退还预算: ${amount}元`,
    { used_amount: deptBefore.used_amount, remaining: deptBefore.remaining_budget },
    { used_amount: deptAfter.used_amount, remaining: deptAfter.remaining_budget }
  );
  return result;
};

const checkVisitorArrived = async (appointmentId) => {
  const database = await ensureDb();
  const appointment = database.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(appointmentId);
  if (!appointment) {
    return { valid: false, code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: `预约不存在: ${appointmentId}` };
  }
  if (appointment.status !== utils.STATUS.APPOINTMENT.ARRIVED) {
    return {
      valid: false,
      code: utils.ERROR_CODES.VISITOR_NOT_ARRIVED,
      message: `访客尚未到达。当前状态: ${appointment.status}`
    };
  }
  return { valid: true, appointment };
};

const checkDuplicateVoucher = async (appointmentId) => {
  const database = await ensureDb();
  const existing = database.prepare(`
    SELECT * FROM meal_vouchers 
    WHERE appointment_id = ? AND status IN (?, ?, ?)
  `).get(appointmentId, utils.STATUS.VOUCHER.ISSUED, utils.STATUS.VOUCHER.REDEEMED, utils.STATUS.VOUCHER.EXPIRED);
  
  if (existing) {
    return {
      valid: false,
      code: utils.ERROR_CODES.VOUCHER_DUPLICATE,
      message: `该访客已存在有效餐券。券码: ${existing.voucher_code}, 状态: ${existing.status}`
    };
  }
  return { valid: true };
};

const checkVoucherRedemption = async (voucherCode, stallId) => {
  const database = await ensureDb();
  const voucher = database.prepare('SELECT * FROM meal_vouchers WHERE voucher_code = ?').get(voucherCode);
  if (!voucher) {
    return { valid: false, code: utils.ERROR_CODES.VOUCHER_NOT_FOUND, message: `餐券不存在: ${voucherCode}` };
  }
  if (voucher.status === utils.STATUS.VOUCHER.VOIDED) {
    return { valid: false, code: utils.ERROR_CODES.VOUCHER_VOIDED, message: `餐券已作废` };
  }
  if (voucher.status === utils.STATUS.VOUCHER.REDEEMED) {
    return { valid: false, code: utils.ERROR_CODES.VOUCHER_ALREADY_REDEEMED, message: `餐券已核销` };
  }
  if (voucher.status === utils.STATUS.VOUCHER.EXPIRED) {
    return { valid: false, code: utils.ERROR_CODES.VOUCHER_EXPIRED, message: `餐券已过期` };
  }
  if (utils.isExpired(voucher.valid_to)) {
    return { valid: false, code: utils.ERROR_CODES.VOUCHER_EXPIRED, message: `餐券已过期 (有效期至: ${voucher.valid_to})` };
  }
  
  const arrivalCheck = await checkVisitorArrived(voucher.appointment_id);
  if (!arrivalCheck.valid) {
    return arrivalCheck;
  }
  
  const stall = database.prepare('SELECT * FROM stalls WHERE id = ?').get(stallId);
  if (!stall) {
    return { valid: false, code: utils.ERROR_CODES.STALL_NOT_FOUND, message: `档口不存在: ${stallId}` };
  }
  
  return { valid: true, voucher, stall, appointment: arrivalCheck.appointment };
};

const getStatusHistory = async (entityType, entityId) => {
  const database = await ensureDb();
  const rows = database.prepare(`
    SELECT * FROM status_history 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY created_at DESC
  `).all(entityType, entityId);
  return rows.map(r => ({
    ...r,
    before_state: utils.safeJsonParse(r.before_state),
    after_state: utils.safeJsonParse(r.after_state)
  }));
};

const getFailedOperations = async (filters = {}) => {
  const database = await ensureDb();
  let sql = 'SELECT * FROM failed_operations WHERE 1=1';
  const params = [];
  
  if (filters.operation) {
    sql += ' AND operation = ?';
    params.push(filters.operation);
  }
  if (filters.error_code) {
    sql += ' AND error_code = ?';
    params.push(filters.error_code);
  }
  if (filters.entity_id) {
    sql += ' AND entity_id = ?';
    params.push(filters.entity_id);
  }
  sql += ' ORDER BY created_at DESC';
  
  const rows = database.prepare(sql).all(...params);
  return rows.map(r => ({
    ...r,
    request_data: utils.safeJsonParse(r.request_data)
  }));
};

module.exports = {
  ensureDb,
  checkIdempotency,
  recordIdempotency,
  recordStatusHistory,
  recordFailedOperation,
  getDepartmentBudget,
  checkBudget,
  consumeBudget,
  refundBudget,
  checkVisitorArrived,
  checkDuplicateVoucher,
  checkVoucherRedemption,
  getStatusHistory,
  getFailedOperations
};
