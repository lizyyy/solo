const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'route-planner.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      service_type TEXT NOT NULL,
      time_window_start TEXT NOT NULL,
      time_window_end TEXT NOT NULL,
      service_duration INTEGER NOT NULL,
      priority TEXT DEFAULT 'medium',
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      skills TEXT NOT NULL,
      start_location_lat REAL NOT NULL,
      start_location_lng REAL NOT NULL,
      end_location_lat REAL NOT NULL,
      end_location_lng REAL NOT NULL,
      work_start_time TEXT NOT NULL,
      work_end_time TEXT NOT NULL,
      lunch_start TEXT NOT NULL,
      lunch_end TEXT NOT NULL,
      max_jobs_per_day INTEGER DEFAULT 10,
      vehicle_type TEXT DEFAULT 'electric_bike',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      date TEXT NOT NULL,
      strategy TEXT DEFAULT 'greedy',
      plan_data TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      plan_data TEXT NOT NULL,
      change_log TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      record_count INTEGER,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_plans_date ON plans(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active)`);
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync
};
