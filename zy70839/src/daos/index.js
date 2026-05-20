const db = require('../database');
const { generateId, TASK_STATUS } = require('../utils');

class TaskDAO {
  static findByBatchHash(batchHash) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE batch_hash = ?', [batchHash], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static create(task) {
    return new Promise((resolve, reject) => {
      const id = generateId();
      db.run(
        'INSERT INTO tasks (id, batch_hash, submitter, status) VALUES (?, ?, ?, ?)',
        [id, task.batchHash, task.submitter, TASK_STATUS.PROCESSING],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...task, status: TASK_STATUS.PROCESSING });
        }
      );
    });
  }

  static updateStatus(id, status, lastProcessor) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE tasks SET status = ?, last_processor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, lastProcessor, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getStatistics() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT status, COUNT(*) as count 
        FROM tasks 
        GROUP BY status
      `, [], (err, rows) => {
        if (err) reject(err);
        else {
          const stats = {};
          Object.values(TASK_STATUS).forEach(status => {
            stats[status] = 0;
          });
          rows.forEach(row => {
            stats[row.status] = row.count;
          });
          resolve(stats);
        }
      });
    });
  }
}

class MaterialDAO {
  static create(material, taskId) {
    return new Promise((resolve, reject) => {
      const id = generateId();
      db.run(
        `INSERT INTO materials 
         (id, task_id, key_number, key_status, fuel_card_number, fuel_card_balance, violation_records, manual_registration) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, taskId, material.key_number, material.key_status, material.fuel_card_number, 
         material.fuel_card_balance, material.violation_records, material.manual_registration],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...material });
        }
      );
    });
  }

  static batchCreate(materials, taskId) {
    return Promise.all(materials.map(m => this.create(m, taskId)));
  }

  static findByTaskId(taskId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM materials WHERE task_id = ?', [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

class AuditLogDAO {
  static create(log) {
    return new Promise((resolve, reject) => {
      const id = generateId();
      db.run(
        `INSERT INTO audit_logs 
         (id, task_id, operator, change_reason, old_status, new_status, old_data, new_data) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, log.taskId, log.operator, log.changeReason, log.oldStatus, 
         log.newStatus, log.oldData, log.newData],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...log });
        }
      );
    });
  }

  static findByTaskId(taskId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM audit_logs WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

class ExportDAO {
  static create(exp) {
    return new Promise((resolve, reject) => {
      const id = generateId();
      db.run(
        'INSERT INTO exports (id, task_id, exported_by, export_data) VALUES (?, ?, ?, ?)',
        [id, exp.taskId, exp.exportedBy, JSON.stringify(exp.exportData)],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...exp });
        }
      );
    });
  }

  static findByTaskId(taskId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM exports WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = {
  TaskDAO,
  MaterialDAO,
  AuditLogDAO,
  ExportDAO
};