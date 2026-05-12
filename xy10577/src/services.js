const dbModule = require('./database');
const utils = require('./utils');
const rules = require('./rules');

let db = null;

const ensureDb = async () => {
  if (!db) {
    db = await dbModule.initDb();
  }
  return db;
};

const createDepartment = async (data, operator = 'system') => {
  await ensureDb();
  const id = data.id || utils.generateId();
  const nowStr = utils.nowString();
  
  db.prepare(`
    INSERT INTO departments (id, name, budget_amount, used_amount, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, ?)
  `).run(id, data.name, data.budget_amount || 0, nowStr, nowStr);
  
  await rules.recordStatusHistory('DEPARTMENT', id, null, null, 'CREATE', operator, '创建部门', null, { name: data.name, budget: data.budget_amount });
  return getDepartment(id);
};

const getDepartment = (id) => rules.getDepartmentBudget(id);

const listDepartments = async () => {
  await ensureDb();
  return db.prepare('SELECT * FROM departments ORDER BY name').all().map(d => ({
    ...d,
    remaining_budget: Number(d.budget_amount) - Number(d.used_amount)
  }));
};

const createStall = async (data) => {
  await ensureDb();
  const id = data.id || utils.generateId();
  db.prepare(`
    INSERT INTO stalls (id, name, location, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, data.name, data.location || null, utils.nowString());
  return getStall(id);
};

const getStall = async (id) => {
  await ensureDb();
  return db.prepare('SELECT * FROM stalls WHERE id = ?').get(id);
};

const listStalls = async () => {
  await ensureDb();
  return db.prepare('SELECT * FROM stalls ORDER BY name').all();
};

const createAppointment = async (data, operator = 'system', requestId = null) => {
  await ensureDb();
  const idempotencyKey = requestId || data.request_id;
  if (idempotencyKey) {
    const check = await rules.checkIdempotency(idempotencyKey, 'CREATE_APPOINTMENT');
    if (check.exists) return { ...check.response, is_idempotent: true };
  }

  const id = data.id || utils.generateId();
  const dept = await rules.getDepartmentBudget(data.host_department_id);
  if (!dept) {
    await rules.recordFailedOperation('CREATE_APPOINTMENT', requestId, 'APPOINTMENT', id, utils.ERROR_CODES.DEPARTMENT_NOT_FOUND, '部门不存在', data);
    throw { code: utils.ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' };
  }

  const nowStr = utils.nowString();
  db.prepare(`
    INSERT INTO visitor_appointments 
    (id, visitor_name, visitor_phone, visitor_company, host_department_id, host_name, 
     appointment_date, appointment_time, status, actual_arrival_time, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.visitor_name, data.visitor_phone || null, data.visitor_company || null,
    data.host_department_id, data.host_name || null,
    data.appointment_date, data.appointment_time || null,
    utils.STATUS.APPOINTMENT.SCHEDULED, null, nowStr, nowStr
  );
  
  await rules.recordStatusHistory('APPOINTMENT', id, null, utils.STATUS.APPOINTMENT.SCHEDULED, 'CREATE', operator, '创建预约', null, {
    visitor_name: data.visitor_name,
    appointment_date: data.appointment_date
  });

  const result = await getAppointment(id);
  
  if (idempotencyKey) {
    await rules.recordIdempotency(idempotencyKey, 'CREATE_APPOINTMENT', id, result);
  }
  return { ...result, is_idempotent: false };
};

const getAppointment = async (id) => {
  await ensureDb();
  const appt = db.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(id);
  if (!appt) return null;
  const dept = await rules.getDepartmentBudget(appt.host_department_id);
  return {
    ...appt,
    host_department: dept ? { id: dept.id, name: dept.name } : null,
    history: await rules.getStatusHistory('APPOINTMENT', id)
  };
};

const updateAppointmentStatus = async (id, newStatus, operator = 'system', reason = null, arrivalTime = null) => {
  await ensureDb();
  const appt = db.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(id);
  if (!appt) {
    throw { code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: '预约不存在' };
  }
  if (appt.status === newStatus) return getAppointment(id);

  const beforeState = { status: appt.status, actual_arrival_time: appt.actual_arrival_time };
  const nowStr = utils.nowString();
  
  db.prepare(`
    UPDATE visitor_appointments 
    SET status = ?, actual_arrival_time = COALESCE(?, actual_arrival_time), updated_at = ?
    WHERE id = ?
  `).run(newStatus, arrivalTime || null, nowStr, id);
  
  await rules.recordStatusHistory('APPOINTMENT', id, appt.status, newStatus, 'STATUS_CHANGE', operator, reason, beforeState, {
    status: newStatus,
    actual_arrival_time: arrivalTime || appt.actual_arrival_time
  });
  
  return getAppointment(id);
};

const checkInVisitor = async (appointmentId, operator = 'system') => {
  await ensureDb();
  const appt = db.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(appointmentId);
  if (!appt) {
    throw { code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: '预约不存在' };
  }
  if (appt.status === utils.STATUS.APPOINTMENT.ARRIVED) return getAppointment(appointmentId);
  if (appt.status !== utils.STATUS.APPOINTMENT.SCHEDULED) {
    throw { code: utils.ERROR_CODES.INVALID_STATE_TRANSITION, message: `当前状态(${appt.status})不允许签到` };
  }
  return updateAppointmentStatus(appointmentId, utils.STATUS.APPOINTMENT.ARRIVED, operator, '访客签到', utils.nowString());
};

const issueVoucher = async (data, operator = 'system', requestId = null) => {
  await ensureDb();
  const idempotencyKey = requestId || data.request_id;
  if (idempotencyKey) {
    const check = await rules.checkIdempotency(idempotencyKey, 'ISSUE_VOUCHER');
    if (check.exists) return { ...check.response, is_idempotent: true };
  }

  const appointmentId = data.appointment_id;
  const amount = data.amount || 50.00;
  
  const appointment = db.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(appointmentId);
  if (!appointment) {
    await rules.recordFailedOperation('ISSUE_VOUCHER', requestId, 'VOUCHER', null, utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, '预约不存在', data);
    throw { code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: '预约不存在' };
  }

  const arrivalCheck = await rules.checkVisitorArrived(appointmentId);
  if (!arrivalCheck.valid) {
    await rules.recordFailedOperation('ISSUE_VOUCHER', requestId, 'VOUCHER', null, arrivalCheck.code, arrivalCheck.message, data);
    throw { code: arrivalCheck.code, message: arrivalCheck.message };
  }

  const duplicateCheck = await rules.checkDuplicateVoucher(appointmentId);
  if (!duplicateCheck.valid) {
    await rules.recordFailedOperation('ISSUE_VOUCHER', requestId, 'VOUCHER', null, duplicateCheck.code, duplicateCheck.message, data);
    throw { code: duplicateCheck.code, message: duplicateCheck.message };
  }

  const departmentId = data.department_id || appointment.host_department_id;
  const budgetCheck = await rules.checkBudget(departmentId, amount);
  if (!budgetCheck.valid) {
    await rules.recordFailedOperation('ISSUE_VOUCHER', requestId, 'VOUCHER', null, budgetCheck.code, budgetCheck.message, data);
    throw { code: budgetCheck.code, message: budgetCheck.message };
  }

  const id = data.id || utils.generateId();
  const voucherCode = data.voucher_code || utils.generateVoucherCode();
  const validFrom = data.valid_from || utils.nowString();
  const validTo = data.valid_to || utils.now().add(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss');
  const nowStr = utils.nowString();

  await rules.consumeBudget(departmentId, amount, operator);
  db.prepare(`
    INSERT INTO meal_vouchers 
    (id, appointment_id, department_id, voucher_code, amount, valid_from, valid_to, status, 
     issued_by, issued_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, appointmentId, departmentId, voucherCode, amount,
    validFrom, validTo, utils.STATUS.VOUCHER.ISSUED,
    operator, nowStr, nowStr, nowStr
  );
  
  await rules.recordStatusHistory('VOUCHER', id, null, utils.STATUS.VOUCHER.ISSUED, 'ISSUE', operator, `发放餐券，金额: ${amount}元`, null, {
    voucher_code: voucherCode,
    amount: amount,
    valid_to: validTo
  });

  const result = await getVoucher(id);
  
  if (idempotencyKey) {
    await rules.recordIdempotency(idempotencyKey, 'ISSUE_VOUCHER', id, result);
  }
  return { ...result, is_idempotent: false };
};

const getVoucher = (id) => getVoucherInternal(id, 'id');
const getVoucherByCode = (code) => getVoucherInternal(code, 'voucher_code');

const getVoucherInternal = async (value, field) => {
  await ensureDb();
  const sql = field === 'id' 
    ? 'SELECT * FROM meal_vouchers WHERE id = ?'
    : 'SELECT * FROM meal_vouchers WHERE voucher_code = ?';
  const voucher = db.prepare(sql).get(value);
  if (!voucher) return null;
  return enrichVoucher(voucher);
};

const enrichVoucher = async (voucher) => {
  const appt = db.prepare('SELECT * FROM visitor_appointments WHERE id = ?').get(voucher.appointment_id);
  const dept = await rules.getDepartmentBudget(voucher.department_id);
  const redemption = db.prepare('SELECT * FROM redemptions WHERE voucher_id = ?').get(voucher.id);
  let stall = null;
  if (redemption) {
    stall = db.prepare('SELECT * FROM stalls WHERE id = ?').get(redemption.stall_id);
  }
  
  return {
    ...voucher,
    appointment: appt ? {
      id: appt.id,
      visitor_name: appt.visitor_name,
      visitor_company: appt.visitor_company,
      status: appt.status
    } : null,
    department: dept ? { id: dept.id, name: dept.name } : null,
    redemption: redemption ? {
      ...redemption,
      stall: stall ? { id: stall.id, name: stall.name, location: stall.location } : null
    } : null,
    history: await rules.getStatusHistory('VOUCHER', voucher.id)
  };
};

const listVouchers = async (filters = {}) => {
  await ensureDb();
  let sql = 'SELECT * FROM meal_vouchers WHERE 1=1';
  const params = [];
  
  if (filters.appointment_id) {
    sql += ' AND appointment_id = ?';
    params.push(filters.appointment_id);
  }
  if (filters.department_id) {
    sql += ' AND department_id = ?';
    params.push(filters.department_id);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.voucher_code) {
    sql += ' AND voucher_code = ?';
    params.push(filters.voucher_code);
  }
  sql += ' ORDER BY issued_at DESC';
  
  const vouchers = db.prepare(sql).all(...params);
  const enriched = [];
  for (const v of vouchers) {
    enriched.push(await enrichVoucher(v));
  }
  return enriched;
};

const redeemVoucher = async (data, operator = 'system', requestId = null) => {
  await ensureDb();
  const idempotencyKey = requestId || data.request_id;
  if (idempotencyKey) {
    const check = await rules.checkIdempotency(idempotencyKey, 'REDEEM_VOUCHER');
    if (check.exists) return { ...check.response, is_idempotent: true };
  }

  const checkResult = await rules.checkVoucherRedemption(data.voucher_code, data.stall_id);
  if (!checkResult.valid) {
    await rules.recordFailedOperation('REDEEM_VOUCHER', requestId, 'VOUCHER', null, checkResult.code, checkResult.message, data);
    throw { code: checkResult.code, message: checkResult.message };
  }

  const { voucher, stall } = checkResult;
  const nowStr = utils.nowString();
  const redemptionId = utils.generateId();

  db.prepare(`
    INSERT INTO redemptions (id, voucher_id, stall_id, redeemed_at, redeemed_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(redemptionId, voucher.id, stall.id, nowStr, operator);
  
  db.prepare(`
    UPDATE meal_vouchers 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `).run(utils.STATUS.VOUCHER.REDEEMED, nowStr, voucher.id);
  
  await rules.recordStatusHistory('VOUCHER', voucher.id, voucher.status, utils.STATUS.VOUCHER.REDEEMED, 'REDEEM', operator, `在档口[${stall.name}]核销`, { status: voucher.status }, {
    status: utils.STATUS.VOUCHER.REDEEMED,
    stall_name: stall.name
  });

  const result = await getVoucher(voucher.id);
  
  if (idempotencyKey) {
    await rules.recordIdempotency(idempotencyKey, 'REDEEM_VOUCHER', voucher.id, result);
  }
  return { ...result, is_idempotent: false };
};

const voidVoucher = async (voucherId, reason, operator = 'system') => {
  await ensureDb();
  const voucher = db.prepare('SELECT * FROM meal_vouchers WHERE id = ?').get(voucherId);
  if (!voucher) {
    throw { code: utils.ERROR_CODES.VOUCHER_NOT_FOUND, message: '餐券不存在' };
  }
  if (voucher.status === utils.STATUS.VOUCHER.VOIDED) return getVoucher(voucherId);
  if (voucher.status === utils.STATUS.VOUCHER.REDEEMED) {
    throw { code: utils.ERROR_CODES.INVALID_STATE_TRANSITION, message: '已核销的餐券不能作废' };
  }

  const nowStr = utils.nowString();
  const beforeStatus = voucher.status;
  const beforeState = { status: beforeStatus, amount: voucher.amount };

  db.prepare(`
    UPDATE meal_vouchers 
    SET status = ?, voided_by = ?, voided_at = ?, void_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(utils.STATUS.VOUCHER.VOIDED, operator, nowStr, reason || '人工作废', nowStr, voucherId);
  
  if (beforeStatus !== utils.STATUS.VOUCHER.EXPIRED) {
    await rules.refundBudget(voucher.department_id, voucher.amount, operator, `餐券作废退款`);
  }
  
  await rules.recordStatusHistory('VOUCHER', voucherId, beforeStatus, utils.STATUS.VOUCHER.VOIDED, 'VOID', operator, reason || '人工作废', beforeState, {
    status: utils.STATUS.VOUCHER.VOIDED,
    refund: voucher.amount
  });

  return getVoucher(voucherId);
};

const expireVouchers = async () => {
  await ensureDb();
  const nowStr = utils.nowString();
  const toExpire = db.prepare(`
    SELECT * FROM meal_vouchers 
    WHERE status = ? AND valid_to < ?
  `).all(utils.STATUS.VOUCHER.ISSUED, nowStr);
  
  const results = [];
  for (const v of toExpire) {
    db.prepare(`
      UPDATE meal_vouchers 
      SET status = ?, expired_at = ?, updated_at = ?
      WHERE id = ?
    `).run(utils.STATUS.VOUCHER.EXPIRED, nowStr, nowStr, v.id);
    
    await rules.refundBudget(v.department_id, v.amount, 'system', `餐券过期自动退款`);
    
    await rules.recordStatusHistory('VOUCHER', v.id, v.status, utils.STATUS.VOUCHER.EXPIRED, 'EXPIRE', 'system', `有效期至: ${v.valid_to}`, { status: v.status }, {
      status: utils.STATUS.VOUCHER.EXPIRED,
      expired_at: nowStr
    });
    
    results.push(await getVoucher(v.id));
  }
  return { expired_count: results.length, vouchers: results };
};

const getVisitorMealStatus = async (appointmentId) => {
  const appt = await getAppointment(appointmentId);
  if (!appt) return null;
  
  const vouchers = await listVouchers({ appointment_id: appointmentId });
  const activeVoucher = vouchers.find(v => v.status === utils.STATUS.VOUCHER.ISSUED || v.status === utils.STATUS.VOUCHER.REDEEMED);
  
  return {
    appointment_id: appointmentId,
    visitor_name: appt.visitor_name,
    visitor_company: appt.visitor_company,
    appointment_status: appt.status,
    actual_arrival_time: appt.actual_arrival_time,
    has_voucher: !!activeVoucher,
    voucher_status: activeVoucher ? activeVoucher.status : null,
    voucher_code: activeVoucher ? activeVoucher.voucher_code : null,
    amount: activeVoucher ? activeVoucher.amount : null,
    redeemed: activeVoucher ? activeVoucher.status === utils.STATUS.VOUCHER.REDEEMED : false,
    redemption_time: activeVoucher?.redemption?.redeemed_at || null,
    stall_name: activeVoucher?.redemption?.stall?.name || null
  };
};

const getDepartmentExpense = async (departmentId, startDate = null, endDate = null) => {
  await ensureDb();
  const dept = await rules.getDepartmentBudget(departmentId);
  if (!dept) return null;
  
  let sql = `
    SELECT mv.*, 
      r.redeemed_at, r.stall_id,
      s.name as stall_name
    FROM meal_vouchers mv
    LEFT JOIN redemptions r ON mv.id = r.voucher_id
    LEFT JOIN stalls s ON r.stall_id = s.id
    WHERE mv.department_id = ?
  `;
  const params = [departmentId];
  
  if (startDate) {
    sql += ' AND mv.issued_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND mv.issued_at <= ?';
    params.push(endDate);
  }
  sql += ' ORDER BY mv.issued_at DESC';
  
  const vouchers = db.prepare(sql).all(...params);
  
  const summary = {
    issued: vouchers.length,
    redeemed: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.REDEEMED).length,
    voided: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.VOIDED).length,
    expired: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.EXPIRED).length,
    total_amount: vouchers.reduce((sum, v) => sum + Number(v.amount), 0),
    redeemed_amount: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.REDEEMED).reduce((sum, v) => sum + Number(v.amount), 0),
    refunded_amount: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.VOIDED || v.status === utils.STATUS.VOUCHER.EXPIRED).reduce((sum, v) => sum + Number(v.amount), 0)
  };
  
  return {
    department: { id: dept.id, name: dept.name },
    budget_total: dept.budget_amount,
    budget_used: dept.used_amount,
    budget_remaining: dept.remaining_budget,
    summary,
    vouchers: vouchers.map(v => ({
      id: v.id,
      voucher_code: v.voucher_code,
      amount: v.amount,
      status: v.status,
      issued_at: v.issued_at,
      redeemed_at: v.redeemed_at,
      stall_name: v.stall_name
    }))
  };
};

const getStallRedemptionDetails = async (stallId, startDate = null, endDate = null) => {
  await ensureDb();
  const stall = await getStall(stallId);
  if (!stall) return null;
  
  let sql = `
    SELECT r.*,
      mv.voucher_code, mv.amount, mv.department_id,
      d.name as department_name,
      va.visitor_name, va.visitor_company
    FROM redemptions r
    JOIN meal_vouchers mv ON r.voucher_id = mv.id
    JOIN departments d ON mv.department_id = d.id
    JOIN visitor_appointments va ON mv.appointment_id = va.id
    WHERE r.stall_id = ?
  `;
  const params = [stallId];
  
  if (startDate) {
    sql += ' AND r.redeemed_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND r.redeemed_at <= ?';
    params.push(endDate);
  }
  sql += ' ORDER BY r.redeemed_at DESC';
  
  const redemptions = db.prepare(sql).all(...params);
  
  return {
    stall: { id: stall.id, name: stall.name, location: stall.location },
    total_count: redemptions.length,
    total_amount: redemptions.reduce((sum, r) => sum + Number(r.amount), 0),
    redemptions: redemptions
  };
};

const getMonthlyReport = async (year, month) => {
  await ensureDb();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()} 23:59:59`;
  
  const vouchers = db.prepare(`
    SELECT mv.*, d.name as department_name
    FROM meal_vouchers mv
    JOIN departments d ON mv.department_id = d.id
    WHERE mv.issued_at >= ? AND mv.issued_at <= ?
  `).all(startDate, endDate);
  
  const redemptions = db.prepare(`
    SELECT r.*, mv.amount, s.name as stall_name, d.name as department_name
    FROM redemptions r
    JOIN meal_vouchers mv ON r.voucher_id = mv.id
    JOIN stalls s ON r.stall_id = s.id
    JOIN departments d ON mv.department_id = d.id
    WHERE r.redeemed_at >= ? AND r.redeemed_at <= ?
  `).all(startDate, endDate);
  
  const deptStats = {};
  for (const v of vouchers) {
    if (!deptStats[v.department_id]) {
      deptStats[v.department_id] = {
        department_id: v.department_id,
        department_name: v.department_name,
        issued: 0,
        redeemed: 0,
        voided: 0,
        expired: 0,
        issued_amount: 0,
        redeemed_amount: 0
      };
    }
    const s = deptStats[v.department_id];
    s.issued++;
    s.issued_amount += Number(v.amount);
    if (v.status === utils.STATUS.VOUCHER.REDEEMED) { s.redeemed++; s.redeemed_amount += Number(v.amount); }
    if (v.status === utils.STATUS.VOUCHER.VOIDED) s.voided++;
    if (v.status === utils.STATUS.VOUCHER.EXPIRED) s.expired++;
  }
  
  const stallStats = {};
  for (const r of redemptions) {
    if (!stallStats[r.stall_id]) {
      stallStats[r.stall_id] = {
        stall_id: r.stall_id,
        stall_name: r.stall_name,
        count: 0,
        amount: 0
      };
    }
    stallStats[r.stall_id].count++;
    stallStats[r.stall_id].amount += Number(r.amount);
  }
  
  const failedOps = await rules.getFailedOperations();
  const periodFailed = failedOps.filter(f => f.created_at >= startDate && f.created_at <= endDate);
  
  return {
    period: `${year}年${month}月`,
    start_date: startDate,
    end_date: endDate,
    summary: {
      vouchers_issued: vouchers.length,
      vouchers_redeemed: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.REDEEMED).length,
      vouchers_voided: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.VOIDED).length,
      vouchers_expired: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.EXPIRED).length,
      total_amount: vouchers.reduce((sum, v) => sum + Number(v.amount), 0),
      redeemed_amount: vouchers.filter(v => v.status === utils.STATUS.VOUCHER.REDEEMED).reduce((sum, v) => sum + Number(v.amount), 0),
      failed_operations: periodFailed.length
    },
    by_department: Object.values(deptStats),
    by_stall: Object.values(stallStats),
    failed_operations: periodFailed.slice(0, 50)
  };
};

module.exports = {
  ensureDb,
  createDepartment,
  getDepartment,
  listDepartments,
  createStall,
  getStall,
  listStalls,
  createAppointment,
  getAppointment,
  checkInVisitor,
  updateAppointmentStatus,
  issueVoucher,
  getVoucher,
  getVoucherByCode,
  listVouchers,
  redeemVoucher,
  voidVoucher,
  expireVouchers,
  getVisitorMealStatus,
  getDepartmentExpense,
  getStallRedemptionDetails,
  getMonthlyReport
};
