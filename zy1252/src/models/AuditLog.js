const { run, get, all } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const AuditAction = {
  ORDER_CREATE: 'order_create',
  ORDER_UPDATE: 'order_update',
  ORDER_CANCEL: 'order_cancel',
  PAYMENT_CREATE: 'payment_create',
  PAYMENT_PROCESS: 'payment_process',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  CALLBACK_RECEIVE: 'callback_receive',
  CALLBACK_PROCESS: 'callback_process',
  CALLBACK_DUPLICATE: 'callback_duplicate',
  IDEMPOTENT_HIT: 'idempotent_hit',
  IDEMPOTENT_CONFLICT: 'idempotent_conflict',
  IDEMPOTENT_MISSING: 'idempotent_missing'
};

class AuditLog {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await run(`
      INSERT INTO audit_logs (
        id, user_id, action, resource_type, resource_id,
        details, ip_address, user_agent, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.user_id || null,
      data.action,
      data.resource_type || null,
      data.resource_id || null,
      data.details ? JSON.stringify(data.details) : null,
      data.ip_address || null,
      data.user_agent || null,
      now
    ]);
    
    return this.findById(id);
  }

  static async findById(id) {
    const result = await get('SELECT * FROM audit_logs WHERE id = ?', [id]);
    return this.parseDetails(result);
  }

  static async findByUserId(userId, limit = 20) {
    const results = await all(`
      SELECT * FROM audit_logs 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit]);
    return results.map(r => this.parseDetails(r));
  }

  static async findByResource(resourceType, resourceId) {
    const results = await all(`
      SELECT * FROM audit_logs 
      WHERE resource_type = ? AND resource_id = ? 
      ORDER BY created_at DESC
    `, [resourceType, resourceId]);
    return results.map(r => this.parseDetails(r));
  }

  static parseDetails(log) {
    if (!log) return null;
    return {
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    };
  }

  static async list(options = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      action, 
      resourceType, 
      userId,
      startDate,
      endDate
    } = options;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const results = await all(query, params);
    return results.map(r => this.parseDetails(r));
  }

  static async count(options = {}) {
    const { action, resourceType, userId, startDate, endDate } = options;
    let query = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }
    
    if (resourceType) {
      query += ' AND resource_type = ?';
      params.push(resourceType);
    }
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }
    
    const result = await get(query, params);
    return result.total;
  }

  static async getStatistics() {
    return all(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs 
      GROUP BY action
      ORDER BY count DESC
    `);
  }
}

module.exports = { AuditLog, AuditAction };
