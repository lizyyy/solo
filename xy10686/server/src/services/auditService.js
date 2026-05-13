const { AuditLog } = require('../models');

const createAuditLog = async (entityType, entityId, action, oldValues, newValues, operator, remarks = '') => {
  const changedFields = [];
  if (oldValues && newValues) {
    Object.keys(newValues).forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changedFields.push(key);
      }
    });
  }

  await AuditLog.create({
    entityType,
    entityId,
    action,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
    changedFields: changedFields.length > 0 ? JSON.stringify(changedFields) : null,
    operator,
    remarks
  });
};

const getAuditLogs = async (entityType, entityId) => {
  const logs = await AuditLog.findAll({
    where: { entityType, entityId },
    order: [['createdAt', 'DESC']]
  });
  return logs.map(log => ({
    ...log.toJSON(),
    oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
    newValues: log.newValues ? JSON.parse(log.newValues) : null,
    changedFields: log.changedFields ? JSON.parse(log.changedFields) : null
  }));
};

module.exports = {
  createAuditLog,
  getAuditLogs
};
