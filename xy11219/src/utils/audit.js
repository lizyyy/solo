const { db } = require('../database/init');
const { maskLogData } = require('../middleware/auth');

function logAction(userId, action, tableName = null, recordId = null, oldValues = null, newValues = null, ip = null, userAgent = null) {
  return new Promise((resolve, reject) => {
    const maskedOld = oldValues ? JSON.stringify(maskLogData(oldValues)) : null;
    const maskedNew = newValues ? JSON.stringify(maskLogData(newValues)) : null;

    db.run(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, action, tableName, recordId, maskedOld, maskedNew, ip, userAgent], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function getAuditLogs(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        a.*,
        u.username,
        u.real_name as operator_name
      FROM audit_logs a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.userId) {
      query += ' AND a.user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ' AND a.action = ?';
      params.push(filters.action);
    }

    if (filters.tableName) {
      query += ' AND a.table_name = ?';
      params.push(filters.tableName);
    }

    if (filters.startDate) {
      query += ' AND a.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND a.created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY a.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  logAction,
  getAuditLogs
};
