const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class Project {
  static async create(name, dbPath, description = '') {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      db.run(
        `INSERT INTO projects (id, name, description, db_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, description, dbPath, now, now],
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
              reject(new Error(`Project with name "${name}" already exists`));
            } else {
              reject(err);
            }
            return;
          }
          resolve({ id, name, description, db_path: dbPath, created_at: now, updated_at: now });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM projects WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findByName(name) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM projects WHERE name = ?`,
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM projects ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async update(id, updates) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['name', 'description', 'db_path'];
      const setClauses = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          setClauses.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (setClauses.length === 0) {
        return this.findById(id).then(resolve).catch(reject);
      }
      
      setClauses.push('updated_at = ?');
      values.push(new Date().toISOString(), id);
      
      db.run(
        `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
              reject(new Error(`Project name "${updates.name}" already exists`));
            } else {
              reject(err);
            }
            return;
          }
          if (this.changes === 0) {
            resolve(null);
            return;
          }
          Project.findById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          'DELETE FROM applied_migrations WHERE project_id = ?',
          [id]
        );
        
        db.run(
          'DELETE FROM execution_history WHERE project_id = ?',
          [id]
        );
        
        db.run(
          'DELETE FROM migrations WHERE project_id = ?',
          [id]
        );
        
        db.run(
          'DELETE FROM projects WHERE id = ?',
          [id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT');
            resolve(this.changes);
          }
        );
      });
    });
  }
}

module.exports = Project;
