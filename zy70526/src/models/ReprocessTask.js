const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

class ReprocessTask {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const { dataset_id, rule_id, priority, original_input, processing_basis } = data;
      
      db.get(
        `SELECT id FROM reprocess_tasks 
         WHERE dataset_id = ? AND status IN ('pending', 'processing')`,
        [dataset_id],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row) {
            reject(new Error(`Dataset ${dataset_id} already has an active reprocess task`));
            return;
          }
          
          const id = uuidv4();
          const taskPriority = priority || 'normal';
          
          db.run(
            `INSERT INTO reprocess_tasks (id, dataset_id, rule_id, status, priority, original_input, processing_basis)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, dataset_id, rule_id, 'pending', taskPriority, JSON.stringify(original_input), JSON.stringify(processing_basis || {})],
            function(err) {
              if (err) reject(err);
              else resolve({ id, ...data, status: 'pending' });
            }
          );
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM reprocess_tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.original_input = JSON.parse(row.original_input || '{}');
          row.processing_basis = JSON.parse(row.processing_basis || '{}');
          row.final_conclusion = row.final_conclusion ? JSON.parse(row.final_conclusion) : null;
          resolve(row);
        } else resolve(null);
      });
    });
  }

  static findByDatasetId(dataset_id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM reprocess_tasks WHERE dataset_id = ? ORDER BY created_at DESC',
        [dataset_id],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows.forEach(row => {
              row.original_input = JSON.parse(row.original_input || '{}');
              row.processing_basis = JSON.parse(row.processing_basis || '{}');
              row.final_conclusion = row.final_conclusion ? JSON.parse(row.final_conclusion) : null;
            });
            resolve(rows);
          }
        }
      );
    });
  }

  static updateStatus(id, status, additionalData = {}) {
    return new Promise((resolve, reject) => {
      if (!VALID_STATUSES.includes(status)) {
        reject(new Error(`Invalid status: ${status}`));
        return;
      }
      
      const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [status];
      
      if (additionalData.final_conclusion) {
        updates.push('final_conclusion = ?');
        params.push(JSON.stringify(additionalData.final_conclusion));
      }
      if (additionalData.error_message) {
        updates.push('error_message = ?');
        params.push(additionalData.error_message);
      }
      
      params.push(id);
      
      db.run(
        `UPDATE reprocess_tasks SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM reprocess_tasks WHERE 1=1';
      const params = [];
      
      if (filters.dataset_id) {
        query += ' AND dataset_id = ?';
        params.push(filters.dataset_id);
      }
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.priority) {
        query += ' AND priority = ?';
        params.push(filters.priority);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            row.original_input = JSON.parse(row.original_input || '{}');
            row.processing_basis = JSON.parse(row.processing_basis || '{}');
            row.final_conclusion = row.final_conclusion ? JSON.parse(row.final_conclusion) : null;
          });
          resolve(rows);
        }
      });
    });
  }

  static getStatuses() {
    return VALID_STATUSES;
  }

  static getPriorities() {
    return VALID_PRIORITIES;
  }
}

module.exports = ReprocessTask;