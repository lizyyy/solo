const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database/connection');
const { createAuditLog, getAuditLogs } = require('../utils/audit');

function createEngineer(engineerData, operator = 'system') {
  const db = getDB();
  
  const engineerId = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO engineers (
      id, engineer_code, name, department, phone, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    engineerId,
    engineerData.engineer_code,
    engineerData.name,
    engineerData.department || null,
    engineerData.phone || null,
    'active',
    now,
    now
  );
  
  createAuditLog('engineer', engineerId, 'create', null, {
    engineer_code: engineerData.engineer_code,
    name: engineerData.name
  }, operator);
  
  return getEngineerById(engineerId);
}

function getEngineerById(engineerId) {
  const db = getDB();
  return db.prepare('SELECT * FROM engineers WHERE id = ?').get(engineerId);
}

function getEngineerByCode(engineerCode) {
  const db = getDB();
  return db.prepare('SELECT * FROM engineers WHERE engineer_code = ?').get(engineerCode);
}

function listEngineers(filters = {}) {
  const db = getDB();
  
  let sql = 'SELECT * FROM engineers WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.department) {
    sql += ' AND department = ?';
    params.push(filters.department);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return db.prepare(sql).all(...params);
}

function updateEngineer(engineerId, updateData, operator = 'system', reason = '') {
  const db = getDB();
  
  const beforeValue = getEngineerById(engineerId);
  if (!beforeValue) {
    throw new Error('工程师不存在');
  }
  
  const updates = [];
  const params = [];
  
  if (updateData.name !== undefined) {
    updates.push('name = ?');
    params.push(updateData.name);
  }
  if (updateData.department !== undefined) {
    updates.push('department = ?');
    params.push(updateData.department);
  }
  if (updateData.phone !== undefined) {
    updates.push('phone = ?');
    params.push(updateData.phone);
  }
  if (updateData.status !== undefined) {
    updates.push('status = ?');
    params.push(updateData.status);
  }
  
  if (updates.length === 0) {
    return beforeValue;
  }
  
  updates.push('updated_at = datetime(\'now\')');
  params.push(engineerId);
  
  db.prepare(`UPDATE engineers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  const afterValue = getEngineerById(engineerId);
  createAuditLog('engineer', engineerId, 'update', beforeValue, afterValue, operator, reason);
  
  return afterValue;
}

function getEngineerUnreturnedLoans(engineerId) {
  const db = getDB();
  
  return db.prepare(`
    SELECT l.*, 
           p.part_code, p.part_name, p.unit, p.price,
           e.name as engineer_name, e.engineer_code,
           wo.order_code, wo.customer_name, wo.status as work_order_status
    FROM loans l
    JOIN parts p ON l.part_id = p.id
    JOIN engineers e ON l.engineer_id = e.id
    LEFT JOIN work_orders wo ON l.work_order_id = wo.id
    WHERE l.engineer_id = ? AND l.status IN ('borrowed', 'overdue', 'partial_returned', 'exception')
    ORDER BY l.expected_return_at ASC
  `).all(engineerId);
}

module.exports = {
  createEngineer,
  getEngineerById,
  getEngineerByCode,
  listEngineers,
  updateEngineer,
  getEngineerUnreturnedLoans
};
