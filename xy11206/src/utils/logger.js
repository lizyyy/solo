const winston = require('winston');
const path = require('path');
const DataMasking = require('./dataMasking');

const logDir = path.join(__dirname, '../../logs');

const maskedFormat = winston.format((info) => {
  if (info.message && typeof info.message === 'string') {
    try {
      const parsed = JSON.parse(info.message);
      if (parsed.data) {
        parsed.data = DataMasking.maskForExport(parsed.data, DataMasking.getSensitiveFields());
        info.message = JSON.stringify(parsed);
      }
    } catch (e) {
    }
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    maskedFormat(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'pharmacy-inventory' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
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
  constructor(db) {
    this.db = db;
  }

  async log(req, res, responseData, error = null) {
    const operationType = this.getOperationType(req.path);
    const operator = req.headers['x-operator'] || 'system';
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    let requestBody = req.body ? JSON.stringify(req.body) : null;
    if (requestBody) {
      try {
        const parsed = JSON.parse(requestBody);
        const masked = DataMasking.maskForExport(parsed, DataMasking.getSensitiveFields());
        requestBody = JSON.stringify(masked);
      } catch (e) {
      }
    }

    let maskedResponse = responseData;
    if (responseData && typeof responseData === 'object') {
      maskedResponse = DataMasking.maskForExport(responseData, DataMasking.getSensitiveFields());
    }

    const affectedRecords = this.getAffectedRecords(responseData);

    try {
      await this.db.run(`
        INSERT INTO operation_logs 
        (operation_type, operator, ip_address, request_path, request_method, request_body, 
         response_status, success, error_message, affected_records)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        operationType,
        operator,
        ipAddress,
        req.path,
        req.method,
        requestBody,
        res.statusCode,
        error ? 0 : 1,
        error ? error.message : null,
        affectedRecords
      ]);
    } catch (dbError) {
      logger.error('写入操作日志失败:', dbError);
    }

    const logEntry = {
      operationType,
      operator,
      ip: ipAddress,
      path: req.path,
      method: req.method,
      status: res.statusCode,
      success: !error,
      affectedRecords
    };

    if (error) {
      logger.error(JSON.stringify({ ...logEntry, error: error.message }));
    } else {
      logger.info(JSON.stringify(logEntry));
    }
  }

  getOperationType(path) {
    if (path.includes('/delivery') && path.includes('/import')) return 'delivery_import';
    if (path.includes('/delivery') && path.includes('/review')) return 'delivery_review';
    if (path.includes('/delivery')) return 'delivery_operation';
    if (path.includes('/inventory')) return 'inventory_operation';
    if (path.includes('/export')) return 'export_operation';
    if (path.includes('/logs')) return 'log_query';
    return 'other_operation';
  }

  getAffectedRecords(responseData) {
    if (!responseData) return 0;
    if (responseData.affectedRecords !== undefined) return responseData.affectedRecords;
    if (responseData.data && Array.isArray(responseData.data)) return responseData.data.length;
    if (responseData.totalItems !== undefined) return responseData.totalItems;
    if (responseData.successCount !== undefined) return responseData.successCount;
    return 1;
  }
}

module.exports = { logger, OperationLogger };
