const { v4: uuidv4 } = require('uuid');

const store = {
  nannies: [],
  skills: [],
  orders: [],
  serviceSlots: [],
  schedules: [],
  leaves: [],
  compensations: [],
  auditLogs: [],
  idempotentKeys: {}
};

function generateId() {
  return uuidv4();
}

function getTimestamp() {
  return new Date().toISOString();
}

function addAuditLog(entityType, entityId, action, before, after, operator, reason) {
  const log = {
    id: generateId(),
    entityType,
    entityId,
    action,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    operator,
    reason,
    timestamp: getTimestamp()
  };
  store.auditLogs.push(log);
  return log;
}

function checkIdempotency(key) {
  if (store.idempotentKeys[key]) {
    return { exists: true, result: store.idempotentKeys[key] };
  }
  return { exists: false };
}

function setIdempotency(key, result) {
  store.idempotentKeys[key] = result;
}

module.exports = {
  store,
  generateId,
  getTimestamp,
  addAuditLog,
  checkIdempotency,
  setIdempotency
};
