const { OperationLog } = require('../models');

class LogService {
  static async createLog(entityType, entityId, operation, operator, beforeValue = null, afterValue = null, remark = '', changedFields = []) {
    try {
      await OperationLog.create({
        entityType,
        entityId,
        operation,
        operator,
        operationTime: new Date(),
        beforeValue: beforeValue ? JSON.stringify(beforeValue) : null,
        afterValue: afterValue ? JSON.stringify(afterValue) : null,
        remark,
        changedFields: changedFields.length > 0 ? JSON.stringify(changedFields) : null
      });
    } catch (error) {
      console.error('创建操作日志失败:', error);
    }
  }

  static async getLogs(entityType, entityId) {
    const where = { entityType };
    if (entityId) {
      where.entityId = entityId;
    }
    return await OperationLog.findAll({
      where,
      order: [['operationTime', 'DESC']]
    });
  }

  static async getTimeline(entityType, entityId) {
    const logs = await this.getLogs(entityType, entityId);
    return logs.map(log => ({
      id: log.id,
      operation: log.operation,
      operator: log.operator,
      operationTime: log.operationTime,
      remark: log.remark,
      beforeValue: log.beforeValue ? JSON.parse(log.beforeValue) : null,
      afterValue: log.afterValue ? JSON.parse(log.afterValue) : null,
      changedFields: log.changedFields ? JSON.parse(log.changedFields) : []
    }));
  }
}

module.exports = LogService;
