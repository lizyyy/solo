const { runAsync, allAsync } = require('../utils/db');

class OperationLogModel {
  static async create(logData) {
    const sql = `INSERT INTO operation_logs 
      (record_id, operation, before_status, after_status, reason, operator, remarks) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return runAsync(sql, [
      logData.record_id, logData.operation,
      logData.before_status || null, logData.after_status || null,
      logData.reason || null, logData.operator,
      logData.remarks || null
    ]);
  }

  static async findByRecordId(recordId) {
    return allAsync(`SELECT * FROM operation_logs 
      WHERE record_id = ? ORDER BY operated_at DESC`, [recordId]);
  }

  static async findByOperator(operator) {
    return allAsync(`SELECT * FROM operation_logs 
      WHERE operator = ? ORDER BY operated_at DESC`, [operator]);
  }

  static async getAll() {
    return allAsync('SELECT * FROM operation_logs ORDER BY operated_at DESC');
  }
}

module.exports = OperationLogModel;
