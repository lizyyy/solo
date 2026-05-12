const { readData, writeData } = require('./storage');
const { generateId } = require('./helpers');

function logAudit(action, entityType, entityId, details) {
  const audit = readData('audit');
  
  const existingAudit = audit.find(a => 
    a.action === action && 
    a.entityType === entityType && 
    a.entityId === entityId &&
    JSON.stringify(a.details) === JSON.stringify(details)
  );
  
  if (existingAudit) {
    return existingAudit;
  }
  
  const auditEntry = {
    id: generateId(),
    action,
    entityType,
    entityId,
    details,
    createdAt: new Date().toISOString()
  };
  
  audit.push(auditEntry);
  writeData('audit', audit);
  
  return auditEntry;
}

function logAmendment(entityType, entityId, oldValue, newValue, operator) {
  return logAudit('amend', entityType, entityId, {
    oldValue,
    newValue,
    operator: operator || 'system'
  });
}

function getAuditByEntity(entityType, entityId) {
  const audit = readData('audit');
  return audit.filter(a => a.entityType === entityType && a.entityId === entityId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

module.exports = {
  logAudit,
  logAmendment,
  getAuditByEntity
};
