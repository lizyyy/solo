const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');

function recordChange(tableName, recordId, fieldName, oldValue, newValue, operator, changeReason = null, batchId = null) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    INSERT INTO change_history (id, table_name, record_id, field_name, old_value, new_value, change_reason, operator_id, operator_name, operator_role, batch_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuidv4(),
    tableName,
    recordId,
    fieldName,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    changeReason,
    operator.id,
    operator.name,
    operator.role,
    batchId,
    dayjs().valueOf()
  );
}

function recordChanges(tableName, recordId, oldData, newData, operator, changeReason = null, batchId = null, excludeFields = []) {
  const fields = Object.keys(newData);
  
  for (const field of fields) {
    if (excludeFields.includes(field)) continue;
    
    const oldValue = oldData ? oldData[field] : undefined;
    const newValue = newData[field];
    
    if (oldValue !== newValue) {
      recordChange(tableName, recordId, field, oldValue, newValue, operator, changeReason, batchId);
    }
  }
}

function getChangeHistory(tableName, recordId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM change_history
    WHERE table_name = ? AND record_id = ?
    ORDER BY created_at DESC
  `);

  const rows = stmt.all(tableName, recordId);
  
  return rows.map(row => ({
    ...row,
    old_value: row.old_value ? JSON.parse(row.old_value) : null,
    new_value: row.new_value ? JSON.parse(row.new_value) : null,
    created_at: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function getAllChangeHistory(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM change_history WHERE 1=1';
  const params = [];

  if (filters.operator_id) {
    sql += ' AND operator_id = ?';
    params.push(filters.operator_id);
  }
  if (filters.start_time) {
    sql += ' AND created_at >= ?';
    params.push(filters.start_time);
  }
  if (filters.end_time) {
    sql += ' AND created_at <= ?';
    params.push(filters.end_time);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);

  return rows.map(row => ({
    ...row,
    old_value: row.old_value ? JSON.parse(row.old_value) : null,
    new_value: row.new_value ? JSON.parse(row.new_value) : null,
    created_at: dayjs(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

module.exports = {
  recordChange,
  recordChanges,
  getChangeHistory,
  getAllChangeHistory,
};
