const db = require('../config/database');

class ImportError {
  static async create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO import_errors 
         (import_type, file_name, row_number, original_data, error_message, suggestion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          data.import_type,
          data.file_name,
          data.row_number || null,
          data.original_data || null,
          data.error_message,
          data.suggestion || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  static async findAll(importType = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM import_errors';
      const params = [];
      
      if (importType) {
        query += ' WHERE import_type = ?';
        params.push(importType);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async clear(importType = null) {
    return new Promise((resolve, reject) => {
      let query = 'DELETE FROM import_errors';
      const params = [];
      
      if (importType) {
        query += ' WHERE import_type = ?';
        params.push(importType);
      }
      
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes });
      });
    });
  }
}

module.exports = ImportError;
