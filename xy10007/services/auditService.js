const { AuditLog } = require('../models');

class AuditService {
  static async log(options) {
    try {
      const {
        entityType,
        entityId,
        action,
        operatorId,
        operatorName,
        oldValue,
        newValue,
        ipAddress,
        userAgent
      } = options;

      return await AuditLog.create({
        entityType,
        entityId,
        action,
        operatorId: operatorId || 'system',
        operatorName: operatorName || 'System',
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  static async getLogsByEntity(entityType, entityId, options = {}) {
    const { limit = 100, offset = 0 } = options;

    return await AuditLog.findAndCountAll({
      where: { entityType, entityId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  static async getAllLogs(options = {}) {
    const { limit = 100, offset = 0, operatorId, action, startDate, endDate } = options;
    const where = {};

    if (operatorId) where.operatorId = operatorId;
    if (action) where.action = action;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    return await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = AuditService;