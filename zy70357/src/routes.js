const express = require('express');
const router = express.Router();

const store = require('./store');
const { authMiddleware, requireRoles, generateSummary, calculateImpact } = require('./auth');

const {
  getUser,
  createSession,
  getSession,
  getActiveSessionsByUser,
  getAllSessionsByUser,
  getActiveSessionsByDevice,
  updateSession,
  registerDeviceFingerprint,
  getDeviceFingerprint,
  getDeviceFingerprintsByUser,
  writeRiskEvent,
  getRiskEventsByUser,
  createAuditLog,
  getAuditLogs,
  setLoginRestriction,
  getLoginRestriction,
  removeLoginRestriction,
  SESSION_STATUS,
  RISK_LEVEL,
  ACTION_TYPE
} = store;

router.post('/sessions', (req, res) => {
  const { userId, deviceFingerprintData } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'userId is required'
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  const restriction = getLoginRestriction(userId);
  if (restriction && restriction.isActive) {
    return res.status(403).json({
      error: 'LOGIN_RESTRICTED',
      message: 'User is restricted from logging in',
      restriction
    });
  }

  let deviceFingerprintId = null;
  if (deviceFingerprintData) {
    const fingerprint = registerDeviceFingerprint(userId, user.tenantId, deviceFingerprintData);
    deviceFingerprintId = fingerprint.id;
  }

  const session = createSession(userId, user.tenantId, deviceFingerprintId);

  createAuditLog(
    ACTION_TYPE.CREATE_SESSION,
    'system',
    'system',
    user.tenantId,
    [userId],
    [session.id],
    deviceFingerprintId ? [deviceFingerprintId] : [],
    { action: 'session_created' }
  );

  res.status(201).json({
    sessionId: session.id,
    userId: session.userId,
    tenantId: session.tenantId,
    deviceFingerprintId: session.deviceFingerprintId,
    createdAt: session.createdAt
  });
});

router.post('/sessions/:sessionId/refresh', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session not found'
    });
  }

  if (session.status === SESSION_STATUS.KICKED) {
    return res.status(401).json({
      error: 'SESSION_KICKED',
      message: 'Session has been kicked and cannot be refreshed',
      kickedAt: session.kickedAt,
      kickReason: session.kickReason
    });
  }

  if (session.status === SESSION_STATUS.EXPIRED) {
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired'
    });
  }

  const updated = updateSession(sessionId, {
    lastRefreshedAt: new Date().toISOString()
  });

  res.json({
    sessionId: updated.id,
    status: updated.status,
    lastRefreshedAt: updated.lastRefreshedAt
  });
});

router.post('/devices/register', authMiddleware, (req, res) => {
  const { userId, deviceFingerprintData } = req.body;

  if (!userId || !deviceFingerprintData) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'userId and deviceFingerprintData are required'
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  const fingerprint = registerDeviceFingerprint(userId, user.tenantId, deviceFingerprintData);

  createAuditLog(
    ACTION_TYPE.REGISTER_DEVICE,
    req.actor.id,
    req.actor.role,
    user.tenantId,
    [userId],
    [],
    [fingerprint.id],
    { action: 'device_registered' }
  );

  res.status(201).json(fingerprint);
});

router.post('/risk-events', authMiddleware, requireRoles(['security_service', 'admin_service']), (req, res) => {
  const { userId, deviceFingerprintId, riskLevel, evidence } = req.body;

  if (!userId || !riskLevel || !evidence) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'userId, riskLevel, and evidence are required'
    });
  }

  if (![RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].includes(riskLevel)) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: `Invalid riskLevel. Must be one of: ${[RISK_LEVEL.LOW, RISK_LEVEL.MEDIUM, RISK_LEVEL.HIGH].join(', ')}`
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  const event = writeRiskEvent(userId, user.tenantId, deviceFingerprintId, riskLevel, evidence);

  createAuditLog(
    ACTION_TYPE.WRITE_RISK,
    req.actor.id,
    req.actor.role,
    user.tenantId,
    [userId],
    [],
    deviceFingerprintId ? [deviceFingerprintId] : [],
    { riskLevel, evidence }
  );

  res.status(201).json(event);
});

router.post('/sessions/kick/preview', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin']), (req, res) => {
  const { userId, deviceFingerprintId, riskLevel } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'userId is required'
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  let sessionsToKick = [];
  let devicesToKick = new Set();

  if (deviceFingerprintId) {
    sessionsToKick = getActiveSessionsByDevice(deviceFingerprintId);
  } else if (riskLevel === RISK_LEVEL.HIGH) {
    sessionsToKick = getActiveSessionsByUser(userId);
  } else {
    return res.json({
      affectedSessions: [],
      affectedDevices: [],
      sessionCount: 0,
      deviceCount: 0,
      message: 'No sessions to kick with current parameters'
    });
  }

  sessionsToKick.forEach(s => {
    if (s.deviceFingerprintId) {
      devicesToKick.add(s.deviceFingerprintId);
    }
  });

  res.json({
    affectedSessions: sessionsToKick.map(s => s.id),
    affectedDevices: Array.from(devicesToKick),
    sessionCount: sessionsToKick.length,
    deviceCount: devicesToKick.size
  });
});

