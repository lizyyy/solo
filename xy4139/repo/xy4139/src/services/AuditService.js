const { AuditLogRepository, ChemicalRepository, BatchRepository, RequestRepository } = require('../storage/repositories');
const { PermissionValidator } = require('../validation/PermissionValidator');
const AuditLog = require('../models/AuditLog');

class AuditService {
  constructor() {
    this.auditLogRepository = new AuditLogRepository();
    this.chemicalRepository = new ChemicalRepository();
    this.batchRepository = new BatchRepository();
    this.requestRepository = new RequestRepository();
  }

  async getAuditLogs(options = {}, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const logs = await this.auditLogRepository.findAll(options);
    const total = await this.auditLogRepository.count(options);
    
    return {
      data: logs.map(log => log.toJSON()),
      pagination: {
        total,
        limit: options.limit || 100,
        offset: options.offset || 0
      }
    };
  }

  async getAuditLogById(id, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const log = await this.auditLogRepository.findById(id);
    if (!log) {
      const error = new Error(`审计日志不存在: ${id}`);
      error.status = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }
    
    return log.toJSON();
  }

  async getAuditLogsByEntity(entityType, entityId, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const logs = await this.auditLogRepository.findByEntity(entityType, entityId);
    
    return {
      data: logs.map(log => log.toJSON())
    };
  }

  async getAuditLogsByUser(userId, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const logs = await this.auditLogRepository.findByUserId(userId);
    
    return {
      data: logs.map(log => log.toJSON())
    };
  }

  async getRecentLogs(limit = 100, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const logs = await this.auditLogRepository.getRecentLogs(limit);
    
    return {
      data: logs.map(log => log.toJSON())
    };
  }

  async logAction(actionData, user) {
    const auditLog = new AuditLog({
      ...actionData,
      user_id: user.id,
      user_role: user.role
    });
    
    return this.auditLogRepository.create(auditLog);
  }

  async getActionTypes() {
    return Object.entries(AuditLog.actions).map(([key, value]) => ({
      key,
      value,
      description: this.getActionDescription(value)
    }));
  }

  getActionDescription(action) {
    const descriptions = {
      [AuditLog.actions.CHEMICAL_CREATE]: '创建试剂',
      [AuditLog.actions.CHEMICAL_UPDATE]: '更新试剂',
      [AuditLog.actions.CHEMICAL_DELETE]: '删除试剂',
      [AuditLog.actions.BATCH_CREATE]: '创建批次',
      [AuditLog.actions.BATCH_UPDATE]: '更新批次',
      [AuditLog.actions.BATCH_IMPORT]: '导入批次',
      [AuditLog.actions.REQUEST_CREATE]: '创建申请',
      [AuditLog.actions.REQUEST_SUBMIT]: '提交申请',
      [AuditLog.actions.REQUEST_APPROVE]: '批准申请',
      [AuditLog.actions.REQUEST_REJECT]: '驳回申请',
      [AuditLog.actions.REQUEST_EXECUTE]: '执行申请',
      [AuditLog.actions.REQUEST_RETURN]: '归还试剂',
      [AuditLog.actions.REQUEST_DISPOSE]: '报废试剂',
      [AuditLog.actions.STOCK_ALERT]: '库存预警',
      [AuditLog.actions.EXPIRY_ALERT]: '过期预警',
      [AuditLog.actions.REPORT_EXPORT]: '导出报告'
    };
    return descriptions[action] || action;
  }

  async getAuditSummary(options = {}, user) {
    PermissionValidator.checkPermission(user.role, 'view_audit_log');
    
    const totalLogs = await this.auditLogRepository.count(options);
    
    const actionCounts = {};
    for (const action of Object.values(AuditLog.actions)) {
      const count = await this.auditLogRepository.count({ ...options, action });
      if (count > 0) {
        actionCounts[action] = count;
      }
    }
    
    const entityTypeCounts = {};
    for (const entityType of Object.values(AuditLog.entityTypes)) {
      const count = await this.auditLogRepository.count({ ...options, entity_type: entityType });
      if (count > 0) {
        entityTypeCounts[entityType] = count;
      }
    }
    
    return {
      total: totalLogs,
      action_counts: actionCounts,
      entity_type_counts: entityTypeCounts
    };
  }
}

module.exports = AuditService;
