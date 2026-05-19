const { runQuery, getAll } = require('../database/connection');

class OperationLog {
  static async create(data) {
    const now = new Date().toISOString();
    
    await runQuery(`
      INSERT INTO operation_logs (
        operation, operator, targetType, targetId, details, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.operation,
      data.operator || 'system',
      data.targetType,
      data.targetId,
      data.details ? JSON.stringify(data.details) : null,
      now
    ]);
    
    return { ...data, createdAt: now };
  }

  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    let params = [];
    
    if (filters.operation) {
      sql += ' AND operation = ?';
      params.push(filters.operation);
    }
    if (filters.operator) {
      sql += ' AND operator = ?';
      params.push(filters.operator);
    }
    if (filters.targetType) {
      sql += ' AND targetType = ?';
      params.push(filters.targetType);
    }
    if (filters.targetId) {
      sql += ' AND targetId = ?';
      params.push(filters.targetId);
    }
    if (filters.startDate) {
      sql += ' AND createdAt >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND createdAt <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY createdAt DESC LIMIT 100';
    const rows = await getAll(sql, params);
    
    return rows.map(row => {
      if (row.details) {
        try {
          row.details = JSON.parse(row.details);
        } catch (e) {}
      }
      return row;
    });
  }
}

module.exports = OperationLog;
