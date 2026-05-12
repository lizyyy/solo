const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const crypto = require('crypto');

function generateOrderNo() {
  const date = dayjs().format('YYYYMMDD');
  const count = db.prepare('SELECT COUNT(*) as count FROM orders WHERE order_no LIKE ?').get(`${date}%`).count;
  return `ICE${date}${String(count + 1).padStart(4, '0')}`;
}

function generateImportHash(orderData) {
  const data = `${orderData.customer_id}-${orderData.ice_spec_id}-${orderData.delivery_slot_id}-${orderData.quantity}-${dayjs().format('YYYYMMDD')}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

function checkDuplicateOrder(importHash) {
  const existing = db.prepare('SELECT id FROM orders WHERE import_hash = ?').get(importHash);
  return !!existing;
}

function checkCapacity(deliverySlotId, quantity, iceSpecId) {
  const slot = db.prepare('SELECT * FROM delivery_slots WHERE id = ?').get(deliverySlotId);
  const iceSpec = db.prepare('SELECT weight FROM ice_specs WHERE id = ?').get(iceSpecId);
  
  if (!slot || !iceSpec) return { available: false, message: '配送时段或冰块规格不存在' };
  
  const additionalLoad = quantity * iceSpec.weight;
  const totalLoad = slot.current_load + additionalLoad;
  
  return {
    available: totalLoad <= slot.max_capacity,
    currentLoad: slot.current_load,
    maxCapacity: slot.max_capacity,
    additionalLoad,
    totalLoad
  };
}

function createOrder(orderData, operator = 'system') {
  const importHash = generateImportHash(orderData);
  
  if (checkDuplicateOrder(importHash)) {
    return { success: false, message: '重复订单，已拦截', code: 'DUPLICATE_ORDER' };
  }
  
  const capacityCheck = checkCapacity(orderData.delivery_slot_id, orderData.quantity, orderData.ice_spec_id);
  if (!capacityCheck.available) {
    return { 
      success: false, 
      message: `产能不足，当前负载${capacityCheck.currentLoad}kg，新增${capacityCheck.additionalLoad}kg后将超过最大容量${capacityCheck.maxCapacity}kg`,
      code: 'INSUFFICIENT_CAPACITY',
      capacity: capacityCheck
    };
  }
  
  const iceSpec = db.prepare('SELECT price FROM ice_specs WHERE id = ?').get(orderData.ice_spec_id);
  const totalAmount = orderData.quantity * iceSpec.price;
  
  const orderId = uuidv4();
  const orderNo = generateOrderNo();
  const now = dayjs().format();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (
        id, order_no, customer_id, ice_spec_id, quantity, delivery_slot_id,
        status, total_amount, delivery_address, contact_phone, import_hash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, orderNo, orderData.customer_id, orderData.ice_spec_id,
      orderData.quantity, orderData.delivery_slot_id, totalAmount,
      orderData.delivery_address, orderData.contact_phone, importHash,
      now, now
    );
    
    const slot = db.prepare('SELECT * FROM delivery_slots WHERE id = ?').get(orderData.delivery_slot_id);
    const iceSpec = db.prepare('SELECT weight FROM ice_specs WHERE id = ?').get(orderData.ice_spec_id);
    const additionalLoad = orderData.quantity * iceSpec.weight;
    
    db.prepare(`
      UPDATE delivery_slots 
      SET current_load = current_load + ?, updated_at = ?
      WHERE id = ?
    `).run(additionalLoad, now, orderData.delivery_slot_id);
    
    db.prepare(`
      INSERT INTO order_history (id, order_id, action, new_status, operator, created_at)
      VALUES (?, ?, 'create', 'pending', ?, ?)
    `).run(uuidv4(), orderId, operator, now);
  });
  
  transaction();
  
  return { success: true, orderId, orderNo };
}

function confirmOrder(orderId, operator = 'system') {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { success: false, message: '订单不存在' };
  if (order.status !== 'pending') return { success: false, message: '订单状态不正确' };
  
  const now = dayjs().format();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE orders SET status = 'confirmed', updated_at = ? WHERE id = ?
    `).run(now, orderId);
    
    db.prepare(`
      INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
      VALUES (?, ?, 'confirm', 'pending', 'confirmed', ?, ?)
    `).run(uuidv4(), orderId, operator, now);
  });
  
  transaction();
  
  return { success: true };
}

