const AuditLog = require('../models/auditLog');

const auditMiddleware = (operationType, tableName) => {
  return async (req, res, next) => {
    const oldValue = res.locals.oldValue || null;
    
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      const newValue = data ? JSON.stringify(data) : null;
      
      if (data && (data.success || data.id || res.statusCode < 400)) {
        AuditLog.create({
          operation_type: operationType,
          table_name: tableName,
          record_id: data.id || null,
          operator: req.body.operator || req.query.operator || 'system',
          old_value: oldValue ? JSON.stringify(oldValue) : null,
          new_value: newValue,
          ip_address: req.ip || req.connection.remoteAddress,
          notes: `${operationType} on ${tableName}`
        }).catch(err => {
          console.error('审计日志记录失败:', err);
        });
      }
      
      return originalJson(data);
    };
    
    next();
  };
};

const logAudit = async (operationType, tableName, recordId, operator, oldValue, newValue, notes) => {
  try {
    await AuditLog.create({
      operation_type: operationType,
      table_name: tableName,
      record_id: recordId,
      operator: operator || 'system',
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      notes: notes || `${operationType} on ${tableName}`
    });
  } catch (err) {
    console.error('审计日志记录失败:', err);
  }
};

module.exports = { auditMiddleware, logAudit };
