const { v4: uuidv4 } = require('uuid');
const db = require('../database');

class CredentialService {
  createCredential({
    credentialId,
    userId,
    publicKey,
    algorithm,
    rpId,
    origin,
    transports = [],
    deviceRemark = null,
    signCount = 0
  }) {
    const existing = db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(credentialId);
    if (existing) {
      throw new Error('CREDENTIAL_EXISTS');
    }

    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO credentials (
        id, credential_id, user_id, public_key, algorithm, sign_count,
        rp_id, origin, transports, device_remark, is_revoked, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      credentialId,
      userId,
      publicKey,
      algorithm,
      signCount,
      rpId,
      origin,
      JSON.stringify(transports),
      deviceRemark,
      now,
      now
    );

    return this.getCredentialById(id);
  }

  getCredentialById(id) {
    const row = db.prepare('SELECT * FROM credentials WHERE id = ?').get(id);
    return row ? this._formatCredential(row) : null;
  }

  getCredentialByCredentialId(credentialId) {
    const row = db.prepare('SELECT * FROM credentials WHERE credential_id = ?').get(credentialId);
    return row ? this._formatCredential(row) : null;
  }

  getCredentialsByUserId(userId) {
    const rows = db.prepare(`
      SELECT * FROM credentials 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    return rows.map(row => this._formatCredential(row));
  }

  getAllCredentials() {
    const rows = db.prepare('SELECT * FROM credentials ORDER BY created_at DESC').all();
    return rows.map(row => this._formatCredential(row));
  }

  updateSignCount(id, newSignCount) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE credentials SET sign_count = ?, updated_at = ? WHERE id = ?
    `).run(newSignCount, now, id);
    return result.changes > 0;
  }

  updateDeviceRemark(id, deviceRemark) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE credentials SET device_remark = ?, updated_at = ? WHERE id = ?
    `).run(deviceRemark, now, id);
    return result.changes > 0;
  }

  revokeCredential(id) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE credentials SET is_revoked = 1, revoked_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, id);
    return result.changes > 0;
  }

  unrevokeCredential(id) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE credentials SET is_revoked = 0, revoked_at = NULL, updated_at = ? WHERE id = ?
    `).run(now, id);
    return result.changes > 0;
  }

  deleteCredential(id) {
    const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
    return result.changes > 0;
  }

  _formatCredential(row) {
    return {
      id: row.id,
      credentialId: row.credential_id,
      credentialIdBase64: row.credential_id.toString('base64url'),
      userId: row.user_id,
      publicKey: row.public_key,
      publicKeyBase64: row.public_key.toString('base64url'),
      algorithm: row.algorithm,
      signCount: row.sign_count,
      rpId: row.rp_id,
      origin: row.origin,
      transports: JSON.parse(row.transports || '[]'),
      deviceRemark: row.device_remark,
      isRevoked: row.is_revoked === 1,
      revokedAt: row.revoked_at ? new Date(row.revoked_at * 1000).toISOString() : null,
      createdAt: new Date(row.created_at * 1000).toISOString(),
      updatedAt: new Date(row.updated_at * 1000).toISOString()
    };
  }
}

module.exports = new CredentialService();
