const db = require('../database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class Task {
  static generateTaskNo() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `STAMP-${dateStr}-${random}`;
  }

  static generateBatchHash(materials) {
    const sorted = materials.map(m => JSON.stringify(m)).sort();
    const hash = crypto.createHash('sha256');
    hash.update(sorted.join('|'));
    return hash.digest('hex');
  }

  static async findByBatchHash(batchHash) {
    return await db.get(
      'SELECT * FROM tasks WHERE batch_hash = ? ORDER BY created_at DESC LIMIT 1',
      [batchHash]
    );
  }

  static async create(submitterId, stampType, materials, batchHash) {
    const taskNo = this.generateTaskNo();
    const result = await db.run(
      `INSERT INTO tasks (task_no, batch_hash, submitter_id, status, stamp_type, total_materials) 
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [taskNo, batchHash, submitterId, stampType, materials.length]
    );
    
    return await this.getById(result.lastID);
  }

  static async getById(id) {
    return await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  }

  static async getByTaskNo(taskNo) {
    return await db.get('SELECT * FROM tasks WHERE task_no = ?', [taskNo]);
  }

  static async updateStatus(id, status, errorDetails = null) {
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    
    if (errorDetails !== null) {
      updates.push('error_details = ?');
      params.push(JSON.stringify(errorDetails));
    }
    
    params.push(id);
    
    await db.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return await this.getById(id);
  }

  static async markAsExported(id) {
    await db.run(
      `UPDATE tasks SET status = 'exported', exported_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );
    return await this.getById(id);
  }

  static async list(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.stampType) {
      conditions.push('stamp_type = ?');
      params.push(filters.stampType);
    }
    if (filters.submitterId) {
      conditions.push('submitter_id = ?');
      params.push(filters.submitterId);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;
    
    const tasks = await db.all(
      `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    
    const total = await db.get(
      `SELECT COUNT(*) as count FROM tasks ${whereClause}`,
      params
    );
    
    return {
      tasks,
      pagination: {
        page,
        pageSize,
        total: total.count,
        totalPages: Math.ceil(total.count / pageSize)
      }
    };
  }

  static async getFullTrace(taskId) {
    const task = await this.getById(taskId);
    if (!task) return null;

    const materials = await db.all(
      'SELECT * FROM materials WHERE task_id = ? ORDER BY material_index',
      [taskId]
    );

    const auditLogs = await db.all(
      `SELECT al.*, u.username as operator_name 
       FROM audit_logs al 
       LEFT JOIN users u ON al.operator_id = u.id 
       WHERE al.task_id = ? 
       ORDER BY al.created_at DESC`,
      [taskId]
    );

    const submitter = await db.get(
      'SELECT username, role, department FROM users WHERE id = ?',
      [task.submitter_id]
    );

    return {
      task,
      submitter,
      materials,
      auditLogs
    };
  }
}

module.exports = Task;
