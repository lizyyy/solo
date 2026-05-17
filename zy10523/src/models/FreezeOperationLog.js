const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./database');

class FreezeOperationLog {
  static async create(data) {
    const now = Date.now();
    const id = uuidv4();
    
    await run(`
      INSERT INTO freeze_operation_logs (
        id, freeze_id, operation_type, operator, before_status,
        after_status, operation_details, original_input, processing_basis,
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.freezeId,
      data.operationType,
      data.operator || null,
      data.beforeStatus || null,
      data.afterStatus || null,
      data.operationDetails,
      data.originalInput ? JSON.stringify(data.originalInput) : null,
      data.processingBasis || null,
      data.ipAddress || null,
      data.userAgent || null,
      now
    ]);

    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM freeze_operation_logs WHERE id = ?', [id]);
  }

  static async findByFreezeId(freezeId) {
    return all('SELECT * FROM freeze_operation_logs WHERE freeze_id = ? ORDER BY created_at DESC', [freezeId]);
  }

  static async findByOperationType(operationType) {
    return all('SELECT * FROM freeze_operation_logs WHERE operation_type = ? ORDER BY created_at DESC', [operationType]);
  }

  static async findAll(filters = {}, pagination = {}) {
    let sql = 'SELECT * FROM freeze_operation_logs WHERE 1=1';
    const params = [];

    if (filters.freezeId) {
      sql += ' AND freeze_id = ?';
      params.push(filters.freezeId);
    }

    if (filters.operationType) {
      sql += ' AND operation_type = ?';
      params.push(filters.operationType);
    }

    if (filters.operator) {
      sql += ' AND operator = ?';
      params.push(filters.operator);
    }

    if (filters.startTime) {
      sql += ' AND created_at >= ?';
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      sql += ' AND created_at <= ?';
      params.push(filters.endTime);
    }

    sql += ' ORDER BY created_at DESC';

    if (pagination.limit) {
      sql += ' LIMIT ?';
      params.push(pagination.limit);
    }

    if (pagination.offset) {
      sql += ' OFFSET ?';
      params.push(pagination.offset);
    }

    return all(sql, params);
  }
}

module.exports = FreezeOperationLog;
