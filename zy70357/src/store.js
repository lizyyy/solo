const { v4: uuidv4 } = require('uuid');

const store = {
  users: new Map(),
  sessions: new Map(),
  deviceFingerprints: new Map(),
  riskEvents: new Map(),
  auditLogs: new Map(),
  loginRestrictions: new Map()
};

const SESSION_STATUS = {
  ACTIVE: 'active',
  KICKED: 'kicked',
  EXPIRED: 'expired'
};

const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

const ACTION_TYPE = {
  CREATE_SESSION: 'create_session',
  REGISTER_DEVICE: 'register_device',
  WRITE_RISK: 'write_risk',
  KICK_SESSION: 'kick_session',
  KICK_ALL_SESSIONS: 'kick_all_sessions',
  RESTRICT_LOGIN: 'restrict_login',
  UNRESTRICT_LOGIN: 'unrestrict_login',
  QUERY_AUDIT: 'query_audit'
};

function addUser(userId, tenantId, username, role = 'user') {
  const user = {
    id: userId,
    tenantId,
    username,
    role,
    createdAt: new Date().toISOString()
  };
  store.users.set(userId, user);
  return user;
}

function getUser(userId) {
  return store.users.get(userId);
}

function getUsersByTenant(tenantId) {
  return Array.from(store.users.values()).filter(u => u.tenantId === tenantId);
}

function createSession(userId, tenantId, deviceFingerprintId = null) {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    userId,
    tenantId,
    deviceFingerprintId,
    status: SESSION_STATUS.ACTIVE,
    createdAt: new Date().toISOString(),
    lastRefreshedAt: new Date().toISOString(),
    kickedAt: null,
    kickedBy: null,
    kickReason: null,
    kickEvidence: null
  };
  store.sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return store.sessions.get(sessionId);
}

function getActiveSessionsByUser(userId) {
  return Array.from(store.sessions.values())
    .filter(s => s.userId === userId && s.status === SESSION_STATUS.ACTIVE);
}

function getAllSessionsByUser(userId) {
  return Array.from(store.sessions.values())
    .filter(s => s.userId === userId);
}

function getActiveSessionsByDevice(deviceFingerprintId) {
  return Array.from(store.sessions.values())
    .filter(s => s.deviceFingerprintId === deviceFingerprintId && s.status === SESSION_STATUS.ACTIVE);
}

function getSessionsByDevice(deviceFingerprintId) {
  return Array.from(store.sessions.values())
    .filter(s => s.deviceFingerprintId === deviceFingerprintId);
}

function updateSession(sessionId, updates) {
  const session = store.sessions.get(sessionId);
  if (!session) return null;
  Object.assign(session, updates);
  return session;
}

function registerDeviceFingerprint(userId, tenantId, fingerprintData) {
  const fingerprintId = uuidv4();
  const fingerprint = {
    id: fingerprintId,
    userId,
    tenantId,
    data: fingerprintData,
    createdAt: new Date().toISOString(),
    isTrusted: false,
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString()
  };
  store.deviceFingerprints.set(fingerprintId, fingerprint);
  return fingerprint;
}

function getDeviceFingerprint(fingerprintId) {
  return store.deviceFingerprints.get(fingerprintId);
}

function getDeviceFingerprintsByUser(userId) {
  return Array.from(store.deviceFingerprints.values())
    .filter(d => d.userId === userId);
}

function writeRiskEvent(userId, tenantId, deviceFingerprintId, riskLevel, evidence) {
  const eventId = uuidv4();
  const event = {
    id: eventId,
    userId,
    tenantId,
    deviceFingerprintId,
    riskLevel,
    evidence,
    createdAt: new Date().toISOString(),
    resolved: false,
    resolvedAt: null
  };
  store.riskEvents.set(eventId, event);
  return event;
}

function getRiskEvent(eventId) {
  return store.riskEvents.get(eventId);
}

function getRiskEventsByUser(userId) {
  return Array.from(store.riskEvents.values())
    .filter(e => e.userId === userId);
}

function createAuditLog(actionType, actorId, actorRole, tenantId, affectedUserIds, affectedSessionIds, affectedDeviceIds, details, reason = null) {
  const logId = uuidv4();
  const log = {
    id: logId,
    actionType,
    actorId,
    actorRole,
    tenantId,
    affectedUserIds,
    affectedSessionIds,
    affectedDeviceIds,
    details,
    reason,
    createdAt: new Date().toISOString()
  };
  store.auditLogs.set(logId, log);
  return log;
}

function getAuditLogs(query = {}) {
  let logs = Array.from(store.auditLogs.values());
  
  if (query.userId) {
    logs = logs.filter(l => l.affectedUserIds.includes(query.userId));
  }
  
  if (query.tenantId) {
    logs = logs.filter(l => l.tenantId === query.tenantId);
  }
  
  if (query.actionType) {
    logs = logs.filter(l => l.actionType === query.actionType);
  }
  
  return logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function setLoginRestriction(userId, tenantId, reason, expiresInMinutes = 1440) {
  const restriction = {
    userId,
    tenantId,
    reason,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    isActive: true
  };
  store.loginRestrictions.set(userId, restriction);
  return restriction;
}

function getLoginRestriction(userId) {
  const restriction = store.loginRestrictions.get(userId);
  if (!restriction) return null;
  
  if (restriction.isActive && new Date(restriction.expiresAt) <= new Date()) {
    restriction.isActive = false;
  }
  
  return restriction;
}

function removeLoginRestriction(userId) {
  const restriction = store.loginRestrictions.get(userId);
  if (!restriction) return null;
  restriction.isActive = false;
  return restriction;
}

module.exports = {
  store,
  SESSION_STATUS,
  RISK_LEVEL,
  ACTION_TYPE,
  addUser,
  getUser,
  getUsersByTenant,
  createSession,
  getSession,
  getActiveSessionsByUser,
  getAllSessionsByUser,
  getActiveSessionsByDevice,
  getSessionsByDevice,
  updateSession,
  registerDeviceFingerprint,
  getDeviceFingerprint,
  getDeviceFingerprintsByUser,
  writeRiskEvent,
  getRiskEvent,
  getRiskEventsByUser,
  createAuditLog,
  getAuditLogs,
  setLoginRestriction,
  getLoginRestriction,
  removeLoginRestriction
};
