const db = require('../database/init');

class OperationLogService {
  static async log(operationType, module, recordId, recordNo, beforeValues, afterValues, operator, operatorName, remark = '') {
    const stmt = db.prepare(`
      INSERT INTO operation_logs 
      (operation_type, module, record_id, record_no, before_values, after_values, operator, operator_name, operation_remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      operationType,
      module,
      recordId,
      recordNo,
      beforeValues ? JSON.stringify(beforeValues) : null,
      afterValues ? JSON.stringify(afterValues) : null,
      operator,
      operatorName,
      remark
    );
  }

  static getLogs(filters = {}, page = 1, pageSize = 20) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (filters.module) {
      whereClause += ' AND module = ?';
      params.push(filters.module);
    }

    if (filters.operator) {
      whereClause += ' AND operator = ?';
      params.push(filters.operator);
    }

    if (filters.operatorName) {
      whereClause += ' AND operator_name LIKE ?';
      params.push(`%${filters.operatorName}%`);
    }

    if (filters.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filters.endDate + ' 23:59:59');
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM operation_logs ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * pageSize;
    const logs = db.prepare(`
      SELECT * FROM operation_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    return {
      list: logs.map(log => ({
        ...log,
        before_values: log.before_values ? JSON.parse(log.before_values) : null,
        after_values: log.after_values ? JSON.parse(log.after_values) : null
      })),
      total,
      page,
      pageSize
    };
  }

  static getTimeline(module, recordId) {
    const logs = db.prepare(`
      SELECT * FROM operation_logs
      WHERE module = ? AND record_id = ?
      ORDER BY created_at ASC
    `).all(module, recordId);

    return logs.map(log => ({
      ...log,
      before_values: log.before_values ? JSON.parse(log.before_values) : null,
      after_values: log.after_values ? JSON.parse(log.after_values) : null
    }));
  }
}

module.exports = OperationLogService;
