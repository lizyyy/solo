const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const qualificationService = require('./qualification-service');
const exceptionService = require('./exception-service');

async function createOrder(params) {
  const db = getDb();
  const { supplier_id, order_no, amount } = params;
  
  if (!supplier_id || !order_no) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      supplier_id,
      error: '订单信息不完整',
      raw_data: params
    });
    throw new Error('供应商ID和订单号为必填项');
  }
  
  const statusCheck = await qualificationService.checkSupplierStatus(supplier_id);
  
  let status = 'pending';
  let freeze_reason = null;
  
  if (!statusCheck.can_order) {
    status = 'blocked';
    freeze_reason = statusCheck.reasons.join('; ');
    
    await exceptionService.recordException({
      type: 'order_blocked',
      severity: 'medium',
      supplier_id,
      error: '下单被拦截',
      raw_data: { params, statusCheck }
    });
  }
  
  const id = 'ord_' + uuidv4().substring(0, 8);
  
  await db.run(`
    INSERT INTO orders (id, supplier_id, order_no, amount, status, freeze_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, supplier_id, order_no, amount, status, freeze_reason]);
  
  return getOrderById(id);
}

async function getOrderById(id) {
  const db = getDb();
  return db.get('SELECT * FROM orders WHERE id = ?', [id]);
}

async function getOrdersBySupplier(supplier_id) {
  const db = getDb();
  return db.all('SELECT * FROM orders WHERE supplier_id = ? ORDER BY created_at DESC', [supplier_id]);
}

async function getAllOrders(status) {
  const db = getDb();
  let sql = 'SELECT * FROM orders';
  const values = [];
  
  if (status) {
    sql += ' WHERE status = ?';
    values.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  
  return db.all(sql, values);
}

async function updateOrderStatus(id, status) {
  const db = getDb();
  
  const validStatuses = ['pending', 'blocked', 'frozen', 'approved', 'rejected', 'completed'];
  if (!validStatuses.includes(status)) {
    await exceptionService.recordException({
      type: 'validation_error',
      severity: 'low',
      order_id: id,
      error: `无效的订单状态: ${status}`,
      raw_data: { id, status }
    });
    throw new Error('无效的订单状态');
  }
  
  await db.run(`
    UPDATE orders SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [status, id]);
  
  return getOrderById(id);
}

async function checkOrderBeforeCreation(supplier_id) {
  const statusCheck = await qualificationService.checkSupplierStatus(supplier_id);
  
  return {
    can_create_order: statusCheck.can_order,
    reasons: statusCheck.reasons,
    expired_qualifications: statusCheck.expired_qualifications,
    active_risks: statusCheck.active_risks,
    pending_recoveries: statusCheck.pending_recoveries
  };
}

async function getBlockedOrders() {
  return getAllOrders('blocked');
}

async function getFrozenOrders() {
  return getAllOrders('frozen');
}

async function approveOrder(id, approved_by) {
  const db = getDb();
  
  const order = await getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }
  
  if (order.status !== 'pending') {
    throw new Error(`订单状态为 ${order.status}，无法审批`);
  }
  
  const statusCheck = await qualificationService.checkSupplierStatus(order.supplier_id);
  if (!statusCheck.can_order) {
    throw new Error(`供应商当前不可下单: ${statusCheck.reason}`);
  }
  
  await db.run(`
    UPDATE orders 
    SET status = 'approved', approved_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [approved_by, id]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: order.supplier_id,
    order_id: id,
    error: `订单已批准`,
    raw_data: { id, approved_by }
  });
  
  return getOrderById(id);
}

async function rejectOrder(id, reason, rejected_by) {
  const db = getDb();
  
  const order = await getOrderById(id);
  if (!order) {
    throw new Error('订单不存在');
  }
  
  if (order.status === 'rejected' || order.status === 'completed') {
    throw new Error(`订单状态为 ${order.status}，无法拒绝`);
  }
  
  await db.run(`
    UPDATE orders 
    SET status = 'rejected', rejected_by = ?, freeze_reason = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [rejected_by, reason || '未通过审批', id]);
  
  await exceptionService.recordException({
    type: 'business_event',
    severity: 'low',
    supplier_id: order.supplier_id,
    order_id: id,
    error: `订单被拒绝: ${reason || '未提供原因'}`,
    raw_data: { id, rejected_by, reason }
  });
  
  return getOrderById(id);
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersBySupplier,
  getAllOrders,
  updateOrderStatus,
  checkOrderBeforeCreation,
  getBlockedOrders,
  getFrozenOrders,
  approveOrder,
  rejectOrder
};
