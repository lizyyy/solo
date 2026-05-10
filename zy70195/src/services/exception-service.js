const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

async function recordException(params) {
  const db = getDb();
  const {
    type,
    severity = 'medium',
    supplier_id,
    qualification_id,
    order_id,
    endpoint,
    method,
    error,
    raw_data
  } = params;

  const id = uuidv4();
  
  await db.run(`
    INSERT INTO exception_records (
      id, type, severity, supplier_id, qualification_id, order_id,
      endpoint, method, error, raw_data, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    id, type, severity, supplier_id, qualification_id, order_id,
    endpoint, method, error, raw_data ? JSON.stringify(raw_data) : null
  ]);

  return id;
}

async function getExceptionList(params = {}) {
  const db = getDb();
  const { status, type, severity, supplier_id, limit = 100, offset = 0 } = params;
  
  let sql = 'SELECT * FROM exception_records WHERE 1=1';
  const conditions = [];
  const values = [];

  if (status) {
    conditions.push('status = ?');
    values.push(status);
  }
  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }
  if (severity) {
    conditions.push('severity = ?');
    values.push(severity);
  }
  if (supplier_id) {
    conditions.push('supplier_id = ?');
    values.push(supplier_id);
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  values.push(limit, offset);

  return db.all(sql, values);
}

async function handleException(id, handled_by, handling_notes) {
  const db = getDb();
  
  await db.run(`
    UPDATE exception_records 
    SET status = 'handled', handled_at = datetime('now'), handled_by = ?, handling_notes = ?
    WHERE id = ?
  `, [handled_by, handling_notes, id]);

  return getExceptionById(id);
}

async function getExceptionById(id) {
  const db = getDb();
  return db.get('SELECT * FROM exception_records WHERE id = ?', [id]);
}

async function getPendingCount() {
  const db = getDb();
  const result = await db.get("SELECT COUNT(*) as count FROM exception_records WHERE status = 'pending'");
  return result.count;
}

async function getExceptionSummary() {
  const db = getDb();
  
  const total = await db.get('SELECT COUNT(*) as count FROM exception_records');
  const pending = await db.get("SELECT COUNT(*) as count FROM exception_records WHERE status = 'pending'");
  const handled = await db.get("SELECT COUNT(*) as count FROM exception_records WHERE status = 'handled'");
  
  const byType = await db.all(`
    SELECT type, COUNT(*) as count 
    FROM exception_records 
    GROUP BY type 
    ORDER BY count DESC
  `);
  
  const bySeverity = await db.all(`
    SELECT severity, COUNT(*) as count 
    FROM exception_records 
    GROUP BY severity 
    ORDER BY CASE severity 
      WHEN 'high' THEN 1 
      WHEN 'medium' THEN 2 
      WHEN 'low' THEN 3 
      ELSE 4 
    END
  `);
  
  return {
    total: total.count,
    pending: pending.count,
    handled: handled.count,
    by_type: byType,
    by_severity: bySeverity
  };
}

module.exports = {
  recordException,
  getExceptionList,
  handleException,
  getExceptionById,
  getPendingCount,
  getExceptionSummary
};
