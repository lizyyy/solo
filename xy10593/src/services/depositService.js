const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory, getStatusHistory } = require('../utils');
const { updatePropertyStatus, STATUS: PROPERTY_STATUS } = require('./propertyService');
const { getBooking, BOOKING_STATUS } = require('./bookingService');

const DEPOSIT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

const createDeposit = (data) => {
  const id = uuid();
  const depositCode = generateCode('DP');
  
  const booking = getBooking(data.booking_id);
  if (!booking) throw new Error('认购单不存在');
  
  if (booking.status !== BOOKING_STATUS.LOCKED) {
    throw new Error(`认购单状态异常，当前状态: ${booking.status}，无法创建定金`);
  }
  
  prepare(`
    INSERT INTO deposits (
      id, deposit_code, booking_id, amount, payment_method,
      transaction_no, status, callback_id, paid_at, failure_reason,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, depositCode, data.booking_id, data.amount, data.payment_method,
    data.transaction_no, DEPOSIT_STATUS.PENDING, null, null, null,
    data.created_by || 'system', now(), now()
  ]);
  
  addStatusHistory('deposit', id, null, DEPOSIT_STATUS.PENDING, '创建定金单', data.created_by || 'system');
  
  return getDeposit(id);
};

const getDeposit = (id) => {
  return prepare(`
    SELECT d.*,
           b.booking_code, b.property_id, b.customer_id,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM deposits d
    LEFT JOIN bookings b ON d.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE d.id = ?
  `).get([id]);
};

const getDepositByCode = (code) => {
  return prepare(`
    SELECT d.*,
           b.booking_code,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM deposits d
    LEFT JOIN bookings b ON d.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE d.deposit_code = ?
  `).get([code]);
};

const getDepositsByBooking = (bookingId) => {
  return prepare(`
    SELECT * FROM deposits WHERE booking_id = ? ORDER BY created_at DESC
  `).all([bookingId]);
};

const processPaymentCallback = (callbackId, callbackData, operator = 'system') => {
  const existingDeposit = prepare('SELECT * FROM deposits WHERE callback_id = ?').get([callbackId]);
  
  if (existingDeposit) {
    addStatusHistory(
      'deposit',
      existingDeposit.id,
      existingDeposit.status,
      existingDeposit.status,
      '重复回调忽略(幂等)',
      operator,
      { callback_id: callbackId, message: '该回调已处理过' }
    );
    return {
      idempotent: true,
      deposit: getDeposit(existingDeposit.id),
      message: '支付回调已处理过，幂等返回'
    };
  }
  
  const deposit = prepare('SELECT * FROM deposits WHERE id = ?').get([callbackData.deposit_id]);
  if (!deposit) throw new Error('定金单不存在');
  
  if (deposit.status !== DEPOSIT_STATUS.PENDING) {
    throw new Error(`定金单状态异常，当前状态: ${deposit.status}`);
  }
  
  const success = callbackData.success !== false;
  const transactionNo = callbackData.transaction_no;
  const failureReason = callbackData.failure_reason;
  
  const newStatus = success ? DEPOSIT_STATUS.PAID : DEPOSIT_STATUS.FAILED;
  const paidAt = success ? now() : null;
  
  prepare(`
    UPDATE deposits
    SET callback_id = ?, status = ?, transaction_no = ?, paid_at = ?, failure_reason = ?, updated_at = ?
    WHERE id = ?
  `).run([callbackId, newStatus, transactionNo, paidAt, failureReason, now(), deposit.id]);
  
  addStatusHistory(
    'deposit',
    deposit.id,
    DEPOSIT_STATUS.PENDING,
    newStatus,
    success ? '支付成功' : '支付失败',
    operator,
    { callback_id: callbackId, transaction_no: transactionNo, failure_reason: failureReason }
  );
  
  if (success) {
    const booking = getBooking(deposit.booking_id);
    
    prepare(`
      UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
    `).run([BOOKING_STATUS.DEPOSITED, now(), booking.id]);
    
    addStatusHistory(
      'booking',
      booking.id,
      BOOKING_STATUS.LOCKED,
      BOOKING_STATUS.DEPOSITED,
      '定金到账，转为认购',
      operator
    );
    
    updatePropertyStatus(
      booking.property_id,
      PROPERTY_STATUS.DEPOSITED,
      '定金到账',
      operator,
      { booking_id: booking.id, deposit_id: deposit.id }
    );
  }
  
  return {
    idempotent: false,
    deposit: getDeposit(deposit.id),
    message: success ? '支付回调处理成功' : '支付回调处理(支付失败)'
  };
};

const getDepositLedger = (bookingId = null) => {
  let sql = `
    SELECT d.*,
           b.booking_code,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM deposits d
    LEFT JOIN bookings b ON d.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND d.booking_id = ?';
    params.push(bookingId);
  }
  
  sql += ' ORDER BY d.created_at DESC';
  
  const deposits = prepare(sql).all(params);
  
  const summary = {
    total_pending: 0,
    total_paid: 0,
    total_failed: 0,
    total_refunded: 0,
    net_amount: 0,
    count: deposits.length
  };
  
  deposits.forEach(d => {
    if (d.status === DEPOSIT_STATUS.PENDING) summary.total_pending += d.amount;
    if (d.status === DEPOSIT_STATUS.PAID) {
      summary.total_paid += d.amount;
      summary.net_amount += d.amount;
    }
    if (d.status === DEPOSIT_STATUS.FAILED) summary.total_failed += d.amount;
    if (d.status === DEPOSIT_STATUS.REFUNDED) {
      summary.total_refunded += d.amount;
      summary.net_amount -= d.amount;
    }
  });
  
  return {
    summary,
    deposits: deposits.map(d => ({
      ...d,
      history: getStatusHistory('deposit', d.id)
    }))
  };
};

const canSignContract = (bookingId) => {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error('认购单不存在');
  
  const deposits = getDepositsByBooking(bookingId);
  const paidDeposits = deposits.filter(d => d.status === DEPOSIT_STATUS.PAID);
  const totalPaid = paidDeposits.reduce((sum, d) => sum + d.amount, 0);
  
  const minDeposit = booking.deposit_amount || 0;
  
  return {
    can_sign: totalPaid >= minDeposit && booking.status === BOOKING_STATUS.DEPOSITED,
    total_paid: totalPaid,
    required_amount: minDeposit,
    current_status: booking.status
  };
};

module.exports = {
  DEPOSIT_STATUS,
  createDeposit,
  getDeposit,
  getDepositByCode,
  getDepositsByBooking,
  processPaymentCallback,
  getDepositLedger,
  canSignContract
};
