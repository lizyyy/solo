const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

const auditLog = (operationType, entityType) => {
  return (req, res, next) => {
    const entityId = req.params.id || req.body.id || 'unknown';
    const operator = req.body.operator || 'system';
    const beforeData = JSON.stringify(req.body || {});

    const originalSend = res.send;
    res.send = function(data) {
      const result = res.statusCode < 400 ? 'success' : 'failed';
      const afterData = typeof data === 'string' ? data : JSON.stringify(data);
      const failReason = res.statusCode >= 400 ? (data.message || '操作失败') : null;

      const logId = uuidv4();
      db.run(`INSERT INTO audit_logs 
        (log_id, operation_type, entity_type, entity_id, operator, before_data, after_data, result, fail_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, operationType, entityType, entityId, operator, beforeData, afterData, result, failReason],
        (err) => {
          if (err) console.error('审计日志写入失败:', err);
        }
      );

      originalSend.call(this, data);
    };

    next();
  };
};

module.exports = { auditLog };
