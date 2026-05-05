const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const IdempotencyStatus = {
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CONFLICT: 'conflict'
};

class IdempotencyKey {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const expiresAt = data.expires_at || 
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    await run(`
      INSERT INTO idempotency_keys (
        id, key, request_path, request_method, status, 
        response_data, created_at, updated_at, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.key,
      data.request_path,
      data.request_method,
      data.status || IdempotencyStatus.PROCESSING,
      data.response_data ? JSON.stringify(data.response_data) : null,
      now,
      now,
      expiresAt
    ]);
    
    return this.findById(id);
  }

  static async findById(id) {
    return get('SELECT * FROM idempotency_keys WHERE id = ?', [id]);
  }

  static async findByKey(key) {
    return get('SELECT * FROM idempotency_keys WHERE key = ?', [key]);
  }

  static async updateStatus(id, status, responseData = null) {
    const now = new Date().toISOString();
    
    await run(`
      UPDATE idempotency_keys 
      SET status = ?, response_data = ?, updated_at = ? 
      WHERE id = ?
    `, [
      status,
      responseData ? JSON.stringify(responseData) : null,
      now,
      id
    ]);
    
    return this.findById(id);
  }

  static async deleteByKey(key) {
    const result = await run('DELETE FROM idempotency_keys WHERE key = ?', [key]);
    return result.changes > 0;
  }

  static async list(options = {}) {
    const { limit = 20, offset = 0, status } = options;
    let query = 'SELECT * FROM idempotency_keys WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const results = await all(query, params);
    
    return results.map(r => ({
      ...r,
      response_data: r.response_data ? JSON.parse(r.response_data) : null
    }));
  }

  static async count(options = {}) {
    const { status } = options;
    let query = 'SELECT COUNT(*) as total FROM idempotency_keys WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    const result = await get(query, params);
    return result.total;
  }

  static async getStatistics() {
    return all(`
      SELECT 
        status,
        COUNT(*) as count
      FROM idempotency_keys 
      GROUP BY status
      ORDER BY count DESC
    `);
  }
}

module.exports = { IdempotencyKey, IdempotencyStatus };
