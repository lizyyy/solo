const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/quality.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      keywords TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      severity TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      version INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inspection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      role TEXT NOT NULL,
      transcript_text TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      inspection_result TEXT NOT NULL,
      risk_level TEXT DEFAULT 'normal',
      violation_details TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      rule_version INTEGER DEFAULT 1,
      inspector TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      record_id TEXT,
      operator TEXT NOT NULL,
      role TEXT NOT NULL,
      action_details TEXT NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensitive_fields_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_name TEXT NOT NULL,
      mask_pattern TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT NOT NULL,
      speaker_id TEXT,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES inspection_records(record_id) ON DELETE CASCADE
    )
  `);

  const insertRule = db.prepare(`
    INSERT OR IGNORE INTO inspection_rules (rule_type, rule_name, keywords, severity)
    VALUES (?, ?, ?, ?)
  `);

  const defaultRules = [
    ['apology', '道歉检测', '对不起,抱歉,不好意思,道歉,致歉', 'high'],
    ['refund', '退款承诺检测', '退款,退货,退费,退钱,全额退款,部分退款', 'high'],
    ['sensitive', '敏感词检测', '投诉,举报,315,投诉电话,监管,维权,曝光,媒体,法律,起诉', 'high'],
    ['polite', '礼貌用语检测', '您好,请,谢谢,不客气,麻烦', 'low']
  ];

  defaultRules.forEach(([type, name, keywords, severity]) => {
    insertRule.run(type, name, keywords, severity);
  });

  const insertSensitiveField = db.prepare(`
    INSERT OR IGNORE INTO sensitive_fields_config (field_name, mask_pattern)
    VALUES (?, ?)
  `);

  const sensitiveFields = [
    ['phone', '\\d(\\d{3})\\d{4}(\\d{4})', '$1****$2'],
    ['email', '(\\w{1,3})\\w+@(\\w+).(\\w+)', '$1***@$2.$3'],
    ['idcard', '(\\d{6})\\d{8}(\\d{4})', '$1********$2'],
    ['name', '(.{1}).{1,}', '$1*']
  ];

  sensitiveFields.forEach(([field, pattern, replace]) => {
    insertSensitiveField.run(field, pattern);
  });

  console.log('数据库初始化完成');
  db.close();
});
