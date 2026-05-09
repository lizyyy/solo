const { query } = require('../config/database');

class AuditLogger {
  static async log({
    taskId,
    candidateId,
    action,
    actor,
    actorType = 'system',
    oldStatus,
    newStatus,
    details = {},
    ipAddress,
  }) {
    try {
      await query(
        `INSERT INTO audit_logs (
          task_id, candidate_id, action, actor, actor_type, 
          old_status, new_status, details, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [taskId, candidateId, action, actor, actorType, oldStatus, newStatus, details, ipAddress]
      );
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }

  static async getTaskAuditLog(taskId) {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE task_id = $1 
       ORDER BY created_at DESC`,
      [taskId]
    );
    return result.rows;
  }

  static async getCandidateAuditLog(candidateId) {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE candidate_id = $1 
       ORDER BY created_at DESC`,
      [candidateId]
    );
    return result.rows;
  }
}

module.exports = AuditLogger;