router.post('/sessions/kick', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin']), (req, res) => {
  const { userId, deviceFingerprintId, riskLevel, reason, evidence, restrictLogin, restrictDurationMinutes } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'userId is required'
    });
  }

  if (req.actor.role === 'tenant_admin' && !reason) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Tenant admin must provide a reason for kick operation'
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  if (req.actor.role === 'tenant_admin' && req.actor.tenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Tenant admin can only manage users in their own tenant'
    });
  }

  let sessionsToKick = [];
  let devicesToKick = new Set();

  if (deviceFingerprintId) {
    sessionsToKick = getActiveSessionsByDevice(deviceFingerprintId);
  } else if (riskLevel === RISK_LEVEL.HIGH) {
    sessionsToKick = getActiveSessionsByUser(userId);
  } else {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Either deviceFingerprintId or high riskLevel is required for kick operation'
    });
  }

  const kickedSessions = [];
  const alreadyKickedSessions = [];

  sessionsToKick.forEach(session => {
    if (session.status === SESSION_STATUS.KICKED) {
      alreadyKickedSessions.push(session.id);
    } else {
      const updated = updateSession(session.id, {
        status: SESSION_STATUS.KICKED,
        kickedAt: new Date().toISOString(),
        kickedBy: req.actor.id,
        kickReason: reason,
        kickEvidence: evidence
      });
      kickedSessions.push(updated);
      
      if (session.deviceFingerprintId) {
        devicesToKick.add(session.deviceFingerprintId);
      }
    }
  });

  let restriction = null;
  if (restrictLogin && kickedSessions.length > 0) {
    const duration = restrictDurationMinutes || 1440;
    restriction = setLoginRestriction(userId, user.tenantId, reason || 'Account security restriction', duration);
    
    createAuditLog(
      ACTION_TYPE.RESTRICT_LOGIN,
      req.actor.id,
      req.actor.role,
      user.tenantId,
      [userId],
      [],
      [],
      { expiresAt: restriction.expiresAt, reason: reason || 'Account security restriction' },
      reason
    );
  }

  if (kickedSessions.length > 0) {
    createAuditLog(
      deviceFingerprintId ? ACTION_TYPE.KICK_SESSION : ACTION_TYPE.KICK_ALL_SESSIONS,
      req.actor.id,
      req.actor.role,
      user.tenantId,
      [userId],
      kickedSessions.map(s => s.id),
      Array.from(devicesToKick),
      { riskLevel, evidence, restrictLogin },
      reason
    );
  }

  res.json({
    success: true,
    kickedSessions: kickedSessions.length,
    alreadyKickedSessions: alreadyKickedSessions.length,
    kickedSessionIds: kickedSessions.map(s => s.id),
    alreadyKickedSessionIds: alreadyKickedSessions,
    affectedDevices: Array.from(devicesToKick),
    restriction,
    message: kickedSessions.length > 0 
      ? `Successfully kicked ${kickedSessions.length} session(s)` 
      : 'No active sessions to kick'
  });
});

router.post('/sessions/:sessionId/kick', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin']), (req, res) => {
  const sessionId = req.params.sessionId;
  const { reason, evidence, restrictLogin, restrictDurationMinutes } = req.body;

  if (req.actor.role === 'tenant_admin' && !reason) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Tenant admin must provide a reason for kick operation'
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      message: 'Session not found'
    });
  }

  const user = getUser(session.userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  if (req.actor.role === 'tenant_admin' && req.actor.tenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Tenant admin can only manage users in their own tenant'
    });
  }

  if (session.status === SESSION_STATUS.KICKED) {
    return res.json({
      success: true,
      alreadyKicked: true,
      sessionId: session.id,
      kickedAt: session.kickedAt,
      kickedBy: session.kickedBy,
      kickReason: session.kickReason,
      message: 'Session was already kicked'
    });
  }

  const updated = updateSession(sessionId, {
    status: SESSION_STATUS.KICKED,
    kickedAt: new Date().toISOString(),
    kickedBy: req.actor.id,
    kickReason: reason,
    kickEvidence: evidence
  });

  let restriction = null;
  if (restrictLogin) {
    const duration = restrictDurationMinutes || 1440;
    restriction = setLoginRestriction(session.userId, user.tenantId, reason || 'Account security restriction', duration);
    
    createAuditLog(
      ACTION_TYPE.RESTRICT_LOGIN,
      req.actor.id,
      req.actor.role,
      user.tenantId,
      [session.userId],
      [],
      [],
      { expiresAt: restriction.expiresAt, reason: reason || 'Account security restriction' },
      reason
    );
  }

  createAuditLog(
    ACTION_TYPE.KICK_SESSION,
    req.actor.id,
    req.actor.role,
    user.tenantId,
    [session.userId],
    [sessionId],
    session.deviceFingerprintId ? [session.deviceFingerprintId] : [],
    { evidence },
    reason
  );

  res.json({
    success: true,
    session: updated,
    restriction,
    message: 'Session kicked successfully'
  });
});

