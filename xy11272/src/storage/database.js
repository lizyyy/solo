const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/forklift.db');

let db;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS forklifts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            battery_level INTEGER NOT NULL DEFAULT 100,
            status TEXT NOT NULL DEFAULT 'idle',
            current_driver TEXT,
            last_updated TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS charging_stations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'available',
            current_forklift TEXT,
            locked_by TEXT,
            locked_until TEXT,
            last_updated TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS shifts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            shift_type TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            date TEXT NOT NULL,
            manager TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            created_at TEXT NOT NULL
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS assignments (
            id TEXT PRIMARY KEY,
            shift_id TEXT NOT NULL,
            forklift_id TEXT NOT NULL,
            driver TEXT NOT NULL,
            task_description TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            FOREIGN KEY (shift_id) REFERENCES shifts(id),
            FOREIGN KEY (forklift_id) REFERENCES forklifts(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS charging_locks (
            id TEXT PRIMARY KEY,
            station_id TEXT NOT NULL,
            forklift_id TEXT NOT NULL,
            driver TEXT NOT NULL,
            shift_id TEXT,
            lock_time TEXT NOT NULL,
            expected_release_time TEXT,
            actual_release_time TEXT,
            status TEXT NOT NULL DEFAULT 'locked',
            reason TEXT,
            created_at TEXT NOT NULL,
            last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (station_id) REFERENCES charging_stations(id),
            FOREIGN KEY (forklift_id) REFERENCES forklifts(id),
            FOREIGN KEY (shift_id) REFERENCES shifts(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operator TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT,
            details TEXT,
            created_at TEXT NOT NULL
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS exceptions (
            id TEXT PRIMARY KEY,
            exception_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            handled INTEGER NOT NULL DEFAULT 0,
            handler TEXT,
            handled_at TEXT,
            created_at TEXT NOT NULL
          )
        `, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(db);
          }
        });
      });
    });
  });
}

function getDatabase() {
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  runQuery,
  getQuery,
  allQuery
};
