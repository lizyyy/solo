const db = require('../database');

class AuditLog {
  static async create(logData) {
    const result = await db.run(
      `INSERT INTO audit_logs (task_id, material_id, operator_id, action, field_name, old_value, new_value, reason) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logData.taskId || null,
        logData.materialId || null,
        logData.operatorId,
        logData.action,
        logData.fieldName || null,
        logData.oldValue || null,
        logData.newValue || null,
        logData.reason || null
      ]
    );
    return await this.getById(result.lastID);
  }

  static async getById(id) {
    return await db.get(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       WHERE al.id = ?`,
      [id]
    );
  }

  static async getByTaskId(taskId) {
    return await db.all(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       WHERE al.task_id = ? 
       ORDER BY al.created_at DESC`,
      [taskId]
    );
  }

  static async getByMaterialId(materialId) {
    return await db.all(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       WHERE al.material_id = ? 
       ORDER BY al.created_at DESC`,
      [materialId]
    );
  }

  static async getByOperatorId(operatorId, limit = 50) {
    return await db.all(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       WHERE al.operator_id = ? 
       ORDER BY al.created_at DESC LIMIT ?`,
      [operatorId, limit]
    );
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    
    if (filters.taskId) {
      conditions.push('al.task_id = ?');
      params.push(filters.taskId);
    }
    if (filters.materialId) {
      conditions.push('al.material_id = ?');
      params.push(filters.materialId);
    }
    if (filters.operatorId) {
      conditions.push('al.operator_id = ?');
      params.push(filters.operatorId);
    }
    if (filters.action) {
      conditions.push('al.action = ?');
      params.push(filters.action);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    
    const logs = await db.all(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       ${whereClause} 
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    const total = await db.get(
      `SELECT COUNT(*) as count FROM audit_logs al ${whereClause}`,
      params
    );
    
    return {
      logs,
      pagination: {
        page,
        pageSize,
        total: total.count,
        totalPages: Math.ceil(total.count / pageSize)
      }
    };
  }

  static async getModificationHistory(materialId) {
    const logs = await this.getByMaterialId(materialId);
    
    const history = {};
    
    logs.forEach(log => {
      if (log.field_name) {
        if (!history[log.field_name]) {
          history[log.field_name] = [];
        }
        history[log.field_name].push({
          oldValue: log.old_value,
          newValue: log.new_value,
          operator: log.operator_name,
          reason: log.reason,
          modifiedAt: log.created_at
        });
      }
    });
    
    return history;
  }
}

module.exports = AuditLog;
