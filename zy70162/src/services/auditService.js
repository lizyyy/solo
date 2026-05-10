const db = require('../database/db');

class AuditService {
  async logAction(taskId, action, actor, details = {}, ruleApplied = null, oldStatus = null, newStatus = null) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO audit_logs 
        (task_id, action, actor, details, rule_applied, old_status, new_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        taskId,
        action,
        actor,
        JSON.stringify(details),
        ruleApplied,
        oldStatus,
        newStatus,
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
      stmt.finalize();
    });
  }

  async getTaskAuditTrail(taskId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT * FROM audit_logs 
        WHERE task_id = ? 
        ORDER BY created_at ASC, id ASC
      `, [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({
          ...r,
          details: r.details ? JSON.parse(r.details) : null
        })));
      });
    });
  }

  async queryAuditLogs(filters = {}) {
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];
    
    if (filters.taskId) {
      query += ` AND task_id = ?`;
      params.push(filters.taskId);
    }
    
    if (filters.action) {
      query += ` AND action = ?`;
      params.push(filters.action);
    }
    
    if (filters.actor) {
      query += ` AND actor = ?`;
      params.push(filters.actor);
    }
    
    if (filters.startTime) {
      query += ` AND created_at >= ?`;
      params.push(filters.startTime);
    }
    
    if (filters.endTime) {
      query += ` AND created_at <= ?`;
      params.push(filters.endTime);
    }
    
    if (filters.ruleApplied) {
      query += ` AND rule_applied = ?`;
      params.push(filters.ruleApplied);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => ({
          ...r,
          details: r.details ? JSON.parse(r.details) : null
        })));
      });
    });
  }

  async getDownloadBlockedStats(startTime, endTime) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          rule_applied,
          COUNT(*) as block_count,
          COUNT(DISTINCT task_id) as blocked_files
        FROM audit_logs
        WHERE action IN ('download_blocked', 'rule_evaluated')
        AND created_at >= ?
        AND created_at <= ?
        GROUP BY rule_applied
        ORDER BY block_count DESC
      `, [startTime, endTime], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new AuditService();
