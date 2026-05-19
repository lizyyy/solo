const sqlite3 = require('sqlite3').verbose();
const config = require('../config');

let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(config.dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const createTables = `
        CREATE TABLE IF NOT EXISTS import_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          source_file TEXT,
          source_type TEXT,
          operator TEXT,
          role TEXT,
          total_records INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          error_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'processing'
        );

        CREATE TABLE IF NOT EXISTS book_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          isbn TEXT,
          title TEXT,
          author TEXT,
          publisher TEXT,
          grade TEXT,
          condition TEXT,
          donor TEXT,
          remark TEXT,
          status TEXT DEFAULT 'pending',
          operator TEXT,
          role TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        );

        CREATE TABLE IF NOT EXISTS error_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          source_row INTEGER,
          raw_data TEXT,
          error_type TEXT,
          error_message TEXT,
          suggestion TEXT,
          is_resolved INTEGER DEFAULT 0,
          operator TEXT,
          role TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER,
          action TEXT,
          old_value TEXT,
          new_value TEXT,
          operator TEXT,
          role TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      db.exec(createTables, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  });
}

function getDb() {
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  closeDb,
  run,
  all,
  get
};
