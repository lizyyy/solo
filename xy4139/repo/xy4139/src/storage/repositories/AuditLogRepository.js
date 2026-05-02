const db = require('../database');
const AuditLog = require('../../models/AuditLog');

class AuditLogRepository {
  async create(auditLog) {
    const sql = `
      INSERT INTO audit_logs (
        id, action, entity_type, entity_id, entity_name, description,
        old_value, new_value, user_id, user_name, user_role, ip_address,
        user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      auditLog.id, auditLog.action, auditLog.entity_type, auditLog.entity_id,
      auditLog.entity_name, auditLog.description, auditLog.old_value,
      auditLog.new_value, auditLog.user_id, auditLog.user_name, auditLog.user_role,
      auditLog.ip_address, auditLog.user_agent, auditLog.created_at
    ];
    
    await db.run(sql, params);
    return auditLog;
  }

  async findById(id) {
    const sql = 'SELECT * FROM audit_logs WHERE id = ?';
    const row = await db.get(sql, [id]);
    if (row) {
      return new AuditLog(row);
    }
    return null;
  }

  async findAll(options = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (options.action) {
      sql += ' AND action = ?';
      params.push(options.action);
    }
    
    if (options.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(options.entity_type);
    }
    
    if (options.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(options.entity_id);
    }
    
    if (options.user_id) {
      sql += ' AND user_id = ?';
      params.push(options.user_id);
    }
    
    if (options.user_role) {
      sql += ' AND user_role = ?';
      params.push(options.user_role);
    }
    
    if (options.start_date) {
      sql += ' AND created_at >= ?';
      params.push(options.start_date);
    }
    
    if (options.end_date) {
      sql += ' AND created_at <= ?';
      params.push(options.end_date);
    }
    
    if (options.sortBy) {
      const sortOrder = options.sortOrder === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY ${options.sortBy} ${sortOrder}`;
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const rows = await db.all(sql, params);
    return rows.map(row => new AuditLog(row));
  }

  async count(options = {}) {
    let sql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const params = [];
    
    if (options.action) {
      sql += ' AND action = ?';
      params.push(options.action);
    }
    
    if (options.entity_type) {
      sql += ' AND entity_type = ?';
      params.push(options.entity_type);
    }
    
    if (options.entity_id) {
      sql += ' AND entity_id = ?';
      params.push(options.entity_id);
    }
    
    if (options.user_id) {
      sql += ' AND user_id = ?';
      params.push(options.user_id);
    }
    
    if (options.user_role) {
      sql += ' AND user_role = ?';
      params.push(options.user_role);
    }
    
    if (options.start_date) {
      sql += ' AND created_at >= ?';
      params.push(options.start_date);
    }
    
    if (options.end_date) {
      sql += ' AND created_at <= ?';
      params.push(options.end_date);
    }
    
    const result = await db.get(sql, params);
    return result.total;
  }

  async findByEntity(entityType, entityId) {
    return this.findAll({
      entity_type: entityType,
      entity_id: entityId
    });
  }

  async findByUserId(userId, options = {}) {
    return this.findAll({
      user_id: userId,
      ...options
    });
  }

  async logAction(actionData) {
    const auditLog = new AuditLog(actionData);
    return this.create(auditLog);
  }

  async getRecentLogs(limit = 100) {
    return this.findAll({
      limit: limit,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
  }
}

module.exports = AuditLogRepository;
