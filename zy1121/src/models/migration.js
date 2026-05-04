const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class Migration {
  static async create(projectId, version, name, upSql, downSql = null, dependencies = [], description = '') {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      const depsJson = JSON.stringify(dependencies);
      
      db.run(
        `INSERT INTO migrations (id, project_id, version, name, up_sql, down_sql, dependencies, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, version, name, upSql, downSql, depsJson, description, now, now],
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
              reject(new Error(`Migration version "${version}" already exists in project`));
            } else {
              reject(err);
            }
            return;
          }
          resolve({
            id,
            project_id: projectId,
            version,
            name,
            up_sql: upSql,
            down_sql: downSql,
            dependencies,
            description,
            created_at: now,
            updated_at: now
          });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM migrations WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.dependencies = JSON.parse(row.dependencies || '[]');
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  static async findByVersion(projectId, version) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM migrations WHERE project_id = ? AND version = ?`,
        [projectId, version],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.dependencies = JSON.parse(row.dependencies || '[]');
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
        `SELECT * FROM migrations WHERE project_id = ? ORDER BY version ASC`,
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

  static async update(id, updates) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['name', 'up_sql', 'down_sql', 'dependencies', 'description'];
      const setClauses = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          if (key === 'dependencies') {
            setClauses.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            setClauses.push(`${key} = ?`);
            values.push(value);
          }
        }
      }
      
      if (setClauses.length === 0) {
        return this.findById(id).then(resolve).catch(reject);
      }
      
      setClauses.push('updated_at = ?');
      values.push(new Date().toISOString(), id);
      
      db.run(
        `UPDATE migrations SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          Migration.findById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM migrations WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static async batchImport(projectId, migrations) {
    const results = [];
    for (const migration of migrations) {
      const existing = await this.findByVersion(projectId, migration.version);
      if (existing) {
        results.push({ version: migration.version, status: 'skipped', reason: 'already_exists' });
        continue;
      }
      
      try {
        const created = await this.create(
          projectId,
          migration.version,
          migration.name,
          migration.up_sql,
          migration.down_sql,
          migration.dependencies || [],
          migration.description || ''
        );
        results.push({ version: migration.version, status: 'imported', id: created.id });
      } catch (err) {
        results.push({ version: migration.version, status: 'error', reason: err.message });
      }
    }
    return results;
  }

  static async getAppliedMigrations(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, am.applied_at, am.execution_id 
         FROM migrations m
         INNER JOIN applied_migrations am ON m.id = am.migration_id
         WHERE m.project_id = ?
         ORDER BY m.version ASC`,
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

  static async getPendingMigrations(projectId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT m.* FROM migrations m
         WHERE m.project_id = ?
         AND m.id NOT IN (
           SELECT am.migration_id FROM applied_migrations am WHERE am.project_id = ?
         )
         ORDER BY m.version ASC`,
        [projectId, projectId],
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

module.exports = Migration;
