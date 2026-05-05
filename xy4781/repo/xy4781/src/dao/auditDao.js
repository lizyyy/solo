const { runSql, getOne, getAll } = require('../database/connection');

const createAuditLog = (data) => {
  const { operationType, operationDesc, resourceType, resourceId, operator, requestIp, idempotencyKey, success, errorMessage } = data;
  
  return runSql(`
    INSERT INTO audit_logs (operation_type, operation_desc, resource_type, resource_id, operator, request_ip, idempotency_key, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    operationType,
    operationDesc,
    resourceType,
    resourceId,
    operator,
    requestIp,
    idempotencyKey,
    success ? 1 : 0,
    errorMessage
  ]);
};

const getAuditLogs = (options = {}) => {
  const { operationType, resourceType, operator, startDate, endDate, limit = 100 } = options;
  
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  
  if (operationType) {
    sql += ' AND operation_type = ?';
    params.push(operationType);
  }
  
  if (resourceType) {
    sql += ' AND resource_type = ?';
    params.push(resourceType);
  }
  
  if (operator) {
    sql += ' AND operator = ?';
    params.push(operator);
  }
  
  if (startDate) {
    sql += ' AND date(created_at) >= date(?)';
    params.push(startDate);
  }
  
  if (endDate) {
    sql += ' AND date(created_at) <= date(?)';
    params.push(endDate);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  return getAll(sql, params);
};

const getAuditLogById = (id) => {
  return getOne('SELECT * FROM audit_logs WHERE id = ?', [id]);
};

const getAuditStats = () => {
  return getAll(`
    SELECT 
      operation_type,
      COUNT(*) as total_count,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
    FROM audit_logs
    GROUP BY operation_type
    ORDER BY operation_type
  `);
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  getAuditStats
};
