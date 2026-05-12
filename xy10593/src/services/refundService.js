const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory, getStatusHistory } = require('../utils');
const { updatePropertyStatus, STATUS: PROPERTY_STATUS } = require('./propertyService');
const { getBooking, BOOKING_STATUS } = require('./bookingService');
const { getDepositsByBooking, DEPOSIT_STATUS } = require('./depositService');
const { getCommissionByBooking, voidCommission, COMMISSION_STATUS } = require('./commissionService');

const REFUND_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed'
};

const createRefundApplication = (data) => {
  const id = uuid();
  const refundCode = generateCode('RF');
  
  const booking = getBooking(data.booking_id);
  if (!booking) throw new Error('认购单不存在');
  
  const allowedStatuses = [
    BOOKING_STATUS.LOCKED,
    BOOKING_STATUS.DEPOSITED,
    BOOKING_STATUS.SIGNED
  ];
  
  if (!allowedStatuses.includes(booking.status)) {
    throw new Error(`认购单状态异常，当前状态: ${booking.status}，无法申请退定`);
  }
  
  const deposits = getDepositsByBooking(data.booking_id);
  const paidDeposits = deposits.filter(d => d.status === DEPOSIT_STATUS.PAID);
  const totalPaid = paidDeposits.reduce((sum, d) => sum + d.amount, 0);
  
  const refundAmount = data.amount || totalPaid;
  if (refundAmount > totalPaid) {
    throw new Error(`退款金额不能超过已支付定金: ${totalPaid}`);
  }
  
  prepare(`
    INSERT INTO refunds (
      id, refund_code, booking_id, amount, reason,
      status, approver, refund_method, transaction_no, refunded_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, refundCode, data.booking_id, refundAmount, data.reason,
    REFUND_STATUS.DRAFT, null, null, null, null,
    data.created_by || 'system', now(), now()
  ]);
  
  addStatusHistory('refund', id, null, REFUND_STATUS.DRAFT, '创建退定申请', data.created_by || 'system', {
    booking_id: data.booking_id,
    booking_code: booking.booking_code,
    refund_amount: refundAmount
  });
  
  return getRefundApplication(id);
};

const getRefundApplication = (id) => {
  return prepare(`
    SELECT r.*,
           b.booking_code, b.status as booking_status,
           p.property_code, pr.project_name,
           c.name as customer_name, c.phone as customer_phone
    FROM refunds r
    LEFT JOIN bookings b ON r.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE r.id = ?
  `).get([id]);
};

const getRefundApplicationByCode = (code) => {
  return prepare(`
    SELECT r.*,
           b.booking_code,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM refunds r
    LEFT JOIN bookings b ON r.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE r.refund_code = ?
  `).get([code]);
};

const listRefundApplications = (bookingId = null, status = null) => {
  let sql = `
    SELECT r.*,
           b.booking_code,
           p.property_code, pr.project_name,
           c.name as customer_name
    FROM refunds r
    LEFT JOIN bookings b ON r.booking_id = b.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  
  if (bookingId) {
    sql += ' AND r.booking_id = ?';
    params.push(bookingId);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY r.created_at DESC';
  
  return prepare(sql).all(params);
};

const submitRefundForApproval = (refundId, operator = 'system') => {
  const refund = prepare('SELECT * FROM refunds WHERE id = ?').get([refundId]);
  if (!refund) throw new Error('退定申请不存在');
  
  if (refund.status !== REFUND_STATUS.DRAFT) {
    throw new Error(`申请状态异常，当前状态: ${refund.status}，无法提交审批`);
  }
  
  prepare(`
    UPDATE refunds SET status = ?, updated_at = ? WHERE id = ?
  `).run([REFUND_STATUS.PENDING_APPROVAL, now(), refundId]);
  
  addStatusHistory('refund', refundId, REFUND_STATUS.DRAFT, REFUND_STATUS.PENDING_APPROVAL, '提交审批', operator);
  
  const booking = getBooking(refund.booking_id);
  prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
  `).run([BOOKING_STATUS.REFUNDING, now(), refund.booking_id]);
  
  addStatusHistory('booking', refund.booking_id, booking.status, BOOKING_STATUS.REFUNDING, '退定审批中', operator, {
    refund_id: refundId
  });
  
  return getRefundApplication(refundId);
};

const approveRefund = (refundId, operator = 'system') => {
  const refund = prepare('SELECT * FROM refunds WHERE id = ?').get([refundId]);
  if (!refund) throw new Error('退定申请不存在');
  
  if (refund.status !== REFUND_STATUS.PENDING_APPROVAL) {
    throw new Error(`申请状态异常，当前状态: ${refund.status}，无法审批`);
  }
  
  prepare(`
    UPDATE refunds SET status = ?, approver = ?, updated_at = ? WHERE id = ?
  `).run([REFUND_STATUS.APPROVED, operator, now(), refundId]);
  
  addStatusHistory('refund', refundId, REFUND_STATUS.PENDING_APPROVAL, REFUND_STATUS.APPROVED, '审批通过', operator);
  
  return getRefundApplication(refundId);
};

const rejectRefund = (refundId, reason, operator = 'system') => {
  const refund = prepare('SELECT * FROM refunds WHERE id = ?').get([refundId]);
  if (!refund) throw new Error('退定申请不存在');
  
  if (refund.status !== REFUND_STATUS.PENDING_APPROVAL) {
    throw new Error(`申请状态异常，当前状态: ${refund.status}，无法驳回`);
  }
  
  prepare(`
    UPDATE refunds SET status = ?, approver = ?, updated_at = ? WHERE id = ?
  `).run([REFUND_STATUS.REJECTED, operator, now(), refundId]);
  
  addStatusHistory('refund', refundId, REFUND_STATUS.PENDING_APPROVAL, REFUND_STATUS.REJECTED, '审批驳回', operator, {
    reject_reason: reason
  });
  
  const booking = getBooking(refund.booking_id);
  const deposits = getDepositsByBooking(refund.booking_id);
  const hasPaidDeposit = deposits.some(d => d.status === DEPOSIT_STATUS.PAID);
  
  const newBookingStatus = hasPaidDeposit ? BOOKING_STATUS.DEPOSITED : BOOKING_STATUS.LOCKED;
  
  prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
  `).run([newBookingStatus, now(), refund.booking_id]);
  
  addStatusHistory('booking', refund.booking_id, BOOKING_STATUS.REFUNDING, newBookingStatus, '退定驳回，恢复原状态', operator);
  
  return getRefundApplication(refundId);
};

const executeRefund = (refundId, refundMethod, transactionNo, operator = 'system') => {
  const refund = prepare('SELECT * FROM refunds WHERE id = ?').get([refundId]);
  if (!refund) throw new Error('退定申请不存在');
  
  if (refund.status !== REFUND_STATUS.APPROVED) {
    throw new Error(`申请状态异常，当前状态: ${refund.status}，无法执行退款`);
  }
  
  prepare(`
    UPDATE refunds
    SET status = ?, refund_method = ?, transaction_no = ?, refunded_at = ?, updated_at = ?
    WHERE id = ?
  `).run([REFUND_STATUS.COMPLETED, refundMethod, transactionNo, now(), now(), refundId]);
  
  addStatusHistory('refund', refundId, REFUND_STATUS.APPROVED, REFUND_STATUS.COMPLETED, '退款完成', operator, {
    refund_method: refundMethod,
    transaction_no: transactionNo
  });
  
  const booking = getBooking(refund.booking_id);
  
  prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
  `).run([BOOKING_STATUS.REFUNDED, now(), refund.booking_id]);
  
  addStatusHistory('booking', refund.booking_id, BOOKING_STATUS.REFUNDING, BOOKING_STATUS.REFUNDED, '退定完成', operator, {
    refund_id: refundId
  });
  
  updatePropertyStatus(
    booking.property_id,
    PROPERTY_STATUS.AVAILABLE,
    '退定完成，房源解锁',
    operator,
    { refund_id: refundId, booking_id: refund.booking_id },
    null
  );
  
  const deposits = getDepositsByBooking(refund.booking_id);
  deposits.forEach(d => {
    if (d.status === DEPOSIT_STATUS.PAID) {
      prepare(`
        UPDATE deposits SET status = ?, updated_at = ? WHERE id = ?
      `).run([DEPOSIT_STATUS.REFUNDED, now(), d.id]);
      
      addStatusHistory('deposit', d.id, DEPOSIT_STATUS.PAID, DEPOSIT_STATUS.REFUNDED, '定金退还', operator, {
        refund_id: refundId
      });
    }
  });
  
  const commissions = getCommissionByBooking(refund.booking_id);
  commissions.forEach(c => {
    if (c.status !== COMMISSION_STATUS.VOID && c.status !== COMMISSION_STATUS.SETTLED) {
      voidCommission(c.id, '客户退定，佣金作废', operator);
    } else if (c.status === COMMISSION_STATUS.VOID) {
      addStatusHistory('commission', c.id, COMMISSION_STATUS.VOID, COMMISSION_STATUS.VOID, '退定确认，佣金已作废', operator);
    }
  });
  
  return getRefundApplication(refundId);
};

module.exports = {
  REFUND_STATUS,
  createRefundApplication,
  getRefundApplication,
  getRefundApplicationByCode,
  listRefundApplications,
  submitRefundForApproval,
  approveRefund,
  rejectRefund,
  executeRefund
};
