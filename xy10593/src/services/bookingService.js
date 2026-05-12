const { prepare } = require('../database');
const { generateCode, now, uuid, addStatusHistory, addManualCorrection, getStatusHistory } = require('../utils');
const { updatePropertyStatus, STATUS: PROPERTY_STATUS, getPropertyTimeline } = require('./propertyService');
const { getCustomer } = require('./customerService');

const BOOKING_STATUS = {
  DRAFT: 'draft',
  LOCKED: 'locked',
  DEPOSITED: 'deposited',
  SIGNED: 'signed',
  NAME_CHANGING: 'name_changing',
  REFUNDING: 'refunding',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
};

const createBooking = (data) => {
  const id = uuid();
  const bookingCode = generateCode('BK');
  
  const property = prepare('SELECT * FROM properties WHERE id = ?').get([data.property_id]);
  if (!property) throw new Error('房源不存在');
  
  if (property.status !== PROPERTY_STATUS.AVAILABLE) {
    throw new Error(`房源状态异常，当前状态: ${property.status}，无法锁定`);
  }
  
  prepare(`
    INSERT INTO bookings (
      id, booking_code, property_id, customer_id, channel_id,
      status, total_price, booking_amount, deposit_amount,
      expiry_time, lock_source, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    id, bookingCode, data.property_id, data.customer_id, data.channel_id,
    BOOKING_STATUS.DRAFT, data.total_price, data.booking_amount, data.deposit_amount,
    data.expiry_time, data.lock_source || 'manual', data.notes, data.created_by || 'system',
    now(), now()
  ]);
  
  addStatusHistory('booking', id, null, BOOKING_STATUS.DRAFT, '创建认购单', data.created_by || 'system');
  
  return getBooking(id);
};

const lockProperty = (bookingId, operator = 'system') => {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error('认购单不存在');
  
  if (booking.status !== BOOKING_STATUS.DRAFT) {
    throw new Error(`认购单状态异常，当前状态: ${booking.status}，无法锁定`);
  }
  
  const property = prepare('SELECT * FROM properties WHERE id = ?').get([booking.property_id]);
  
  if (property.status !== PROPERTY_STATUS.AVAILABLE) {
    throw new Error(`房源已被锁定或销售，当前状态: ${property.status}`);
  }
  
  prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
  `).run([BOOKING_STATUS.LOCKED, now(), bookingId]);
  
  updatePropertyStatus(
    booking.property_id,
    PROPERTY_STATUS.LOCKED,
    '房源锁定',
    operator,
    { booking_id: bookingId, booking_code: booking.booking_code },
    bookingId
  );
  
  addStatusHistory('booking', bookingId, BOOKING_STATUS.DRAFT, BOOKING_STATUS.LOCKED, '锁定房源', operator);
  
  return getBooking(bookingId);
};

const getBooking = (id) => {
  return prepare(`
    SELECT b.*,
           p.property_code, p.building_no, p.unit_no, p.room_no, p.floor, p.area, p.status as property_status,
           pr.project_name, pr.project_code,
           c.name as customer_name, c.phone as customer_phone, c.customer_code,
           ch.channel_name, ch.commission_rate
    FROM bookings b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    WHERE b.id = ?
  `).get([id]);
};

const getBookingByCode = (code) => {
  return prepare(`
    SELECT b.*,
           p.property_code, p.building_no, p.unit_no, p.room_no, p.floor, p.area, p.status as property_status,
           pr.project_name, pr.project_code,
           c.name as customer_name, c.phone as customer_phone, c.customer_code,
           ch.channel_name, ch.commission_rate
    FROM bookings b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    WHERE b.booking_code = ?
  `).get([code]);
};

const listBookings = (status = null, customerId = null, propertyId = null) => {
  let sql = `
    SELECT b.*,
           p.property_code, p.status as property_status,
           pr.project_name,
           c.name as customer_name, c.phone as customer_phone,
           ch.channel_name
    FROM bookings b
    LEFT JOIN properties p ON b.property_id = p.id
    LEFT JOIN projects pr ON p.project_id = pr.id
    LEFT JOIN customers c ON b.customer_id = c.id
    LEFT JOIN channels ch ON b.channel_id = ch.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    sql += ' AND b.status = ?';
    params.push(status);
  }
  if (customerId) {
    sql += ' AND b.customer_id = ?';
    params.push(customerId);
  }
  if (propertyId) {
    sql += ' AND b.property_id = ?';
    params.push(propertyId);
  }
  
  sql += ' ORDER BY b.created_at DESC';
  
  return prepare(sql).all(params);
};

const getBookingDetail = (bookingId) => {
  const booking = getBooking(bookingId);
  if (!booking) return null;
  
  const deposits = prepare(`
    SELECT * FROM deposits WHERE booking_id = ? ORDER BY created_at DESC
  `).all([bookingId]);
  
  const commissions = prepare(`
    SELECT * FROM commissions WHERE booking_id = ? ORDER BY created_at DESC
  `).all([bookingId]);
  
  const nameChanges = prepare(`
    SELECT nca.*,
           oc.name as old_customer_name,
           nc.name as new_customer_name
    FROM name_change_applications nca
    LEFT JOIN customers oc ON nca.old_customer_id = oc.id
    LEFT JOIN customers nc ON nca.new_customer_id = nc.id
    WHERE nca.booking_id = ?
    ORDER BY nca.created_at DESC
  `).all([bookingId]);
  
  const refunds = prepare(`
    SELECT * FROM refunds WHERE booking_id = ? ORDER BY created_at DESC
  `).all([bookingId]);
  
  const history = getStatusHistory('booking', bookingId);
  
  return {
    booking,
    deposits,
    commissions,
    name_changes: nameChanges,
    refunds,
    status_history: history
  };
};

const correctBooking = (bookingId, fieldName, newValue, reason, operator) => {
  const booking = getBooking(bookingId);
  if (!booking) throw new Error('认购单不存在');
  
  const oldValue = booking[fieldName];
  if (oldValue === undefined) throw new Error('字段不存在');
  
  prepare(`UPDATE bookings SET ${fieldName} = ?, updated_at = ? WHERE id = ?`).run([newValue, now(), bookingId]);
  
  addManualCorrection('booking', bookingId, fieldName, oldValue, newValue, reason, operator);
  
  return getBooking(bookingId);
};

module.exports = {
  BOOKING_STATUS,
  createBooking,
  lockProperty,
  getBooking,
  getBookingByCode,
  listBookings,
  getBookingDetail,
  correctBooking
};
