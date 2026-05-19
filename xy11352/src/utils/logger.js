const winston = require('winston');
const path = require('path');
const db = require('../models/database');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'park-security' },
  transports: [
    new winston.transports.File({ filename: path.join('logs', 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join('logs', 'combined.log') })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

class OperationLogger {
  static async log(operation, module, recordId = null, oldValue = null, newValue = null, operator = {}) {
    try {
      await db.run(
        `INSERT INTO operation_logs 
        (operator_id, operator_name, operation, module, record_id, old_value, new_value, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          operator.id || null,
          operator.name || 'system',
          operation,
          module,
          recordId,
          oldValue ? JSON.stringify(oldValue) : null,
          newValue ? JSON.stringify(newValue) : null,
          operator.ip || null
        ]
      );
      logger.info(`Operation logged: ${operation} on ${module}`, { recordId, operator: operator.name });
    } catch (error) {
      logger.error('Failed to log operation:', error);
    }
  }

  static async logVerification(verifyType, identifier, result, action, reason, gate, operator, details = {}) {
    try {
      await db.run(
        `INSERT INTO verification_records
        (verify_type, identifier, result, action, reason, gate, operator_id, operator_name, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          verifyType,
          identifier,
          result,
          action,
          reason,
          gate,
          operator.id || null,
          operator.name || 'system',
          JSON.stringify(details)
        ]
      );
      logger.info(`Verification recorded: ${verifyType} - ${result}`, { identifier, action, reason });
    } catch (error) {
      logger.error('Failed to log verification:', error);
    }
  }

  static async getLogs(options = {}) {
    let sql = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];
    
    if (options.module) {
      sql += ' AND module = ?';
      params.push(options.module);
    }
    if (options.operation) {
      sql += ' AND operation = ?';
      params.push(options.operation);
    }
    if (options.startDate) {
      sql += ' AND created_at >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      sql += ' AND created_at <= ?';
      params.push(options.endDate);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    return await db.all(sql, params);
  }

  static async getVerificationRecords(options = {}) {
    let sql = 'SELECT * FROM verification_records WHERE 1=1';
    const params = [];
    
    if (options.verifyType) {
      sql += ' AND verify_type = ?';
      params.push(options.verifyType);
    }
    if (options.result) {
      sql += ' AND result = ?';
      params.push(options.result);
    }
    if (options.startDate) {
      sql += ' AND created_at >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      sql += ' AND created_at <= ?';
      params.push(options.endDate);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(options.limit || 50, options.offset || 0);
    
    return await db.all(sql, params);
  }
}

module.exports = { logger, OperationLogger };
