const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'approval.db');
const db = new sqlite3.Database(dbPath);

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    return new StatementWrapper(this.db, sql);
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

class StatementWrapper {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  run(...params) {
    return new Promise((resolve, reject) => {
      this.db.run(this.sql, ...params, function(err) {
        if (err) reject(err);
        else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      });
    });
  }

  get(...params) {
    return new Promise((resolve, reject) => {
      this.db.get(this.sql, ...params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(...params) {
    return new Promise((resolve, reject) => {
      this.db.all(this.sql, ...params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

const dbWrapper = new DatabaseWrapper(db);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS floors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          floor_name TEXT NOT NULL UNIQUE,
          total_capacity_kw REAL NOT NULL,
          reserved_capacity_kw REAL NOT NULL DEFAULT 0,
          available_capacity_kw REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS booths (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          booth_code TEXT NOT NULL UNIQUE,
          floor_id INTEGER NOT NULL,
          location_description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (floor_id) REFERENCES floors(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          application_no TEXT NOT NULL UNIQUE,
          booth_id INTEGER NOT NULL,
          applicant_name TEXT NOT NULL,
          applicant_contact TEXT,
          activity_name TEXT NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          total_power_kw REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          approval_remark TEXT,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (booth_id) REFERENCES booths(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS application_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          application_id INTEGER NOT NULL,
          device_name TEXT NOT NULL,
          device_type TEXT,
          power_kw REAL NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          total_power_kw REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (application_id) REFERENCES applications(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id TEXT NOT NULL UNIQUE,
          operation_type TEXT NOT NULL,
          application_id INTEGER,
          request_data TEXT,
          response_data TEXT,
          status TEXT NOT NULL,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run('CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_applications_time ON applications(start_time, end_time)');
      db.run('CREATE INDEX IF NOT EXISTS idx_applications_booth ON applications(booth_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_operation_logs_request ON operation_logs(request_id)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function closeDatabase() {
  return dbWrapper.close();
}

module.exports = {
  db: dbWrapper,
  initDatabase,
  closeDatabase
};
