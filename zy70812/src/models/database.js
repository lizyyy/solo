const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/port_scheduling.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vessels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vessel_name TEXT NOT NULL,
      vessel_imo TEXT UNIQUE,
      draft REAL NOT NULL,
      length REAL,
      width REAL,
      agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS berths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      berth_no TEXT UNIQUE NOT NULL,
      berth_name TEXT,
      max_draft REAL NOT NULL,
      max_length REAL,
      is_locked BOOLEAN DEFAULT 0,
      locked_by TEXT,
      locked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tide_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tide_date DATE NOT NULL,
      tide_time TIME NOT NULL,
      tide_height REAL NOT NULL,
      tide_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tide_date, tide_time)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scheduling_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      record_no TEXT UNIQUE NOT NULL,
      vessel_id INTEGER NOT NULL,
      berth_id INTEGER,
      arrival_date DATE NOT NULL,
      departure_date DATE,
      planned_berth_time DATETIME,
      actual_berth_time DATETIME,
      handling_type TEXT,
      cargo_quantity REAL,
      agent_confirmed BOOLEAN DEFAULT 0,
      agent_confirmed_by TEXT,
      agent_confirmed_at DATETIME,
      berth_locked BOOLEAN DEFAULT 0,
      berth_locked_by TEXT,
      berth_locked_at DATETIME,
      loading_plan_confirmed BOOLEAN DEFAULT 0,
      loading_plan_confirmed_by TEXT,
      loading_plan_confirmed_at DATETIME,
      status TEXT DEFAULT 'pending',
      special_case_type TEXT,
      special_case_reason TEXT,
      special_case_handled_by TEXT,
      special_case_handled_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (vessel_id) REFERENCES vessels(id),
      FOREIGN KEY (berth_id) REFERENCES berths(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      batch_id INTEGER,
      operation_type TEXT NOT NULL,
      operation_status TEXT NOT NULL,
      reason TEXT,
      handled_by TEXT NOT NULL,
      handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      FOREIGN KEY (record_id) REFERENCES scheduling_records(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_records_batch ON scheduling_records(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_vessel ON scheduling_records(vessel_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_records_status ON scheduling_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_record ON operation_logs(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id)`);
});

module.exports = db;
