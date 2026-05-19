const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS cleaning_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL,
      cleaner_name TEXT NOT NULL,
      checkin_date TEXT NOT NULL,
      checkout_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      photo_count INTEGER DEFAULT 0,
      photo_urls TEXT,
      status TEXT DEFAULT 'pending',
      exception_types TEXT,
      score REAL DEFAULT 100,
      deduction_amount REAL DEFAULT 0,
      rework_count INTEGER DEFAULT 0,
      is_reworked INTEGER DEFAULT 0,
      parent_record_id INTEGER,
      auditor_name TEXT,
      audit_time TEXT,
      audit_remark TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      description TEXT,
      min_photos INTEGER DEFAULT 5,
      timeout_minutes INTEGER DEFAULT 120,
      deduction_per_timeout REAL DEFAULT 10,
      deduction_per_rework REAL DEFAULT 50,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (record_id) REFERENCES cleaning_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      room_number TEXT NOT NULL,
      complaint_type TEXT NOT NULL,
      description TEXT,
      complainant TEXT,
      handler TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (record_id) REFERENCES cleaning_records(id)
    )
  `);

  console.log('数据库表创建成功！');

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO rules (rule_type, rule_name, description, min_photos, timeout_minutes, deduction_per_timeout, deduction_per_rework)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run('photo', '缺图拦截', '保洁照片数量不足时拦截记录', 5, 0, 0, 0);
  stmt.run('timeout', '超时扣分', '保洁超时按分钟扣分', 0, 120, 10, 0);
  stmt.run('rework', '返工结算', '返工次数影响结算金额', 0, 0, 0, 50);
  stmt.finalize();

  console.log('默认规则初始化完成！');
});

db.close();
