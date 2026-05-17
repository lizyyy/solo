const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'security-inspection.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_code TEXT UNIQUE NOT NULL,
      level_name TEXT NOT NULL,
      level_desc TEXT,
      severity INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      batch_name TEXT NOT NULL,
      inspection_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status TEXT DEFAULT 'draft',
      inspector TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_no TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL,
      check_content TEXT NOT NULL,
      risk_level_id INTEGER NOT NULL,
      current_status TEXT DEFAULT 'pending',
      rectifier TEXT,
      rectify_deadline DATE,
      rectify_description TEXT,
      source_type TEXT,
      source_ref TEXT,
      raw_input TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
      FOREIGN KEY (risk_level_id) REFERENCES risk_levels(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rectification_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      rectify_content TEXT NOT NULL,
      rectifier TEXT NOT NULL,
      rectify_date DATE NOT NULL,
      evidences TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      review_date DATE NOT NULL,
      review_conclusion TEXT NOT NULL,
      review_opinion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exception_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER,
      exception_type TEXT NOT NULL,
      raw_input TEXT,
      error_message TEXT,
      handling_basis TEXT,
      handler TEXT,
      handled_at DATETIME,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL,
      report_type TEXT NOT NULL,
      generated_by TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      content_summary TEXT,
      report_data TEXT,
      file_path TEXT,
      FOREIGN KEY (batch_id) REFERENCES inspection_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      corrector TEXT NOT NULL,
      correction_reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inspection_items(id)
    )
  `);

  const riskLevels = [
    { code: 'critical', name: '严重', desc: '可能导致重大安全事件', severity: 4 },
    { code: 'high', name: '高危', desc: '可能导致安全事件', severity: 3 },
    { code: 'medium', name: '中危', desc: '存在安全隐患', severity: 2 },
    { code: 'low', name: '低危', desc: '轻微问题', severity: 1 }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO risk_levels (level_code, level_name, level_desc, severity) VALUES (?, ?, ?, ?)');
  riskLevels.forEach(level => {
    stmt.run(level.code, level.name, level.desc, level.severity);
  });
  stmt.finalize();

  console.log('数据库初始化完成');
});

db.close();
