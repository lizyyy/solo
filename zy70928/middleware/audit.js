const { runQuery } = require('../models/database');

async function logOperation(options) {
  const {
    operation_type,
    module,
    relation_id = null,
    relation_code = null,
    store_code = null,
    operator,
    operation_reason = null,
    old_value = null,
    new_value = null,
    ip_address = null
  } = options;

  try {
    await runQuery(`
      INSERT INTO operation_logs 
      (operation_type, module, relation_id, relation_code, store_code, operator, 
       operation_reason, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      operation_type,
      module,
      relation_id,
      relation_code,
      store_code,
      operator,
      operation_reason,
      old_value ? JSON.stringify(old_value) : null,
      new_value ? JSON.stringify(new_value) : null,
      ip_address
    ]);
  } catch (err) {
    console.error('审计日志记录失败:', err);
  }
}

function auditMiddleware(moduleName) {
  return (req, res, next) => {
    req.audit = {
      log: (operationType, options = {}) => {
        return logOperation({
          ...options,
          operation_type: operationType,
          module: moduleName,
          operator: req.headers['x-operator'] || 'system',
          ip_address: req.ip || req.connection.remoteAddress
        });
      }
    };
    next();
  };
}

module.exports = {
  logOperation,
  auditMiddleware
};
