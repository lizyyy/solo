const { getUser, addUser } = require('./store');

const SERVICE_TOKENS = {
  'token-security-service': { id: 'security-service', role: 'security_service', tenantId: 'system' },
  'token-admin-service': { id: 'admin-service', role: 'admin_service', tenantId: 'system' },
  'token-customer-service': { id: 'customer-service', role: 'customer_service', tenantId: 'system' },
  'token-tenant-admin-1': { id: 'tenant-admin-1', role: 'tenant_admin', tenantId: 'tenant-1' }
};

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header' 
    });
  }

  const token = authHeader.split(' ')[1];
  let actor;

  if (SERVICE_TOKENS[token]) {
    actor = SERVICE_TOKENS[token];
  } else {
    const sessionId = token;
    const session = require('./store').getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Invalid session token' 
      });
    }

    const user = getUser(session.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'User not found' 
      });
    }

    actor = {
      id: user.id,
      role: user.role,
      tenantId: user.tenantId,
      sessionId: session.id
    };
  }

  req.actor = actor;
  next();
}

function requireRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.actor.role)) {
      return res.status(403).json({ 
        error: 'FORBIDDEN',
        message: `Required roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
}

function generateSummary(auditLogs, sessions, devices, restriction) {
  const kickedSessions = sessions.filter(s => s.status === 'kicked');
  const activeSessions = sessions.filter(s => s.status === 'active');
  const kickedDevices = new Set(kickedSessions.map(s => s.deviceFingerprintId).filter(Boolean));
  const activeDevices = new Set(activeSessions.map(s => s.deviceFingerprintId).filter(Boolean));

  let summary = '';
  
  if (kickedSessions.length > 0) {
    summary += `用户共有 ${sessions.length} 个会话，其中 ${kickedSessions.length} 个已被踢出，${activeSessions.length} 个仍保持活跃。`;
  } else {
    summary += `用户共有 ${sessions.length} 个会话，全部处于活跃状态。`;
  }

  if (kickedDevices.size > 0) {
    summary += ` 涉及 ${kickedDevices.size} 个被踢出的设备，${activeDevices.size} 个设备仍保持登录。`;
  }

  if (restriction && restriction.isActive) {
    summary += ` 用户当前处于登录限制状态，限制将于 ${restriction.expiresAt} 结束。`;
  }

  if (auditLogs.length > 0) {
    const latestKick = auditLogs.find(l => l.actionType === 'kick_session' || l.actionType === 'kick_all_sessions');
    if (latestKick) {
      summary += ` 最近一次踢出操作由 ${latestKick.actorId} 执行，原因：${latestKick.reason || '未提供'}。`;
    }
  }

  return summary;
}

function calculateImpact(userId, options = {}) {
  const { riskLevel, deviceFingerprintId } = options;
  const { getActiveSessionsByUser, getActiveSessionsByDevice } = require('./store');

  let affectedSessions = [];
  let affectedDevices = new Set();

  if (deviceFingerprintId) {
    affectedSessions = getActiveSessionsByDevice(deviceFingerprintId);
  } else if (riskLevel === 'high') {
    affectedSessions = getActiveSessionsByUser(userId);
  } else {
    return { sessions: [], devices: [] };
  }

  affectedSessions.forEach(s => {
    if (s.deviceFingerprintId) {
      affectedDevices.add(s.deviceFingerprintId);
    }
  });

  return {
    sessions: affectedSessions.map(s => s.id),
    devices: Array.from(affectedDevices),
    sessionCount: affectedSessions.length,
    deviceCount: affectedDevices.size
  };
}

module.exports = {
  authMiddleware,
  requireRoles,
  generateSummary,
  calculateImpact,
  SERVICE_TOKENS
};
