const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class Dataset {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { name, description, data_source, record_count, fields } = data;
      const fieldsJson = JSON.stringify(fields || []);
      
      db.run(
        `INSERT INTO datasets (id, name, description, data_source, record_count, fields)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, description, data_source, record_count, fieldsJson],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data, status: 'pending' });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM datasets WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.fields = JSON.parse(row.fields || '[]');
          resolve(row);
        } else resolve(null);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM datasets WHERE 1=1';
      const params = [];
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          rows.forEach(row => {
            row.fields = JSON.parse(row.fields || '[]');
          });
          resolve(rows);
        }
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE datasets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const updates = [];
      const params = [];
      
      if (data.name) { updates.push('name = ?'); params.push(data.name); }
      if (data.description) { updates.push('description = ?'); params.push(data.description); }
      if (data.status) { updates.push('status = ?'); params.push(data.status); }
      if (data.fields) { updates.push('fields = ?'); params.push(JSON.stringify(data.fields)); }
      
      if (updates.length === 0) {
        resolve(false);
        return;
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      
      db.run(
        `UPDATE datasets SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }
}

module.exports = Dataset;