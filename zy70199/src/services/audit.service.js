const { models } = require('../models');
const logger = require('../utils/logger');

class AuditService {
  static log(action, entityType, entityId, userId, details = {}) {
    const auditLog = models.AuditLog.create({
      action,
      entityType,
      entityId,
      userId,
      details
    });
    
    logger.info(`[AUDIT] ${action} - ${entityType}:${entityId} by ${userId}`, details);
    return auditLog;
  }

  static getLogs(entityType, entityId) {
    return models.AuditLog.find(log => 
      (!entityType || log.entityType === entityType) &&
      (!entityId || log.entityId === entityId)
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static getEmployeeHistory(employeeId) {
    return models.AuditLog.find(log => 
      log.entityType === 'Employee' && log.entityId === employeeId
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static getStatusChanges(employeeId) {
    return models.AuditLog.find(log => 
      log.entityType === 'Employee' && 
      log.entityId === employeeId &&
      log.details && 
      log.details.previousStatus && 
      log.details.newStatus
    ).map(log => ({
      timestamp: log.timestamp,
      userId: log.userId,
      previousStatus: log.details.previousStatus,
      newStatus: log.details.newStatus,
      reason: log.details.reason || '系统自动变更'
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
}

module.exports = AuditService;
