const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory, getStatusHistory } = require('../utils');
const { getBooking, BOOKING_STATUS } = require('./bookingService');
const { getChannel } = require('./customerService');

const COMMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  FROZEN: 'frozen',
  SETTLED: 'settled',
  VOID: 'void'
};

const calculateCommission = (booking, channel) => {
  const rate = channel?.commission_rate || 0.03;
  const totalPrice = booking.total_price || 0;
  return totalPrice * rate;
};

const createCommission = (bookingId, operator = 'system') => {
  const id = uuid();
  const commissionCode = generateCode('CM');
  
  const booking = getBooking(bookingId);
  if (!booking) throw new Error('认购单不存在');
  
  if (booking.status !== BOOKING_STATUS.DEPOSITED && booking.status !== BOOKING_STATUS.SIGNED) {
    throw new Error(`认购单状态异常，当前状态: ${booking.status}，无法创建佣金`);
  }
  
  const existingCommission = prepare(`
    SELECT * FROM commissions WHERE booking_id = ? AND status != ?
  `).get([bookingId, COMMISSION_STATUS.VOID]);
  
  if (existingCommission) {
    return {
      is_new: false,
      commission: getCommission(existingCommission.id),
      message: '该认购单已有有效佣金'
    };
  }
  
  const channel = booking.channel_id ? getChannel(booking.channel_id) : null;
  const amount = calculateCommission(booking, channel);
  
  prepare(`
    INSERT INTO commissions (
      id, commission_code, booking_id, channel_id, amount,
      status, settlement_no, settled_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, commissionCode, bookingId, booking.channel_id, amount,
    COMMISSION_STATUS.PENDING, null, null, operator, now(), now()
  ]);
  
  addStatusHistory('commission', id, null, COMMISSION_STATUS.PENDING, '创建佣金', operator, {
    booking_id: bookingId,
    booking_code: booking.booking_code,
    amount: amount,
    rate: channel?.commission_rate || 0.03
  });
  
  return {
    is_new: true,
    commission: getCommission(id),
    message: '佣金创建成功'
  };
};

const getCommission = (id) => {
  return prepare(`
    SELECT c.*,
           b.booking_code, b.total_price,
           ch.channel_name, ch.commission_rate,
           p.property_code, pr.project_name,
           cu.name as customer_name
    FROM commissions c
    LEFT JOIN bookings b ON c.booking_id = b.id
    LEFT JOIN channels ch ON c.channel_id = ch.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers cu ON b.customer_id = cu.id
    WHERE c.id = ?
  `).get([id]);
};

const getCommissionByCode = (code) => {
  return prepare(`
    SELECT c.*,
           b.booking_code,
           ch.channel_name,
           p.property_code, pr.project_name,
           cu.name as customer_name
    FROM commissions c
    LEFT JOIN bookings b ON c.booking_id = b.id
    LEFT JOIN channels ch ON c.channel_id = ch.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers cu ON b.customer_id = cu.id
    WHERE c.commission_code = ?
  `).get([code]);
};

const getCommissionByBooking = (bookingId) => {
  return prepare(`
    SELECT * FROM commissions WHERE booking_id = ? ORDER BY created_at DESC
  `).all([bookingId]);
};

const approveCommission = (commissionId, operator = 'system') => {
  const commission = prepare('SELECT * FROM commissions WHERE id = ?').get([commissionId]);
  if (!commission) throw new Error('佣金记录不存在');
  
  if (commission.status !== COMMISSION_STATUS.PENDING) {
    throw new Error(`佣金状态异常，当前状态: ${commission.status}，无法审批`);
  }
  
  prepare(`
    UPDATE commissions SET status = ?, updated_at = ? WHERE id = ?
  `).run([COMMISSION_STATUS.APPROVED, now(), commissionId]);
  
  addStatusHistory('commission', commissionId, COMMISSION_STATUS.PENDING, COMMISSION_STATUS.APPROVED, '佣金审批通过', operator);
  
  return getCommission(commissionId);
};

const freezeCommission = (commissionId, reason, operator = 'system') => {
  const commission = prepare('SELECT * FROM commissions WHERE id = ?').get([commissionId]);
  if (!commission) throw new Error('佣金记录不存在');
  
  if (commission.status === COMMISSION_STATUS.SETTLED || commission.status === COMMISSION_STATUS.VOID) {
    throw new Error(`佣金状态异常，当前状态: ${commission.status}，无法冻结`);
  }
  
  const oldStatus = commission.status;
  prepare(`
    UPDATE commissions SET status = ?, updated_at = ? WHERE id = ?
  `).run([COMMISSION_STATUS.FROZEN, now(), commissionId]);
  
  addStatusHistory('commission', commissionId, oldStatus, COMMISSION_STATUS.FROZEN, '佣金冻结', operator, { reason });
  
  return getCommission(commissionId);
};

const unfreezeCommission = (commissionId, operator = 'system') => {
  const commission = prepare('SELECT * FROM commissions WHERE id = ?').get([commissionId]);
  if (!commission) throw new Error('佣金记录不存在');
  
  if (commission.status !== COMMISSION_STATUS.FROZEN) {
    throw new Error(`佣金状态异常，当前状态: ${commission.status}，无法解冻`);
  }
  
  prepare(`
    UPDATE commissions SET status = ?, updated_at = ? WHERE id = ?
  `).run([COMMISSION_STATUS.APPROVED, now(), commissionId]);
  
  addStatusHistory('commission', commissionId, COMMISSION_STATUS.FROZEN, COMMISSION_STATUS.APPROVED, '佣金解冻', operator);
  
  return getCommission(commissionId);
};

const voidCommission = (commissionId, reason, operator = 'system') => {
  const commission = prepare('SELECT * FROM commissions WHERE id = ?').get([commissionId]);
  if (!commission) throw new Error('佣金记录不存在');
  
  if (commission.status === COMMISSION_STATUS.VOID) {
    addStatusHistory('commission', commissionId, COMMISSION_STATUS.VOID, COMMISSION_STATUS.VOID, '重复作废忽略(幂等)', operator);
    return getCommission(commissionId);
  }
  
  if (commission.status === COMMISSION_STATUS.SETTLED) {
    throw new Error(`佣金已结算，无法作废`);
  }
  
  const oldStatus = commission.status;
  prepare(`
    UPDATE commissions SET status = ?, updated_at = ? WHERE id = ?
  `).run([COMMISSION_STATUS.VOID, now(), commissionId]);
  
  addStatusHistory('commission', commissionId, oldStatus, COMMISSION_STATUS.VOID, '佣金作废', operator, { reason });
  
  return getCommission(commissionId);
};

const settleCommission = (commissionId, settlementNo, operator = 'system') => {
  const commission = prepare('SELECT * FROM commissions WHERE id = ?').get([commissionId]);
  if (!commission) throw new Error('佣金记录不存在');
  
  if (commission.status !== COMMISSION_STATUS.APPROVED) {
    throw new Error(`佣金状态异常，当前状态: ${commission.status}，无法结算`);
  }
  
  prepare(`
    UPDATE commissions SET status = ?, settlement_no = ?, settled_at = ?, updated_at = ? WHERE id = ?
  `).run([COMMISSION_STATUS.SETTLED, settlementNo, now(), now(), commissionId]);
  
  addStatusHistory('commission', commissionId, COMMISSION_STATUS.APPROVED, COMMISSION_STATUS.SETTLED, '佣金结算', operator, {
    settlement_no: settlementNo
  });
  
  return getCommission(commissionId);
};

const getCommissionReport = (channelId = null, status = null) => {
  let sql = `
    SELECT c.*,
           b.booking_code, b.total_price, b.status as booking_status,
           ch.channel_code, ch.channel_name, ch.commission_rate,
           p.property_code, pr.project_name,
           cu.name as customer_name
    FROM commissions c
    LEFT JOIN bookings b ON c.booking_id = b.id
    LEFT JOIN channels ch ON c.channel_id = ch.id
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers cu ON b.customer_id = cu.id
    WHERE 1=1
  `;
  const params = [];
  
  if (channelId) {
    sql += ' AND c.channel_id = ?';
    params.push(channelId);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY c.created_at DESC';
  
  const commissions = prepare(sql).all(params);
  
  const summary = {
    total_pending: 0,
    total_approved: 0,
    total_frozen: 0,
    total_settled: 0,
    total_void: 0,
    net_payable: 0,
    count: commissions.length
  };
  
  commissions.forEach(c => {
    if (c.status === COMMISSION_STATUS.PENDING) {
      summary.total_pending += c.amount;
      summary.net_payable += c.amount;
    }
    if (c.status === COMMISSION_STATUS.APPROVED) {
      summary.total_approved += c.amount;
      summary.net_payable += c.amount;
    }
    if (c.status === COMMISSION_STATUS.FROZEN) {
      summary.total_frozen += c.amount;
    }
    if (c.status === COMMISSION_STATUS.SETTLED) {
      summary.total_settled += c.amount;
    }
    if (c.status === COMMISSION_STATUS.VOID) {
      summary.total_void += c.amount;
    }
  });
  
  return {
    summary,
    commissions: commissions.map(c => ({
      ...c,
      history: getStatusHistory('commission', c.id)
    }))
  };
};

module.exports = {
  COMMISSION_STATUS,
  calculateCommission,
  createCommission,
  getCommission,
  getCommissionByCode,
  getCommissionByBooking,
  approveCommission,
  freezeCommission,
  unfreezeCommission,
  voidCommission,
  settleCommission,
  getCommissionReport
};
