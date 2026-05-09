const pool = require('../database/pool');

class OperationLogService {
  static async log(req, operationType, targetType, targetId, oldValue = null, newValue = null, notes = null) {
    try {
      const operator = req.operator;
      
      await pool.query(
        `INSERT INTO operation_logs 
         (operator_id, operator_name, operation_type, target_type, target_id, 
          old_value, new_value, operation_notes, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          operator?.id,
          operator?.real_name,
          operationType,
          targetType,
          targetId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          notes,
          req.ip,
          req.headers['user-agent']
        ]
      );
    } catch (error) {
      console.error('Failed to log operation:', error);
    }
  }

  static async getLogs(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.operatorId) {
      conditions.push(`operator_id = $${paramIndex}`);
      params.push(filters.operatorId);
      paramIndex++;
    }

    if (filters.operationType) {
      conditions.push(`operation_type = $${paramIndex}`);
      params.push(filters.operationType);
      paramIndex++;
    }

    if (filters.targetType) {
      conditions.push(`target_type = $${paramIndex}`);
      params.push(filters.targetType);
      paramIndex++;
    }

    if (filters.targetId) {
      conditions.push(`target_id = $${paramIndex}`);
      params.push(filters.targetId);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM operation_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const logsResult = await pool.query(
      `SELECT id, operator_id, operator_name, operation_type, target_type, target_id,
              old_value, new_value, operation_notes, ip_address, created_at
       FROM operation_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      logs: logsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getItemHistory(targetType, targetId) {
    const result = await pool.query(
      `SELECT id, operator_id, operator_name, operation_type, old_value, new_value,
              operation_notes, created_at
       FROM operation_logs
       WHERE target_type = $1 AND target_id = $2
       ORDER BY created_at DESC`,
      [targetType, targetId]
    );

    return result.rows;
  }
}

module.exports = OperationLogService;
