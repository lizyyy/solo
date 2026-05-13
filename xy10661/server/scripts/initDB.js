const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waybill_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      weight REAL,
      destination TEXT,
      receiver TEXT,
      receiver_phone TEXT,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_data TEXT,
      modified_data TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sorting_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      slot_code TEXT NOT NULL,
      slot_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      sorted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_data TEXT,
      modified_data TEXT,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weight_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      weight REAL NOT NULL,
      weight_time TEXT NOT NULL,
      operator TEXT,
      status TEXT NOT NULL DEFAULT 'normal',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_data TEXT,
      modified_data TEXT,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      scan_type TEXT NOT NULL,
      scan_time TEXT NOT NULL,
      scanner TEXT,
      location TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      intercepted INTEGER DEFAULT 0,
      intercept_reason TEXT,
      callback_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      review_time TEXT NOT NULL,
      review_result TEXT NOT NULL,
      review_notes TEXT,
      responsible_party TEXT,
      before_data TEXT,
      after_data TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rethrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      rethrow_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      previous_status TEXT,
      new_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      status_text TEXT NOT NULL,
      operator TEXT,
      operate_time TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_packages_waybill ON packages(waybill_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_scan_logs_callback ON scan_logs(callback_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_scan_logs_package ON scan_logs(package_id)`);

  console.log('数据库表创建成功');
});

db.close();
