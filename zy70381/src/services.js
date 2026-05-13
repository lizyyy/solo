const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb, saveDatabase } = require('./database');

const ANOMALY_WINDOW_MINUTES = 5;
const MULTI_IP_THRESHOLD = 2;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runQuery(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  saveDatabase();
}

function createFile(name, url, description = '') {
  const id = uuidv4();
  const timestamp = now();
  runQuery(
    `INSERT INTO files (id, name, url, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, url, description, timestamp, timestamp]
  );
  return getFile(id);
}

function getFile(fileId) {
  return queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
}

function listFiles() {
  return queryAll('SELECT * FROM files ORDER BY created_at DESC');
}

function createToken(fileId, userId, expiresInHours = 24, maxUses = 1) {
  const file = getFile(fileId);
  if (!file) {
    throw new Error('FILE_NOT_FOUND');
  }

  const token = generateToken();
  const id = uuidv4();
  const expiresAt = now() + (expiresInHours * 3600);
  const timestamp = now();

  runQuery(
    `INSERT INTO download_tokens 
     (id, file_id, user_id, token, expires_at, max_uses, current_uses, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [id, fileId, userId, token, expiresAt, maxUses, 0, timestamp]
  );

  return getToken(id);
}

function getToken(tokenId) {
  return queryOne('SELECT * FROM download_tokens WHERE id = ?', [tokenId]);
}

function getTokenByTokenValue(tokenValue) {
  return queryOne('SELECT * FROM download_tokens WHERE token = ?', [tokenValue]);
}

function listTokens(filters = {}) {
  let sql = 'SELECT * FROM download_tokens WHERE 1=1';
  const params = [];

  if (filters.fileId) {
    sql += ' AND file_id = ?';
    params.push(filters.fileId);
  }
  if (filters.userId) {
    sql += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY created_at DESC';
  return queryAll(sql, params);
}

function revokeToken(tokenId) {
  const token = getToken(tokenId);
  if (!token) {
    throw new Error('TOKEN_NOT_FOUND');
  }

  const timestamp = now();
  runQuery(
    `UPDATE download_tokens SET status = 'revoked', revoked_at = ? WHERE id = ?`,
    [timestamp, tokenId]
  );

  return getToken(tokenId);
}

function checkTokenValidity(token) {
  const timestamp = now();
  
  if (token.status !== 'active') {
    return { valid: false, error: 'TOKEN_' + token.status.toUpperCase(), errorMessage: 'Token is ' + token.status };
  }

  if (token.expires_at <= timestamp) {
    return { valid: false, error: 'TOKEN_EXPIRED', errorMessage: 'Token has expired' };
  }

  if (token.current_uses >= token.max_uses) {
    return { valid: false, error: 'TOKEN_USES_EXHAUSTED', errorMessage: 'Token usage limit exceeded' };
  }

  return { valid: true };
}

function checkMultiIp(tokenId, currentIp, userId) {
  const windowStart = now() - (ANOMALY_WINDOW_MINUTES * 60);
  
  const logs = queryAll(
    `SELECT DISTINCT ip_address FROM access_logs 
     WHERE token_id = ? AND access_time >= ? AND status = 'allowed'`,
    [tokenId, windowStart]
  );

  const existingIps = logs.map(l => l.ip_address);
  
  if (existingIps.length >= MULTI_IP_THRESHOLD && !existingIps.includes(currentIp)) {
    return {
      isAnomaly: true,
      anomalyType: 'MULTI_IP_ACCESS',
      severity: 'high',
      description: `Token used from ${existingIps.length + 1} different IPs within ${ANOMALY_WINDOW_MINUTES} minutes. IPs: ${existingIps.join(', ')}, new IP: ${currentIp}`,
      suggestedAction: 'REVOKE_TOKEN'
    };
  }

  return { isAnomaly: false };
}

function recordAccess(token, ipAddress, userAgent, deviceInfo, requestId, allowed, errorCode, errorMessage) {
  const existing = queryOne('SELECT id FROM access_logs WHERE request_id = ?', [requestId]);
  if (existing) {
    return queryOne('SELECT * FROM access_logs WHERE id = ?', [existing.id]);
  }

  const id = uuidv4();
  const timestamp = now();
  const finalErrorCode = errorCode || null;
  const finalErrorMessage = errorMessage || null;

  runQuery(
    `INSERT INTO access_logs 
     (id, token_id, file_id, user_id, ip_address, user_agent, device_info, access_time, status, error_code, error_message, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, token.id, token.file_id, token.user_id, ipAddress, userAgent, deviceInfo, timestamp, 
     allowed ? 'allowed' : 'denied', finalErrorCode, finalErrorMessage, requestId]
  );

  if (allowed) {
    runQuery(
      `UPDATE download_tokens SET current_uses = current_uses + 1 WHERE id = ?`,
      [token.id]
    );
  }

  return queryOne('SELECT * FROM access_logs WHERE id = ?', [id]);
}

function recordAnomaly(token, anomalyInfo) {
  const id = uuidv4();
  const timestamp = now();

  runQuery(
    `INSERT INTO anomaly_events 
     (id, token_id, file_id, user_id, anomaly_type, severity, description, detected_at, suggested_action)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, token.id, token.file_id, token.user_id, anomalyInfo.anomalyType, 
     anomalyInfo.severity, anomalyInfo.description, timestamp, anomalyInfo.suggestedAction]
  );

  return queryOne('SELECT * FROM anomaly_events WHERE id = ?', [id]);
}

function validateDownload(tokenValue, ipAddress, userAgent, deviceInfo, requestId) {
  const token = getTokenByTokenValue(tokenValue);
  
  if (!token) {
    return {
      allowed: false,
      error: 'TOKEN_NOT_FOUND',
      errorMessage: 'Token not found'
    };
  }

  const validity = checkTokenValidity(token);
  
  const result = {
    allowed: validity.valid,
    tokenId: token.id,
    fileId: token.file_id,
    userId: token.user_id
  };

  if (!validity.valid) {
    result.error = validity.error;
    result.errorMessage = validity.errorMessage;
  }

  if (validity.valid) {
    const multiIpCheck = checkMultiIp(token.id, ipAddress, token.user_id);
    if (multiIpCheck.isAnomaly) {
      result.anomalyDetected = true;
      result.anomalyInfo = recordAnomaly(token, multiIpCheck);
      result.suggestedAction = multiIpCheck.suggestedAction;
    }
  }

  recordAccess(
    token, ipAddress, userAgent, deviceInfo, requestId,
    result.allowed, result.error, result.errorMessage
  );

  if (result.allowed) {
    const file = getFile(token.file_id);
    result.fileUrl = file.url;
    result.fileName = file.name;
  }

  return result;
}

function getFileStats(fileId) {
  const totalDownloads = queryOne(
    `SELECT COUNT(*) as count FROM access_logs WHERE file_id = ? AND status = 'allowed'`,
    [fileId]
  ).count;

  const totalAnomalies = queryOne(
    `SELECT COUNT(*) as count FROM anomaly_events WHERE file_id = ?`,
    [fileId]
  ).count;

  const activeTokens = queryOne(
    `SELECT COUNT(*) as count FROM download_tokens WHERE file_id = ? AND status = 'active'`,
    [fileId]
  ).count;

  const tokens = listTokens({ fileId });

  return {
    fileId,
    totalDownloads,
    totalAnomalies,
    activeTokens,
    tokenStatus: tokens.map(t => ({
      tokenId: t.id,
      status: t.status,
      currentUses: t.current_uses,
      maxUses: t.max_uses,
      expiresAt: t.expires_at
    }))
  };
}

function getAnomalies(filters = {}) {
  let sql = `SELECT ae.*, f.name as file_name 
             FROM anomaly_events ae 
             JOIN files f ON ae.file_id = f.id 
             WHERE 1=1`;
  const params = [];

  if (filters.tokenId) {
    sql += ' AND ae.token_id = ?';
    params.push(filters.tokenId);
  }
  if (filters.userId) {
    sql += ' AND ae.user_id = ?';
    params.push(filters.userId);
  }
  if (filters.fileId) {
    sql += ' AND ae.file_id = ?';
    params.push(filters.fileId);
  }

  sql += ' ORDER BY ae.detected_at DESC';
  return queryAll(sql, params);
}

function getAuditLogs(filters = {}) {
  let sql = `SELECT al.*, f.name as file_name 
             FROM access_logs al 
             JOIN files f ON al.file_id = f.id 
             WHERE 1=1`;
  const params = [];

  if (filters.tokenId) {
    sql += ' AND al.token_id = ?';
    params.push(filters.tokenId);
  }
  if (filters.userId) {
    sql += ' AND al.user_id = ?';
    params.push(filters.userId);
  }
  if (filters.fileId) {
    sql += ' AND al.file_id = ?';
    params.push(filters.fileId);
  }

  sql += ' ORDER BY al.access_time DESC';
  return queryAll(sql, params);
}

module.exports = {
  createFile,
  getFile,
  listFiles,
  createToken,
  getToken,
  getTokenByTokenValue,
  listTokens,
  revokeToken,
  validateDownload,
  getFileStats,
  getAnomalies,
  getAuditLogs,
  now
};