router.post('/login-restrictions/:userId/unrestrict', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin']), (req, res) => {
  const userId = req.params.userId;
  const { reason } = req.body;

  if (req.actor.role === 'tenant_admin' && !reason) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Tenant admin must provide a reason for unrestrict operation'
    });
  }

  const user = getUser(userId);
  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  if (req.actor.role === 'tenant_admin' && req.actor.tenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Tenant admin can only manage users in their own tenant'
    });
  }

  const restriction = getLoginRestriction(userId);
  if (!restriction || !restriction.isActive) {
    return res.json({
      success: true,
      alreadyUnrestricted: true,
      message: 'User is not currently restricted'
    });
  }

  const updated = removeLoginRestriction(userId);

  createAuditLog(
    ACTION_TYPE.UNRESTRICT_LOGIN,
    req.actor.id,
    req.actor.role,
    user.tenantId,
    [userId],
    [],
    [],
    { previousExpiry: restriction.expiresAt },
    reason
  );

  res.json({
    success: true,
    restriction: updated,
    message: 'Login restriction removed successfully'
  });
});

router.get('/audit/users/:userId', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin', 'customer_service']), (req, res) => {
  const userId = req.params.userId;
  const user = getUser(userId);

  if (!user) {
    return res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found'
    });
  }

  if (req.actor.role === 'tenant_admin' && req.actor.tenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Tenant admin can only view users in their own tenant'
    });
  }

  const sessions = getAllSessionsByUser(userId);
  const devices = getDeviceFingerprintsByUser(userId);
  const riskEvents = getRiskEventsByUser(userId);
  const auditLogs = getAuditLogs({ userId });
  const restriction = getLoginRestriction(userId);

  const kickedSessions = sessions.filter(s => s.status === SESSION_STATUS.KICKED);
  const activeSessions = sessions.filter(s => s.status === SESSION_STATUS.ACTIVE);
  
  const kickedDeviceIds = new Set(kickedSessions.map(s => s.deviceFingerprintId).filter(Boolean));
  const activeDeviceIds = new Set(activeSessions.map(s => s.deviceFingerprintId).filter(Boolean));
  
  const kickedDevices = devices.filter(d => kickedDeviceIds.has(d.id));
  const retainedDevices = devices.filter(d => activeDeviceIds.has(d.id) && !kickedDeviceIds.has(d.id));

  const summary = generateSummary(auditLogs, sessions, devices, restriction);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      tenantId: user.tenantId
    },
    sessions: {
      all: sessions.map(s => ({
        id: s.id,
        status: s.status,
        deviceFingerprintId: s.deviceFingerprintId,
        createdAt: s.createdAt,
        lastRefreshedAt: s.lastRefreshedAt,
        kickedAt: s.kickedAt,
        kickedBy: s.kickedBy,
        kickReason: s.kickReason,
        kickEvidence: s.kickEvidence
      })),
      active: activeSessions.length,
      kicked: kickedSessions.length
    },
    devices: {
      kicked: kickedDevices.map(d => ({
        id: d.id,
        data: d.data,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt
      })),
      retained: retainedDevices.map(d => ({
        id: d.id,
        data: d.data,
        firstSeenAt: d.firstSeenAt,
        lastSeenAt: d.lastSeenAt
      }))
    },
    riskEvents: riskEvents.map(e => ({
      id: e.id,
      riskLevel: e.riskLevel,
      deviceFingerprintId: e.deviceFingerprintId,
      evidence: e.evidence,
      createdAt: e.createdAt,
      resolved: e.resolved
    })),
    auditLogs: auditLogs.map(l => ({
      id: l.id,
      actionType: l.actionType,
      actorId: l.actorId,
      actorRole: l.actorRole,
      affectedSessionIds: l.affectedSessionIds,
      affectedDeviceIds: l.affectedDeviceIds,
      details: l.details,
      reason: l.reason,
      createdAt: l.createdAt
    })),
    restriction,
    summary,
    customerServiceSummary: {
      kickedDevicesCount: kickedDevices.length,
      retainedDevicesCount: retainedDevices.length,
      activeSessionsCount: activeSessions.length,
      restrictionEndsAt: restriction && restriction.isActive ? restriction.expiresAt : null,
      latestOperator: auditLogs.length > 0 ? auditLogs[0].actorId : null,
      latestReason: auditLogs.length > 0 ? auditLogs[0].reason : null
    }
  });
});

router.get('/audit/logs', authMiddleware, requireRoles(['security_service', 'admin_service', 'tenant_admin']), (req, res) => {
  const { userId, tenantId, actionType } = req.query;
  
  const query = {};
  if (userId) query.userId = userId;
  if (tenantId) query.tenantId = tenantId;
  if (actionType) query.actionType = actionType;

  const logs = getAuditLogs(query);

  if (req.actor.role === 'tenant_admin') {
    const filteredLogs = logs.filter(l => l.tenantId === req.actor.tenantId);
    return res.json({ logs: filteredLogs });
  }

  res.json({ logs });
});

module.exports = router;
