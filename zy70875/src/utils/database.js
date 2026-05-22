const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/cinema-subsidy.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          batchName TEXT NOT NULL,
          operator TEXT NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'created',
          rawData TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          batchId TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'processing',
          progress INTEGER NOT NULL DEFAULT 0,
          errorMessage TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY (batchId) REFERENCES batches(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS calculation_results (
          id TEXT PRIMARY KEY,
          taskId TEXT NOT NULL,
          screeningId TEXT NOT NULL,
          cinemaId TEXT NOT NULL,
          cinemaName TEXT NOT NULL,
          filmId TEXT NOT NULL,
          filmName TEXT NOT NULL,
          category TEXT NOT NULL,
          reason TEXT,
          subsidyAmount REAL NOT NULL,
          details TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          taskId TEXT NOT NULL,
          operator TEXT NOT NULL,
          action TEXT NOT NULL,
          beforeData TEXT,
          afterData TEXT,
          reason TEXT,
          timestamp TEXT NOT NULL,
          FOREIGN KEY (taskId) REFERENCES tasks(id)
        )
      `);

      db.run('CREATE INDEX IF NOT EXISTS idx_tasks_batchId ON tasks(batchId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_results_taskId ON calculation_results(taskId)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_taskId ON audit_logs(taskId)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getCurrentTime() {
  return new Date().toISOString();
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
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

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  generateId,
  getCurrentTime,
  run,
  get,
  all
};
