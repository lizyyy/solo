const { AuditLog } = require('../models');
const logger = require('../config/logger');

async function createAuditLog({
  action,
  actionDescription,
  module,
  receiptNumber = null,
  windowId = null,
  operatorId = null,
  operatorName = null,
  ipAddress = null,
  requestId = null,
  beforeData = null,
  afterData = null,
  result = 'success',
  errorMessage = null
}) {
  try {
    await AuditLog.create({
      action,
      action_description: actionDescription,
      module,
      receipt_number: receiptNumber,
      window_id: windowId,
      operator_id: operatorId,
      operator_name: operatorName,
      ip_address: ipAddress,
      request_id: requestId,
      before_data: beforeData ? JSON.stringify(beforeData) : null,
      after_data: afterData ? JSON.stringify(afterData) : null,
      result,
      error_message: errorMessage
    });
  } catch (error) {
    logger.error('创建审计日志失败:', error);
  }
}

const actions = {
  ASSIGN: 'assign',
  VOID: 'void',
  REPRINT: 'reprint',
  RECOVER: 'recover',
  CHECK_GAP: 'check_gap',
  EXPORT: 'export',
  CREATE_SEGMENT: 'create_segment',
  UPDATE_SEGMENT: 'update_segment',
  DELETE_SEGMENT: 'delete_segment',
  CREATE_COMPENSATION: 'create_compensation',
  EXECUTE_COMPENSATION: 'execute_compensation'
};

const modules = {
  SEGMENT_POOL: 'segment_pool',
  ASSIGNMENT: 'assignment',
  VOID: 'void',
  REPRINT: 'reprint',
  REPORT: 'report',
  COMPENSATION: 'compensation',
  AUDIT: 'audit'
};

module.exports = {
  createAuditLog,
  actions,
  modules
};
