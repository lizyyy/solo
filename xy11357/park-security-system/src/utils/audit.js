const db = require('./database');
const { generateId, safeStringify } = require('./common');

async function createAuditLog(action, module, status, options = {}) {
  const logId = generateId('log');
  const {
    operator = 'system',
    ipAddress = null,
    requestId = null,
    requestData = null,
    responseData = null,
    errorMessage = null
  } = options;

  try {
    await db.run(
      `INSERT INTO audit_logs (
        log_id, action, module, operator, ip_address, 
        request_id, request_data, response_data, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        action,
        module,
        operator,
        ipAddress,
        requestId,
        safeStringify(requestData),
        safeStringify(responseData),
        status,
        errorMessage
      ]
    );
    return logId;
  } catch (err) {
    console.error('创建审计日志失败:', err);
    return null;
  }
}

const AuditAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  IMPORT: 'import',
  EXPORT: 'export',
  CHECK: 'check',
  PASS: 'pass',
  REJECT: 'reject',
  QUERY: 'query'
};

const AuditModule = {
  VISITOR: 'visitor',
  LICENSE_PLATE: 'license_plate',
  BLACKLIST: 'blacklist',
  GATE: 'gate',
  SYSTEM: 'system'
};

const AuditStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

module.exports = {
  createAuditLog,
  AuditAction,
  AuditModule,
  AuditStatus
};
