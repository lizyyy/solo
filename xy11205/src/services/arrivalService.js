const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../models/database');
const { logAction } = require('./auditService');
const {
  validateProductType,
  validateQuantity,
  validateDate,
  validateBatchNumber,
  validateRole,
  validateOperator
} = require('../utils/validator');

function createArrivalOrder(data, operator, role) {
  const db = getDatabase();
  
  const roleValidation = validateRole(role);
  const operatorValidation = validateOperator(operator);
  
  if (!roleValidation.valid) {
    throw new Error(roleValidation.message);
  }
  if (!operatorValidation.valid) {
    throw new Error(operatorValidation.message);
  }
  
  const batchValidation = validateBatchNumber(data.batch_number);
  if (!batchValidation.valid) {
    throw new Error(batchValidation.message);
  }
  
  const productTypeValidation = validateProductType(data.product_type);
  if (!productTypeValidation.valid) {
    throw new Error(productTypeValidation.message);
  }
  
  const quantityValidation = validateQuantity(data.quantity);
  if (!quantityValidation.valid) {
    throw new Error(quantityValidation.message);
  }
  
  const dateValidation = validateDate(data.arrival_date);
  if (!dateValidation.valid) {
    throw new Error(dateValidation.message);
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO arrival_orders (
      id, batch_number, product_type, product_name, quantity,
      arrival_date, receiver, signature, damage_status, damage_description,
      status, created_at, updated_at, operator, role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    data.batch_number.trim(),
    data.product_type.trim(),
    data.product_name.trim(),
    parseInt(data.quantity),
    data.arrival_date,
    data.receiver.trim(),
    data.signature.trim(),
    data.damage_status || 'none',
    data.damage_description || null,
    'pending',
    now,
    now,
    operator,
    role
  );
  
  logAction('create', 'arrival_orders', id, null, data, operator, role);
  
  return getArrivalOrderById(id);
}

function getArrivalOrderById(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM arrival_orders WHERE id = ?');
  return stmt.get(id);
}

function getArrivalOrders(options = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM arrival_orders WHERE 1=1';
  const params = [];
  
  if (options.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }
  
  if (options.product_type) {
    query += ' AND product_type = ?';
    params.push(options.product_type);
  }
  
  if (options.start_date) {
    query += ' AND arrival_date >= ?';
    params.push(options.start_date);
  }
  
  if (options.end_date) {
    query += ' AND arrival_date <= ?';
    params.push(options.end_date);
  }
  
  query += ' ORDER BY arrival_date DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

function updateArrivalOrder(id, updates, operator, role) {
  const db = getDatabase();
  
  const roleValidation = validateRole(role);
  const operatorValidation = validateOperator(operator);
  
  if (!roleValidation.valid || !operatorValidation.valid) {
    throw new Error('角色或操作人校验失败');
  }
  
  const existing = getArrivalOrderById(id);
  if (!existing) {
    throw new Error('到货单不存在');
  }
  
  const allowedUpdates = ['damage_status', 'damage_description', 'status'];
  const updateFields = {};
  
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      updateFields[key] = updates[key];
    }
  }
  
  if (Object.keys(updateFields).length === 0) {
    return existing;
  }
  
  updateFields.updated_at = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const setClause = Object.keys(updateFields)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const stmt = db.prepare(`UPDATE arrival_orders SET ${setClause} WHERE id = ?`);
  stmt.run(...Object.values(updateFields), id);
  
  logAction('update', 'arrival_orders', id, existing, { ...existing, ...updateFields }, operator, role);
  
  return getArrivalOrderById(id);
}

function reviewArrivalOrder(id, status, operator, role) {
  if (!['reviewed', 'rejected'].includes(status)) {
    throw new Error('无效的复核状态');
  }
  
  return updateArrivalOrder(id, { status }, operator, role);
}

module.exports = {
  createArrivalOrder,
  getArrivalOrderById,
  getArrivalOrders,
  updateArrivalOrder,
  reviewArrivalOrder
};
