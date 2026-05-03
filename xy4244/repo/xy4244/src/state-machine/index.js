const uuid = require('uuid');
const storage = require('../storage');

const CREDENTIAL_STATES = {
  ACTIVE: 'active',
  CHECKED_IN: 'checked_in',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
  INVALID: 'invalid'
};

const EVENTS = {
  ISSUE: 'issue',
  VERIFY: 'verify',
  CHECK_IN: 'check_in',
  REVOKE: 'revoke',
  EXPIRE: 'expire',
  REVIEW: 'review'
};

const TRANSITIONS = {
  [EVENTS.ISSUE]: {
    from: null,
    to: CREDENTIAL_STATES.ACTIVE
  },
  [EVENTS.VERIFY]: {
    from: [CREDENTIAL_STATES.ACTIVE, CREDENTIAL_STATES.CHECKED_IN],
    to: null
  },
  [EVENTS.CHECK_IN]: {
    from: CREDENTIAL_STATES.ACTIVE,
    to: CREDENTIAL_STATES.CHECKED_IN
  },
  [EVENTS.REVOKE]: {
    from: [CREDENTIAL_STATES.ACTIVE, CREDENTIAL_STATES.CHECKED_IN],
    to: CREDENTIAL_STATES.REVOKED
  },
  [EVENTS.EXPIRE]: {
    from: [CREDENTIAL_STATES.ACTIVE, CREDENTIAL_STATES.CHECKED_IN],
    to: CREDENTIAL_STATES.EXPIRED
  },
  [EVENTS.REVIEW]: {
    from: [CREDENTIAL_STATES.REVOKED, CREDENTIAL_STATES.EXPIRED, CREDENTIAL_STATES.CHECKED_IN],
    to: null
  }
};

function canTransition(currentState, event) {
  const transition = TRANSITIONS[event];
  if (!transition) {
    return { allowed: false, reason: '未知事件' };
  }
  
  if (transition.from === null && currentState === null) {
    return { allowed: true };
  }
  
  if (Array.isArray(transition.from)) {
    if (transition.from.includes(currentState)) {
      return { allowed: true };
    }
    return { allowed: false, reason: `当前状态 ${currentState} 不允许执行 ${event} 操作` };
  }
  
  if (transition.from === currentState) {
    return { allowed: true };
  }
  
  return { allowed: false, reason: `当前状态 ${currentState} 不允许执行 ${event} 操作` };
}

async function logAudit(action, options = {}) {
  const logId = uuid.v4();
  
  await storage.run(`
    INSERT INTO audit_logs (
      id, action, credential_id, participant_id, 
      status_before, status_after, operator, 
      ip_address, user_agent, result, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    logId,
    action,
    options.credentialId || null,
    options.participantId || null,
    options.statusBefore || null,
    options.statusAfter || null,
    options.operator || 'system',
    options.ipAddress || null,
    options.userAgent || null,
    options.result || 'success',
    options.details ? JSON.stringify(options.details) : null
  ]);
  
  return logId;
}

async function issueCredential(credential, options = {}) {
  const check = canTransition(null, EVENTS.ISSUE);
  if (!check.allowed) {
    return { success: false, error: check.reason };
  }
  
  await storage.run(`
    INSERT INTO credentials (
      id, participant_id, credential_data, signature, 
      qr_code, status, valid_from, valid_until, issued_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    credential.payload.id,
    credential.payload.participant_id,
    JSON.stringify(credential.payload),
    credential.signature,
    credential.qrCode || null,
    CREDENTIAL_STATES.ACTIVE,
    credential.payload.valid_from,
    credential.payload.valid_until
  ]);
  
  await logAudit(EVENTS.ISSUE, {
    credentialId: credential.payload.id,
    participantId: credential.payload.participant_id,
    statusAfter: CREDENTIAL_STATES.ACTIVE,
    operator: options.operator,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'success'
  });
  
  return { 
    success: true, 
    state: CREDENTIAL_STATES.ACTIVE,
    credentialId: credential.payload.id
  };
}

