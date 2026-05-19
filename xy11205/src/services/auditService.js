const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../models/database');
const { validateRole, validateOperator } = require('../utils/validator');

function logAction(action, tableName, recordId, oldValues, newValues, operator, role) {
  const db = getDatabase();
  
  const roleValidation = validateRole(role);
  const operatorValidation = validateOperator(operator);
  
  if (!roleValidation.valid || !operatorValidation.valid) {
    throw new Error(`审计日志校验失败: ${roleValidation.message || ''} ${operatorValidation.message || ''}`);
  }
  
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, action, table_name, record_id, old_values, new_values, operator, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    uuidv4(),
    action,
    tableName,
    recordId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    operator,
    role,
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );
}

function getAuditLogs(options = {}) {
  const db = getDatabase();
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  
  if (options.startDate) {
    query += ' AND created_at >= ?';
    params.push(options.startDate);
  }
  
  if (options.endDate) {
    query += ' AND created_at <= ?';
    params.push(options.endDate);
  }
  
  if (options.operator) {
    query += ' AND operator = ?';
    params.push(options.operator);
  }
  
  if (options.tableName) {
    query += ' AND table_name = ?';
    params.push(options.tableName);
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

module.exports = {
  logAction,
  getAuditLogs
};
