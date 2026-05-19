const { AuditLog } = require('../models');
const logger = require('../config/logger');

async function createAuditLog(options) {
  try {
    const {
      action,
      module,
      recordId = null,
      recordNo = null,
      operatorId,
      operatorName,
      operatorRole,
      beforeData = null,
      afterData = null,
      changeFields = null,
      ipAddress = null,
      userAgent = null,
      description = null,
      success = true,
      errorMessage = null
    } = options;

    await AuditLog.create({
      action,
      module,
      record_id: recordId,
      record_no: recordNo,
      operator_id: operatorId,
      operator_name: operatorName,
      operator_role: operatorRole,
      before_data: beforeData ? JSON.stringify(logger.maskSensitiveData(beforeData)) : null,
      after_data: afterData ? JSON.stringify(logger.maskSensitiveData(afterData)) : null,
      change_fields: changeFields ? JSON.stringify(changeFields) : null,
      ip_address: ipAddress,
      user_agent: userAgent,
      description,
      success,
      error_message: errorMessage
    });
  } catch (error) {
    logger.error('创建审计日志失败:', error);
  }
}

function auditMiddleware(moduleName) {
  return async (req, res, next) => {
    const oldJson = res.json;
    let responseData = null;

    res.json = function(data) {
      responseData = data;
      return oldJson.call(this, data);
    };

    res.on('finish', async () => {
      try {
        const operator = req.user || { id: null, name: 'system', role: 'system' };
        const action = getActionFromMethod(req.method);
        
        if (action && res.statusCode < 400) {
          await createAuditLog({
            action,
            module: moduleName,
            recordId: req.params?.id,
            operatorId: operator.id,
            operatorName: operator.name,
            operatorRole: operator.role,
            beforeData: req.body,
            afterData: responseData,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            description: `${req.method} ${req.path}`,
            success: res.statusCode < 400
          });
        }
      } catch (error) {
        logger.error('审计中间件错误:', error);
      }
    });

    next();
  };
}

function getActionFromMethod(method) {
  switch (method) {
    case 'POST':
      return AuditLog.AUDIT_ACTIONS.CREATE;
    case 'PUT':
    case 'PATCH':
      return AuditLog.AUDIT_ACTIONS.UPDATE;
    case 'DELETE':
      return AuditLog.AUDIT_ACTIONS.DELETE;
    case 'GET':
      return null;
    default:
      return null;
  }
}

module.exports = {
  createAuditLog,
  auditMiddleware
};
