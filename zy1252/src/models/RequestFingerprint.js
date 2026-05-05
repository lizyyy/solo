const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class RequestFingerprint {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(`
      INSERT INTO request_fingerprints (
        id, idempotency_key_id, fingerprint, 
        request_body_hash, request_params_hash, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.idempotency_key_id,
      data.fingerprint,
      data.request_body_hash || null,
      data.request_params_hash || null,
      now
    ]);
    
    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM request_fingerprints WHERE id = ?', [id]);
  }

  static async findByFingerprint(fingerprint) {
    return get('SELECT * FROM request_fingerprints WHERE fingerprint = ?', [fingerprint]);
  }

  static async findByIdempotencyKeyId(idempotencyKeyId) {
    return all('SELECT * FROM request_fingerprints WHERE idempotency_key_id = ?', [idempotencyKeyId]);
  }

  static generateHash(data) {
    if (!data) return null;
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto
      .createHash('sha256')
      .update(str, 'utf8')
      .digest('hex');
  }

  static generateFingerprint(
    requestPath, 
    requestMethod, 
    requestBody, 
    requestParams,
    userId = null
  ) {
    const components = [
      requestMethod.toUpperCase(),
      requestPath,
      this.generateHash(requestBody),
      this.generateHash(requestParams),
      userId
    ].filter(Boolean);
    
    return crypto
      .createHash('sha256')
      .update(components.join('|'), 'utf8')
      .digest('hex');
  }

  static async list(options = {}) {
    const { limit = 20, offset = 0 } = options;
    return all(`
      SELECT * FROM request_fingerprints 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
  }

  static async count() {
    const result = await get('SELECT COUNT(*) as total FROM request_fingerprints');
    return result.total;
  }
}

module.exports = { RequestFingerprint };
