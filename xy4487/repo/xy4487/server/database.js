const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

const db = new Database(path.join(dbPath, 'agricultural.db'));

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    -- 农户地块表
    CREATE TABLE IF NOT EXISTS plots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      farmer_name TEXT NOT NULL,
      plot_name TEXT NOT NULL,
      area REAL NOT NULL,
      location TEXT,
      crop_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 机具表
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_name TEXT NOT NULL,
      machine_type TEXT,
      license_plate TEXT,
      last_maintenance DATE,
      maintenance_interval_days INTEGER DEFAULT 90,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 机手表
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_name TEXT NOT NULL,
      id_card TEXT,
      license_type TEXT,
      license_number TEXT,
      license_expiry DATE,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 预约表
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      operator_id INTEGER,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT DEFAULT 'pending',
      work_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id),
      FOREIGN KEY (operator_id) REFERENCES operators(id)
    );

    -- 油料补贴表
    CREATE TABLE IF NOT EXISTS oil_subsidies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plot_id INTEGER NOT NULL,
      reservation_id INTEGER,
      subsidy_amount REAL NOT NULL,
      fuel_consumption REAL,
      subsidy_date DATE,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plot_id) REFERENCES plots(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    );

    -- 风险评估表
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER NOT NULL,
      risk_type TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      description TEXT,
      is_blocked INTEGER DEFAULT 0,
      manual_override INTEGER DEFAULT 0,
      override_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    );

    -- 审计日志表
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_reservations_plot ON reservations(plot_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_machine ON reservations(machine_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_risk_assessments_reservation ON risk_assessments(reservation_id);
  `);

  console.log('数据库初始化完成');
  return db;
}

module.exports = initDatabase;
