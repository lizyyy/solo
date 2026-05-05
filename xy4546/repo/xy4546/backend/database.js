const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/escalator.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库');
  }
});

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS escalators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_name TEXT NOT NULL,
          escalator_code TEXT NOT NULL UNIQUE,
          location TEXT,
          manufacturer TEXT,
          install_date TEXT,
          status TEXT DEFAULT 'normal',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inspections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          escalator_code TEXT NOT NULL,
          inspection_date TEXT NOT NULL,
          inspector TEXT,
          overall_status TEXT,
          issues TEXT,
          safety_chain_check TEXT,
          emergency_stop_check TEXT,
          handrail_check TEXT,
          step_check TEXT,
          comb_plate_check TEXT,
          lubrication_check TEXT,
          noise_level TEXT,
          vibration_level TEXT,
          next_inspection_date TEXT,
          remarks TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (escalator_code) REFERENCES escalators (escalator_code)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS current_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          escalator_code TEXT NOT NULL,
          log_time TEXT NOT NULL,
          phase_a_current REAL,
          phase_b_current REAL,
          phase_c_current REAL,
          average_current REAL,
          status TEXT DEFAULT 'normal',
          is_overload INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (escalator_code) REFERENCES escalators (escalator_code)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS repair_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          escalator_code TEXT NOT NULL,
          report_time TEXT NOT NULL,
          reporter_name TEXT,
          reporter_phone TEXT,
          fault_description TEXT,
          fault_type TEXT,
          severity TEXT,
          handle_status TEXT DEFAULT 'pending',
          handle_time TEXT,
          handler TEXT,
          handle_result TEXT,
          is_false_alarm INTEGER DEFAULT 0,
          remarks TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (escalator_code) REFERENCES escalators (escalator_code)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS maintenance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          escalator_code TEXT NOT NULL,
          call_time TEXT NOT NULL,
          arrival_time TEXT,
          departure_time TEXT,
          maintenance_type TEXT,
          fault_description TEXT,
          maintenance_content TEXT,
          parts_replaced TEXT,
          technician_name TEXT,
          technician_phone TEXT,
          maintenance_result TEXT,
          is_resolved INTEGER DEFAULT 0,
          next_maintenance_date TEXT,
          remarks TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (escalator_code) REFERENCES escalators (escalator_code)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS risks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          escalator_code TEXT NOT NULL,
          risk_type TEXT NOT NULL,
          risk_level TEXT DEFAULT 'medium',
          detected_time TEXT NOT NULL,
          description TEXT,
          related_records TEXT,
          manual_judgment TEXT,
          manual_remarks TEXT,
          is_reopened INTEGER DEFAULT 0,
          reopened_count INTEGER DEFAULT 0,
          last_reopened_time TEXT,
          status TEXT DEFAULT 'pending',
          resolved_time TEXT,
          resolver TEXT,
          resolve_description TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (escalator_code) REFERENCES escalators (escalator_code)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS risk_status_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          risk_id INTEGER NOT NULL,
          old_status TEXT,
          new_status TEXT,
          operator TEXT,
          remarks TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (risk_id) REFERENCES risks (id)
        )
      `);

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_escalator_code ON escalators (escalator_code)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_station_name ON escalators (station_name)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_current_logs_time ON current_logs (log_time)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_repair_time ON repair_records (report_time)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_maintenance_time ON maintenance_records (call_time)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_risk_type ON risks (risk_type)
      `);
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_risk_status ON risks (status)
      `);

      resolve();
    }, (err) => {
      if (err) reject(err);
    });
  });
}

function init() {
  return createTables();
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function runBatch(sql, dataArray) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql);
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      for (const data of dataArray) {
        stmt.run(data, (err) => {
          if (err) {
            console.error('批量插入错误:', err);
          }
        });
      }
      db.run('COMMIT', (err) => {
        if (err) {
          reject(err);
        } else {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

module.exports = {
  db,
  init,
  run,
  get,
  all,
  runBatch
};
