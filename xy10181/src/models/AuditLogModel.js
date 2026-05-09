const db = require('../config/database');

class AuditLogModel {
  static async create(data, client = null) {
    const query = client || db;
    const result = await query.query(`
      INSERT INTO audit_logs (
        audit_type, entity_type, entity_id, action,
        before_data, after_data, operator, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.auditType,
      data.entityType,
      data.entityId,
      data.action,
      data.beforeData ? JSON.stringify(data.beforeData) : null,
      data.afterData ? JSON.stringify(data.afterData) : null,
      data.operator,
      data.ipAddress,
      data.userAgent,
    ]);
    return result.rows[0];
  }

  static async findByEntity(entityType, entityId, client = null) {
    const query = client || db;
    const result = await query.query(`
      SELECT * FROM audit_logs 
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
    `, [entityType, entityId]);
    return result.rows;
  }

  static async getRecent(limit = 100, client = null) {
    const query = client || db;
    const result = await query.query(`
      SELECT * FROM audit_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
}

module.exports = AuditLogModel;
