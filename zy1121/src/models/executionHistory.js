const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class ExecutionHistory {
  static async create(projectId, migrationIds, direction, status = 'pending') {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const migrationIdsJson = JSON.stringify(migrationIds);
      
      db.run(
        `INSERT INTO execution_history (id, project_id, migration_ids, direction, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, projectId, migrationIdsJson, direction, status, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, project_id: projectId, migration_ids: migrationIds, direction, status, started_at: now });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM execution_history WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.migration_ids = JSON.parse(row.migration_ids || '[]');
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  static async findByProject(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM execution_history WHERE project_id = ? ORDER BY started_at DESC`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows = rows.map(row => ({
              ...row,
              migration_ids: JSON.parse(row.migration_ids || '[]')
            }));
            resolve(rows);
          }
        }
      );
    });
  }

  static async updateStatus(id, status, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      
      db.run(
        `UPDATE execution_history 
         SET status = ?, completed_at = ?, error_message = ?
         WHERE id = ?`,
        [status, now, errorMessage, id],
        function(err) {
          if (err) reject(err);
          else ExecutionHistory.findById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  static async recordAppliedMigration(projectId, migrationId, executionId) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      db.run(
        `INSERT INTO applied_migrations (id, project_id, migration_id, execution_id, applied_at)
         VALUES (?, ?, ?, ?, ?)`,
        [id, projectId, migrationId, executionId, now],
        function(err) {
          if (err) reject(err);
          else resolve({ id, project_id: projectId, migration_id: migrationId, execution_id: executionId, applied_at: now });
        }
      );
    });
  }

  static async removeAppliedMigration(projectId, migrationId) {
    return new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM applied_migrations WHERE project_id = ? AND migration_id = ?`,
        [projectId, migrationId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static async getLastSuccess(projectId, direction = 'up') {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM execution_history 
         WHERE project_id = ? AND direction = ? AND status = 'success'
         ORDER BY completed_at DESC LIMIT 1`,
        [projectId, direction],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.migration_ids = JSON.parse(row.migration_ids || '[]');
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  static async getRollbackCandidates(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, am.applied_at, am.execution_id
         FROM migrations m
         INNER JOIN applied_migrations am ON m.id = am.migration_id
         WHERE m.project_id = ?
         ORDER BY m.version DESC`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else {
            rows = rows.map(row => ({
              ...row,
              dependencies: JSON.parse(row.dependencies || '[]')
            }));
            resolve(rows);
          }
        }
      );
    });
  }
}

module.exports = ExecutionHistory;
