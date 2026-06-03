const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'reconciliation.db');
const db = new sqlite3.Database(dbPath);

const STATUS = {
  IMPORTED: 'IMPORTED',
  SCREENSHOT_REVIEWED: 'SCREENSHOT_REVIEWED',
  PENDING_MANAGER_REVIEW: 'PENDING_MANAGER_REVIEW',
  MANAGER_APPROVED: 'MANAGER_APPROVED',
  MANAGER_REJECTED: 'MANAGER_REJECTED',
  NORMAL: 'NORMAL',
  REVERTED: 'REVERTED'
};

const CHANGE_TYPE = {
  T1_TO_T2_MANUAL: 'T1_TO_T2_MANUAL',
  QUANTITY_ADJUSTMENT: 'QUANTITY_ADJUSTMENT',
  AMOUNT_ADJUSTMENT: 'AMOUNT_ADJUSTMENT',
  OTHER: 'OTHER'
};

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS custodian_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      original_line_number INTEGER NOT NULL,
      fund_code TEXT,
      fund_name TEXT,
      security_code TEXT,
      security_name TEXT,
      original_settlement_date TEXT,
      current_settlement_date TEXT,
      original_quantity REAL,
      current_quantity REAL,
      original_amount REAL,
      current_amount REAL,
      status TEXT NOT NULL DEFAULT '${STATUS.IMPORTED}',
      has_manual_change INTEGER NOT NULL DEFAULT 0,
      change_type TEXT,
      import_operator TEXT NOT NULL,
      import_time TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      operate_time TEXT NOT NULL,
      evidence_screenshot TEXT,
      FOREIGN KEY (record_id) REFERENCES custodian_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      transition_reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      operate_time TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES custodian_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ex_right_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      screenshot_path TEXT NOT NULL,
      upload_operator TEXT NOT NULL,
      upload_time TEXT NOT NULL,
      remark TEXT,
      FOREIGN KEY (record_id) REFERENCES custodian_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reconciliation_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      note_content TEXT NOT NULL,
      operator TEXT NOT NULL,
      update_time TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES custodian_records(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_custodian_batch ON custodian_records(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_custodian_status ON custodian_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_custodian_change ON custodian_records(has_manual_change)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_change_record ON manual_change_logs(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status_record ON status_transitions(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_screenshot_record ON ex_right_screenshots(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_note_record ON reconciliation_notes(record_id)`);

  console.log('数据库初始化完成');
  console.log('状态定义:', JSON.stringify(STATUS, null, 2));
  console.log('改动类型定义:', JSON.stringify(CHANGE_TYPE, null, 2));
});

db.close();
