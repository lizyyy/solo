const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { MAINTENANCE_STATUSES, PLANT_STATUSES } = require('../utils/constants');

class MaintenanceTask {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO maintenance_tasks 
         (id, plant_id, location_id, scheduled_date, task_type, description, status, assigned_to, created_by, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.plant_id,
          data.location_id,
          data.scheduled_date,
          data.task_type,
          data.description,
          data.status || MAINTENANCE_STATUSES.PENDING,
          data.assigned_to,
          data.created_by,
          requestId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM maintenance_tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPlant(plantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM maintenance_tasks WHERE plant_id = ? ORDER BY scheduled_date DESC',
        [plantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async getByLocation(locationId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM maintenance_tasks WHERE location_id = ? ORDER BY scheduled_date DESC',
        [locationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async updateStatus(id, status, notes = null) {
    return new Promise((resolve, reject) => {
      const completedAt = status === MAINTENANCE_STATUSES.COMPLETED ? new Date().toISOString() : null;
      db.run(
        `UPDATE maintenance_tasks 
         SET status = ?, notes = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, notes, completedAt, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status });
        }
      );
    });
  }

  static async cancel(id, reason, operatedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE maintenance_tasks 
         SET status = ?, notes = COALESCE(notes || '; ', '') || ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [MAINTENANCE_STATUSES.CANCELLED, `取消原因: ${reason} (操作人: ${operatedBy})`, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: MAINTENANCE_STATUSES.CANCELLED });
        }
      );
    });
  }

  static async getAll(status = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM maintenance_tasks';
      let params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY scheduled_date DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = MaintenanceTask;