function dispatchOrder(orderId, coolerId, operator = 'system') {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { success: false, message: '订单不存在' };
  if (order.status !== 'confirmed') return { success: false, message: '订单状态不正确' };
  
  const cooler = db.prepare('SELECT * FROM coolers WHERE id = ?').get(coolerId);
  if (!cooler || cooler.status !== 'available') {
    return { success: false, message: '保温箱不可用' };
  }
  
  const now = dayjs().format();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE orders 
      SET status = 'dispatched', cooler_id = ?, updated_at = ? 
      WHERE id = ?
    `).run(coolerId, now, orderId);
    
    db.prepare(`
      UPDATE coolers 
      SET status = 'in_use', customer_id = ?, assigned_at = ?, updated_at = ?
      WHERE id = ?
    `).run(order.customer_id, now, now, coolerId);
    
    db.prepare(`
      INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
      VALUES (?, ?, 'dispatch', 'confirmed', 'dispatched', ?, ?)
    `).run(uuidv4(), orderId, operator, now);
  });
  
  transaction();
  
  return { success: true };
}

function signOrder(orderId, signedBy, operator = 'system') {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { success: false, message: '订单不存在' };
  if (order.status !== 'dispatched') return { success: false, message: '订单状态不正确' };
  
  const now = dayjs().format();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE orders 
      SET status = 'signed', signed_at = ?, signed_by = ?, updated_at = ? 
      WHERE id = ?
    `).run(now, signedBy, now, orderId);
    
    db.prepare(`
      INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, created_at)
      VALUES (?, ?, 'sign', 'dispatched', 'signed', ?, ?)
    `).run(uuidv4(), orderId, operator, now);
  });
  
  transaction();
  
  return { success: true };
}

function refundOrder(orderId, reason, operator = 'system') {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return { success: false, message: '订单不存在' };
  if (['refunded', 'cancelled'].includes(order.status)) {
    return { success: false, message: '订单已退款或取消' };
  }
  
  const now = dayjs().format();
  
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE orders 
      SET status = 'refunded', refund_reason = ?, refund_amount = total_amount, refund_at = ?, updated_at = ? 
      WHERE id = ?
    `).run(reason, now, now, orderId);
    
    const iceSpec = db.prepare('SELECT weight FROM ice_specs WHERE id = ?').get(order.ice_spec_id);
    const loadToReduce = order.quantity * iceSpec.weight;
    
    db.prepare(`
      UPDATE delivery_slots 
      SET current_load = MAX(0, current_load - ?), updated_at = ?
      WHERE id = ?
    `).run(loadToReduce, now, order.delivery_slot_id);
    
    db.prepare(`
      INSERT INTO order_history (id, order_id, action, old_status, new_status, operator, notes, created_at)
      VALUES (?, ?, 'refund', ?, 'refunded', ?, ?, ?)
    `).run(uuidv4(), orderId, order.status, operator, reason, now);
  });
  
  transaction();
  
  return { success: true };
}

function checkSignTimeout() {
  const now = dayjs();
  const timeoutHours = 4;
  
  const orders = db.prepare(`
    SELECT o.* FROM orders o
    JOIN delivery_slots s ON o.delivery_slot_id = s.id
    WHERE o.status = 'dispatched'
  `).all();
  
  const refundedOrders = [];
  
  orders.forEach(order => {
    const slot = db.prepare('SELECT date, end_time FROM delivery_slots WHERE id = ?').get(order.delivery_slot_id);
    const deadline = dayjs(`${slot.date} ${slot.end_time}`).add(timeoutHours, 'hour');
    
    if (now.isAfter(deadline)) {
      refundOrder(order.id, '签收超时自动退款', 'system');
      refundedOrders.push(order.id);
    }
  });
  
  return refundedOrders;
}

function getOrders(filters = {}) {
  let sql = `
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
           s.name as ice_spec_name, s.weight as ice_spec_weight, s.price as ice_spec_price,
           sl.date as delivery_date, sl.start_time, sl.end_time,
           cool.serial_number as cooler_serial
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    LEFT JOIN coolers cool ON o.cooler_id = cool.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.status) {
    sql += ' AND o.status = ?';
    params.push(filters.status);
  }
  
  if (filters.customer_id) {
    sql += ' AND o.customer_id = ?';
    params.push(filters.customer_id);
  }
  
  if (filters.delivery_date) {
    sql += ' AND sl.date = ?';
    params.push(filters.delivery_date);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  return db.prepare(sql).all(...params);
}

function getOrderDetail(orderId) {
  const order = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
           s.name as ice_spec_name, s.weight as ice_spec_weight, s.price as ice_spec_price,
           sl.date as delivery_date, sl.start_time, sl.end_time,
           cool.serial_number as cooler_serial
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN ice_specs s ON o.ice_spec_id = s.id
    JOIN delivery_slots sl ON o.delivery_slot_id = sl.id
    LEFT JOIN coolers cool ON o.cooler_id = cool.id
    WHERE o.id = ?
  `).get(orderId);
  
  if (!order) return null;
  
  const history = db.prepare(`
    SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at ASC
  `).all(orderId);
  
  return { ...order, history };
}

module.exports = {
  createOrder,
  confirmOrder,
  dispatchOrder,
  signOrder,
  refundOrder,
  checkSignTimeout,
  getOrders,
  getOrderDetail,
  checkCapacity,
  generateImportHash
};
