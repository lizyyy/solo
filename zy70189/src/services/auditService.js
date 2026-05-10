const { getConnection } = require('../database');
const logger = require('../logger');

class AuditService {
  constructor() {
    this.db = getConnection();
  }

  log(operationType, operator, targetType, targetId, result, detail, beforeValue, afterValue) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_logs 
        (operation_type, operator_id, operator_name, operator_level, 
         target_type, target_id, before_value, after_value, result, detail, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        operationType,
        operator?.id || 'system',
        operator?.name,
        operator?.level,
        targetType,
        targetId,
        beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue ? JSON.stringify(afterValue) : null,
        result,
        typeof detail === 'string' ? detail : JSON.stringify(detail),
        operator?.ip_address
      );

      logger.info('审计日志', {
        operation_type: operationType,
        operator_id: operator?.id,
        target_type: targetType,
        target_id: targetId,
        result
      });

      return true;
    } catch (err) {
      logger.error('写入审计日志失败', { error: err.message });
      return false;
    }
  }

  query(queryParams = {}) {
    const { operator_id, operation_type, target_type, target_id, 
            result, start_time, end_time, page = 1, page_size = 100 } = queryParams;

    const conditions = [];
    const params = [];

    if (operator_id) {
      conditions.push('operator_id = ?');
      params.push(operator_id);
    }
    if (operation_type) {
      conditions.push('operation_type = ?');
      params.push(operation_type);
    }
    if (target_type) {
      conditions.push('target_type = ?');
      params.push(target_type);
    }
    if (target_id) {
      conditions.push('target_id = ?');
      params.push(target_id);
    }
    if (result) {
      conditions.push('result = ?');
      params.push(result);
    }
    if (start_time) {
      conditions.push('created_at >= ?');
      params.push(Math.floor(new Date(start_time).getTime() / 1000));
    }
    if (end_time) {
      conditions.push('created_at <= ?');
      params.push(Math.floor(new Date(end_time).getTime() / 1000));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`);
    const { total } = countStmt.get(...params);

    const offset = (page - 1) * page_size;
    const queryStmt = this.db.prepare(`
      SELECT id, operation_type, operator_id, operator_name, operator_level,
             target_type, target_id, result, detail, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const records = queryStmt.all(...params, page_size, offset);

    return {
      records,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.ceil(total / page_size)
      }
    };
  }

  getLogDetail(logId) {
    return this.db.prepare(`
      SELECT id, operation_type, operator_id, operator_name, operator_level,
             target_type, target_id, before_value, after_value, result, detail, ip_address, created_at
      FROM audit_logs
      WHERE id = ?
    `).get(logId);
  }

  getRefundTimeline(refundRequestId) {
    return this.db.prepare(`
      SELECT id, operation_type, operator_id, operator_name, operator_level,
             result, detail, created_at
      FROM audit_logs
      WHERE target_type = 'refund_request' 
        AND target_id = ?
      ORDER BY created_at ASC
    `).all(refundRequestId);
  }

  getOverrideAttempts(start_time, end_time, page = 1, page_size = 50) {
    return this.query({
      operation_type: 'OVERRIDE_ATTEMPT',
      start_time,
      end_time,
      page,
      page_size
    });
  }

  generateDailyReport(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

    const stats = this.db.prepare(`
      SELECT 
        operation_type,
        result,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY operation_type, result
      ORDER BY operation_type, result
    `).all(startTimestamp, endTimestamp);

    const byOperator = this.db.prepare(`
      SELECT 
        operator_id,
        operator_name,
        operator_level,
        COUNT(*) as total_ops,
        SUM(CASE WHEN result = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM audit_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY operator_id, operator_name, operator_level
      ORDER BY total_ops DESC
    `).all(startTimestamp, endTimestamp);

    const overrideAttempts = this.db.prepare(`
      SELECT 
        operator_id,
        operator_name,
        operator_level,
        target_id,
        detail,
        created_at
      FROM audit_logs
      WHERE operation_type = 'OVERRIDE_ATTEMPT'
        AND created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `).all(startTimestamp, endTimestamp);

    return {
      date,
      summary: stats.reduce((acc, row) => {
        const key = `${row.operation_type}_${row.result}`;
        acc[key] = row.count;
        return acc;
      }, {}),
      by_operator: byOperator,
      override_attempts: overrideAttempts
    };
  }
}

module.exports = new AuditService();
