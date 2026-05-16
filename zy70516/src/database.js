const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'change-window.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL,
        window_start DATETIME NOT NULL,
        window_end DATETIME NOT NULL,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
        dependent_services TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'delayed', 'confirmed', 'completed', 'cancelled')),
        conflict_reason TEXT,
        conclusion TEXT,
        approver TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER,
        action TEXT NOT NULL,
        original_input TEXT,
        processing_rules TEXT,
        final_conclusion TEXT,
        operator TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_name)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_window ON appointments(window_start, window_end)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_appointment ON audit_logs(appointment_id)`);

      resolve();
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  db
};
