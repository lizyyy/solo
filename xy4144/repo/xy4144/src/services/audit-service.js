const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../storage/database');

/**
 * 审计日志服务
 * 用于记录所有关键操作的审计日志
 */

const OPERATION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  CONFLICT_CHECK: 'CONFLICT_CHECK'
};

const ENTITY_TYPES = {
  PLAN: 'PLAN',
  TOPOLOGY: 'TOPOLOGY',
  STATION: 'STATION',
  SECTION: 'SECTION',
  LINE: 'LINE',
  TEAM: 'TEAM',
  CATENARY_ZONE: 'CATENARY_ZONE',
  DISPATCH_COMMAND: 'DISPATCH_COMMAND'
};

/**
 * 创建审计日志
 */
function createAuditLog(options) {
  const {
    operationType,
    entityType,
    entityId,
    oldValue = null,
    newValue = null,
    operatorId = null,
    operatorName = '系统',
    ipAddress = null,
    userAgent = null,
    notes = null
  } = options;

  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO audit_logs (
      id, operation_type, entity_type, entity_id, old_value, new_value,
      operator_id, operator_name, operation_time, ip_address, user_agent, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      operationType,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      operatorId,
      operatorName,
      now,
      ipAddress,
      userAgent,
      notes
    ]
  );

  return id;
}

/**
 * 查询审计日志
 */
function getAuditLogs(options = {}) {
  const {
    entityType,
    entityId,
    operationType,
    operatorId,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;

  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];

  if (entityType) {
    sql += ' AND entity_type = ?';
    params.push(entityType);
  }

  if (entityId) {
    sql += ' AND entity_id = ?';
    params.push(entityId);
  }

  if (operationType) {
    sql += ' AND operation_type = ?';
    params.push(operationType);
  }

  if (operatorId) {
    sql += ' AND operator_id = ?';
    params.push(operatorId);
  }

  if (startTime) {
    sql += ' AND operation_time >= ?';
    params.push(startTime);
  }

  if (endTime) {
    sql += ' AND operation_time <= ?';
    params.push(endTime);
  }

  sql += ' ORDER BY operation_time DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = query(sql, params);

  // 解析 JSON 字段
  return logs.map(log => ({
    ...log,
    old_value: log.old_value ? JSON.parse(log.old_value) : null,
    new_value: log.new_value ? JSON.parse(log.new_value) : null
  }));
}

/**
 * 获取实体的变更历史
 */
function getEntityHistory(entityType, entityId) {
  return getAuditLogs({ entityType, entityId, limit: 1000 });
}

/**
 * 记录计划创建
 */
function logPlanCreate(plan, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.CREATE,
    entityType: ENTITY_TYPES.PLAN,
    entityId: plan.id,
    newValue: plan,
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: '创建封锁计划'
  });
}

/**
 * 记录计划更新
 */
function logPlanUpdate(oldPlan, newPlan, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.UPDATE,
    entityType: ENTITY_TYPES.PLAN,
    entityId: newPlan.id,
    oldValue: oldPlan,
    newValue: newPlan,
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: '更新封锁计划'
  });
}

/**
 * 记录计划提交
 */
function logPlanSubmit(plan, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.SUBMIT,
    entityType: ENTITY_TYPES.PLAN,
    entityId: plan.id,
    newValue: { status: 'submitted', submitted_at: new Date().toISOString() },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: '提交封锁计划审批'
  });
}

/**
 * 记录计划审批
 */
function logPlanApprove(plan, operator = null, notes = '') {
  return createAuditLog({
    operationType: OPERATION_TYPES.APPROVE,
    entityType: ENTITY_TYPES.PLAN,
    entityId: plan.id,
    newValue: { status: 'approved', approved_at: new Date().toISOString() },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: notes || '审批通过封锁计划'
  });
}

/**
 * 记录计划拒绝
 */
function logPlanReject(plan, operator = null, reason = '') {
  return createAuditLog({
    operationType: OPERATION_TYPES.REJECT,
    entityType: ENTITY_TYPES.PLAN,
    entityId: plan.id,
    newValue: { status: 'rejected' },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: reason || '拒绝封锁计划'
  });
}

/**
 * 记录计划撤销
 */
function logPlanCancel(plan, operator = null, reason = '') {
  return createAuditLog({
    operationType: OPERATION_TYPES.CANCEL,
    entityType: ENTITY_TYPES.PLAN,
    entityId: plan.id,
    newValue: { status: 'cancelled', cancelled_at: new Date().toISOString() },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: reason || '撤销封锁计划'
  });
}

/**
 * 记录冲突检查
 */
function logConflictCheck(planId, result, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.CONFLICT_CHECK,
    entityType: ENTITY_TYPES.PLAN,
    entityId: planId,
    newValue: result,
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: `冲突检查结果: ${result.is_passed ? '通过' : '存在冲突'}`
  });
}

/**
 * 记录导入操作
 */
function logImport(entityType, count, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.IMPORT,
    entityType: entityType,
    entityId: 'BATCH',
    newValue: { count },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: `批量导入 ${count} 条记录`
  });
}

/**
 * 记录导出操作
 */
function logExport(entityType, format, count, operator = null) {
  return createAuditLog({
    operationType: OPERATION_TYPES.EXPORT,
    entityType: entityType,
    entityId: 'BATCH',
    newValue: { format, count },
    operatorId: operator?.id,
    operatorName: operator?.name || '系统',
    notes: `导出 ${count} 条记录，格式: ${format}`
  });
}

module.exports = {
  OPERATION_TYPES,
  ENTITY_TYPES,
  createAuditLog,
  getAuditLogs,
  getEntityHistory,
  logPlanCreate,
  logPlanUpdate,
  logPlanSubmit,
  logPlanApprove,
  logPlanReject,
  logPlanCancel,
  logConflictCheck,
  logImport,
  logExport
};
