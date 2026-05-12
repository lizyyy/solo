const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database/connection');
const { createAuditLog, getAuditLogs } = require('../utils/audit');

function createPart(partData, operator = 'system') {
  const db = getDB();
  
  const partId = uuidv4();
  const inventoryId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO parts (
      id, part_code, part_name, category, unit, price, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    partId,
    partData.part_code,
    partData.part_name,
    partData.category || null,
    partData.unit || '个',
    partData.price || 0,
    partData.description || null,
    now,
    now
  );
  
  db.prepare(`
    INSERT INTO inventory (id, part_id, quantity, location, min_stock, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    inventoryId,
    partId,
    partData.initial_quantity || 0,
    partData.location || null,
    partData.min_stock || 0,
    now,
    now
  );
  
  createAuditLog('part', partId, 'create', null, {
    part_code: partData.part_code,
    part_name: partData.part_name,
    initial_quantity: partData.initial_quantity || 0
  }, operator);
  
  return getPartById(partId);
}

function getPartById(partId) {
  const db = getDB();
  
  const part = db.prepare(`
    SELECT p.*, i.quantity as stock_quantity, i.location, i.min_stock
    FROM parts p
    LEFT JOIN inventory i ON p.id = i.part_id
    WHERE p.id = ?
  `).get(partId);
  
  return part;
}

function getPartByCode(partCode) {
  const db = getDB();
  
  const part = db.prepare(`
    SELECT p.*, i.quantity as stock_quantity, i.location, i.min_stock
    FROM parts p
    LEFT JOIN inventory i ON p.id = i.part_id
    WHERE p.part_code = ?
  `).get(partCode);
  
  return part;
}

function listParts(filters = {}) {
  const db = getDB();
  
  let sql = `
    SELECT p.*, i.quantity as stock_quantity, i.location, i.min_stock
    FROM parts p
    LEFT JOIN inventory i ON p.id = i.part_id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.category) {
    sql += ' AND p.category = ?';
    params.push(filters.category);
  }
  
  if (filters.part_name) {
    sql += ' AND p.part_name LIKE ?';
    params.push(`%${filters.part_name}%`);
  }
  
  sql += ' ORDER BY p.created_at DESC';
  
  return db.prepare(sql).all(...params);
}

function updatePartStock(partId, quantityChange, operator = 'system', reason = '') {
  const db = getDB();
  
  const current = db.prepare(`
    SELECT quantity FROM inventory WHERE part_id = ?
  `).get(partId);
  
  if (!current) {
    throw new Error('备件不存在');
  }
  
  const newQuantity = current.quantity + quantityChange;
  
  if (newQuantity < 0) {
    throw new Error(`库存不足: 当前${current.quantity}, 变动${quantityChange}`);
  }
  
  const beforeValue = { stock_quantity: current.quantity };
  const afterValue = { stock_quantity: newQuantity };
  
  db.prepare(`
    UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE part_id = ?
  `).run(newQuantity, partId);
  
  createAuditLog('inventory', partId, quantityChange > 0 ? 'stock_in' : 'stock_out', 
    beforeValue, afterValue, operator, reason);
  
  return { partId, oldQuantity: current.quantity, newQuantity };
}

function updatePart(partId, updateData, operator = 'system', reason = '') {
  const db = getDB();
  
  const beforeValue = getPartById(partId);
  if (!beforeValue) {
    throw new Error('备件不存在');
  }
  
  const updates = [];
  const params = [];
  
  if (updateData.part_name !== undefined) {
    updates.push('part_name = ?');
    params.push(updateData.part_name);
  }
  if (updateData.category !== undefined) {
    updates.push('category = ?');
    params.push(updateData.category);
  }
  if (updateData.unit !== undefined) {
    updates.push('unit = ?');
    params.push(updateData.unit);
  }
  if (updateData.price !== undefined) {
    updates.push('price = ?');
    params.push(updateData.price);
  }
  if (updateData.description !== undefined) {
    updates.push('description = ?');
    params.push(updateData.description);
  }
  if (updateData.location !== undefined) {
    db.prepare(`
      UPDATE inventory SET location = ?, updated_at = datetime('now') WHERE part_id = ?
    `).run(updateData.location, partId);
  }
  if (updateData.min_stock !== undefined) {
    db.prepare(`
      UPDATE inventory SET min_stock = ?, updated_at = datetime('now') WHERE part_id = ?
    `).run(updateData.min_stock, partId);
  }
  
  if (updates.length > 0) {
    updates.push('updated_at = datetime(\'now\')');
    params.push(partId);
    
    db.prepare(`UPDATE parts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  
  const afterValue = getPartById(partId);
  
  createAuditLog('part', partId, 'update', beforeValue, afterValue, operator, reason);
  
  return afterValue;
}

module.exports = {
  createPart,
  getPartById,
  getPartByCode,
  listParts,
  updatePartStock,
  updatePart
};
