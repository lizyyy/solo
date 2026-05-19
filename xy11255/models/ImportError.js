const { getDb } = require('../src/database');

class ImportError {
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO import_errors (import_type, file_name, row_number, raw_data, error_message, suggestion)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        data.import_type,
        data.file_name,
        data.row_number || null,
        data.raw_data || '',
        data.error_message,
        data.suggestion || '',
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM import_errors ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByType(importType) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM import_errors WHERE import_type = ? ORDER BY created_at DESC', [importType], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static clearByType(importType) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.run('DELETE FROM import_errors WHERE import_type = ?', [importType], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = ImportError;
