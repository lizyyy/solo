const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const ACTIONS = {
  REGISTRATION_START: 'registration_start',
  REGISTRATION_COMPLETE: 'registration_complete',
  REGISTRATION_FAILED: 'registration_failed',
  AUTHENTICATION_START: 'authentication_start',
  AUTHENTICATION_COMPLETE: 'authentication_complete',
  AUTHENTICATION_FAILED: 'authentication_failed',
  CREDENTIAL_REVOKED: 'credential_revoked',
  CREDENTIAL_UNREVOKED: 'credential_unrevoked',
  CREDENTIAL_DELETED: 'credential_deleted',
  USER_CREATED: 'user_created',
  USER_DELETED: 'user_deleted',
  EXPORT_REPORT: 'export_report'
};

const RISK_FLAGS = {
  CHALLENGE_REPLAY: 'challenge_replay',
  CHALLENGE_EXPIRED: 'challenge_expired',
  CREDENTIAL_REVOKED: 'credential_revoked',
  CREDENTIAL_DUPLICATE: 'credential_duplicate',
  SIGN_COUNT_ROLLBACK: 'sign_count_rollback',
  RP_ID_MISMATCH: 'rp_id_mismatch',
  ORIGIN_MISMATCH: 'origin_mismatch',
  USER_HANDLE_MISMATCH: 'user_handle_mismatch',
  USER_NOT_FOUND: 'user_not_found',
  CREDENTIAL_NOT_FOUND: 'credential_not_found',
  SIGNATURE_INVALID: 'signature_invalid',
  MISSING_FIELDS: 'missing_fields'
};

class AuditService {
  log({
    action,
    userId = null,
    credentialId = null,
    success,
    errorCode = null,
    errorMessage = null,
    riskFlags = [],
    details = {}
  }) {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO audit_logs (
        id, action, user_id, credential_id, success,
        error_code, error_message, risk_flags, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      action,
      userId,
      credentialId,
      success ? 1 : 0,
      errorCode,
      errorMessage,
      JSON.stringify(riskFlags),
      JSON.stringify(details),
      now
    );

    return this.getLogById(id);
  }

  getLogById(id) {
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    return row ? this._formatLog(row) : null;
  }

  getLogsByUserId(userId, limit = 100) {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);
    return rows.map(row => this._formatLog(row));
  }

  getLogsByCredentialId(credentialId, limit = 100) {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE credential_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(credentialId, limit);
    return rows.map(row => this._formatLog(row));
  }

  getAllLogs(limit = 500) {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
    return rows.map(row => this._formatLog(row));
  }

  getLogsForExport() {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      ORDER BY created_at ASC
    `).all();
    return rows.map(row => this._formatLog(row));
  }

  clearOldLogs(beforeTimestamp) {
    const result = db.prepare(`
      DELETE FROM audit_logs WHERE created_at < ?
    `).run(beforeTimestamp);
    return result.changes;
  }

  _formatLog(row) {
    return {
      id: row.id,
      action: row.action,
      userId: row.user_id,
      credentialId: row.credential_id,
      success: row.success === 1,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      riskFlags: JSON.parse(row.risk_flags || '[]'),
      details: JSON.parse(row.details || '{}'),
      createdAt: new Date(row.created_at * 1000).toISOString(),
      createdAtTimestamp: row.created_at
    };
  }
}

module.exports = {
  AuditService: new AuditService(),
  ACTIONS,
  RISK_FLAGS
};