async function verifyCredential(credentialId, options = {}) {
  const credential = await storage.get(`
    SELECT * FROM credentials WHERE id = ?
  `, [credentialId]);
  
  if (!credential) {
    await logAudit(EVENTS.VERIFY, {
      credentialId,
      result: 'failed',
      details: { error: '凭证不存在' }
    });
    return { success: false, error: '凭证不存在' };
  }
  
  const check = canTransition(credential.status, EVENTS.VERIFY);
  
  const now = Date.now();
  const validUntil = new Date(credential.valid_until).getTime();
  
  let isExpired = now > validUntil;
  
  if (isExpired && credential.status !== CREDENTIAL_STATES.EXPIRED) {
    await expireCredential(credentialId, { operator: 'system' });
    credential.status = CREDENTIAL_STATES.EXPIRED;
  }
  
  await storage.run(`
    UPDATE credentials SET last_verified_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [credentialId]);
  
  await logAudit(EVENTS.VERIFY, {
    credentialId,
    participantId: credential.participant_id,
    statusBefore: credential.status,
    operator: options.operator,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'success'
  });
  
  return {
    success: true,
    state: credential.status,
    isActive: credential.status === CREDENTIAL_STATES.ACTIVE,
    isCheckedIn: credential.status === CREDENTIAL_STATES.CHECKED_IN,
    isRevoked: credential.status === CREDENTIAL_STATES.REVOKED,
    isExpired: credential.status === CREDENTIAL_STATES.EXPIRED,
    credential: {
      id: credential.id,
      participantId: credential.participant_id,
      status: credential.status,
      validUntil: credential.valid_until,
      lastVerifiedAt: credential.last_verified_at
    }
  };
}

async function checkInCredential(credentialId, options = {}) {
  const credential = await storage.get(`
    SELECT * FROM credentials WHERE id = ?
  `, [credentialId]);
  
  if (!credential) {
    await logAudit(EVENTS.CHECK_IN, {
      credentialId,
      result: 'failed',
      details: { error: '凭证不存在' }
    });
    return { success: false, error: '凭证不存在', errorCode: 'NOT_FOUND' };
  }
  
  const check = canTransition(credential.status, EVENTS.CHECK_IN);
  if (!check.allowed) {
    await logAudit(EVENTS.CHECK_IN, {
      credentialId,
      participantId: credential.participant_id,
      statusBefore: credential.status,
      operator: options.operator,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      result: 'failed',
      details: { error: check.reason }
    });
    
    let errorCode = 'INVALID_STATE';
    if (credential.status === CREDENTIAL_STATES.CHECKED_IN) {
      errorCode = 'DUPLICATE_CHECKIN';
    } else if (credential.status === CREDENTIAL_STATES.REVOKED) {
      errorCode = 'REVOKED';
    } else if (credential.status === CREDENTIAL_STATES.EXPIRED) {
      errorCode = 'EXPIRED';
    }
    
    return { success: false, error: check.reason, errorCode };
  }
  
  const newState = CREDENTIAL_STATES.CHECKED_IN;
  
  await storage.run(`
    UPDATE credentials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newState, credentialId]);
  
  await logAudit(EVENTS.CHECK_IN, {
    credentialId,
    participantId: credential.participant_id,
    statusBefore: credential.status,
    statusAfter: newState,
    operator: options.operator,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'success'
  });
  
  return {
    success: true,
    state: newState,
    credentialId
  };
}

async function revokeCredential(credentialId, reason, options = {}) {
  const credential = await storage.get(`
    SELECT * FROM credentials WHERE id = ?
  `, [credentialId]);
  
  if (!credential) {
    return { success: false, error: '凭证不存在' };
  }
  
  const check = canTransition(credential.status, EVENTS.REVOKE);
  if (!check.allowed) {
    return { success: false, error: check.reason };
  }
  
  const newState = CREDENTIAL_STATES.REVOKED;
  
  await storage.run(`
    UPDATE credentials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newState, credentialId]);
  
  const revocationId = uuid.v4();
  await storage.run(`
    INSERT INTO revocation_list (id, credential_id, reason, revoked_by, revoked_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [revocationId, credentialId, reason, options.operator || 'system']);
  
  await logAudit(EVENTS.REVOKE, {
    credentialId,
    participantId: credential.participant_id,
    statusBefore: credential.status,
    statusAfter: newState,
    operator: options.operator,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'success',
    details: { reason, revocationId }
  });
  
  return {
    success: true,
    state: newState,
    credentialId,
    revocationId
  };
}

async function expireCredential(credentialId, options = {}) {
  const credential = await storage.get(`
    SELECT * FROM credentials WHERE id = ?
  `, [credentialId]);
  
  if (!credential) {
    return { success: false, error: '凭证不存在' };
  }
  
  if (credential.status === CREDENTIAL_STATES.EXPIRED || 
      credential.status === CREDENTIAL_STATES.REVOKED) {
    return { success: true, state: credential.status };
  }
  
  const newState = CREDENTIAL_STATES.EXPIRED;
  
  await storage.run(`
    UPDATE credentials SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [newState, credentialId]);
  
  await logAudit(EVENTS.EXPIRE, {
    credentialId,
    participantId: credential.participant_id,
    statusBefore: credential.status,
    statusAfter: newState,
    operator: options.operator || 'system',
    result: 'success'
  });
  
  return {
    success: true,
    state: newState,
    credentialId
  };
}

async function reviewCredential(credentialId, reviewResult, options = {}) {
  const credential = await storage.get(`
    SELECT * FROM credentials WHERE id = ?
  `, [credentialId]);
  
  if (!credential) {
    return { success: false, error: '凭证不存在' };
  }
  
  await logAudit(EVENTS.REVIEW, {
    credentialId,
    participantId: credential.participant_id,
    statusBefore: credential.status,
    operator: options.operator,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    result: 'success',
    details: reviewResult
  });
  
  return {
    success: true,
    state: credential.status,
    reviewResult
  };
}

module.exports = {
  CREDENTIAL_STATES,
  EVENTS,
  TRANSITIONS,
  canTransition,
  logAudit,
  issueCredential,
  verifyCredential,
  checkInCredential,
  revokeCredential,
  expireCredential,
  reviewCredential
};
