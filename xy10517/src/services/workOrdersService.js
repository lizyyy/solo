const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database/connection');
const { createAuditLog, getAuditLogs } = require('../utils/audit');

function createWorkOrder(orderData, operator = 'system') {
  const db = getDB();
  
  const orderId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO work_orders (
      id, order_code, customer_name, customer_contact, issue_type, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    orderData.order_code,
    orderData.customer_name,
    orderData.customer_contact || null,
    orderData.issue_type || null,
    'open',
    now,
    now
  );
  
  createAuditLog('work_order', orderId, 'create', null, {
    order_code: orderData.order_code,
    customer_name: orderData.customer_name
  }, operator);
  
  return getWorkOrderById(orderId);
}

function getWorkOrderById(orderId) {
  const db = getDB();
  return db.prepare('SELECT * FROM work_orders WHERE id = ?').get(orderId);
}

function getWorkOrderByCode(orderCode) {
  const db = getDB();
  return db.prepare('SELECT * FROM work_orders WHERE order_code = ?').get(orderCode);
}

function listWorkOrders(filters = {}) {
  const db = getDB();
  
  let sql = 'SELECT * FROM work_orders WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.customer_name) {
    sql += ' AND customer_name LIKE ?';
    params.push(`%${filters.customer_name}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return db.prepare(sql).all(...params);
}

function updateWorkOrder(orderId, updateData, operator = 'system', reason = '') {
  const db = getDB();
  
  const beforeValue = getWorkOrderById(orderId);
  if (!beforeValue) {
    throw new Error('工单不存在');
  }
  
  const updates = [];
  const params = [];
  
  if (updateData.customer_name !== undefined) {
    updates.push('customer_name = ?');
    params.push(updateData.customer_name);
  }
  if (updateData.customer_contact !== undefined) {
    updates.push('customer_contact = ?');
    params.push(updateData.customer_contact);
  }
  if (updateData.issue_type !== undefined) {
    updates.push('issue_type = ?');
    params.push(updateData.issue_type);
  }
  if (updates.length === 0 && updateData.status === undefined) {
    return beforeValue;
  }
  
  updates.push('updated_at = datetime(\'now\')');
  params.push(orderId);
  
  db.prepare(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const afterValue = getWorkOrderById(orderId);
  createAuditLog('work_order', orderId, 'update', beforeValue, afterValue, operator, reason);
  
  return afterValue;
}

function closeWorkOrder(orderId, operator = 'system', reason = '') {
  const db = getDB();
  
  const beforeValue = getWorkOrderById(orderId);
  if (!beforeValue) {
    throw new Error('工单不存在');
  }
  
  if (beforeValue.status === 'closed') {
    return beforeValue;
  }
  
  db.prepare(`
    UPDATE work_orders 
    SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(orderId);
  
  const afterValue = getWorkOrderById(orderId);
  createAuditLog('work_order', orderId, 'close', beforeValue, afterValue, operator, reason);
  
  return afterValue;
}

function getWorkOrderLoans(orderId) {
  const db = getDB();
  
  return db.prepare(`
    SELECT l.*, 
           p.part_code, p.part_name, p.unit, p.price,
           e.name as engineer_name, e.engineer_code
    FROM loans l
    JOIN parts p ON l.part_id = p.id
    JOIN engineers e ON l.engineer_id = e.id
    WHERE l.work_order_id = ?
    ORDER BY l.created_at DESC
  `).all(orderId);
}

module.exports = {
  createWorkOrder,
  getWorkOrderById,
  getWorkOrderByCode,
  listWorkOrders,
  updateWorkOrder,
  closeWorkOrder,
  getWorkOrderLoans
};
