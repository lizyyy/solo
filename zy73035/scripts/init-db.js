const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'review.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE review_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_name TEXT NOT NULL,
    run_number INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    created_by TEXT DEFAULT '小温',
    remark TEXT,
    UNIQUE(batch_name, run_number)
  );

  CREATE TABLE rescue_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    pet_name TEXT NOT NULL,
    pet_alias TEXT,
    species TEXT,
    gender TEXT,
    rescue_date TEXT,
    vaccine_photo_refs TEXT,
    initial_conclusion TEXT,
    review_status TEXT DEFAULT '待复核',
    review_remark TEXT,
    manual_overridden INTEGER DEFAULT 0,
    override_reason TEXT,
    final_conclusion TEXT,
    confirmed_by TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (batch_id) REFERENCES review_batches(id)
  );

  CREATE TABLE change_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT DEFAULT '系统',
    change_type TEXT NOT NULL,
    change_reason TEXT,
    changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (record_id) REFERENCES rescue_records(id),
    FOREIGN KEY (batch_id) REFERENCES review_batches(id)
  );

  CREATE TABLE dirty_data_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    record_id INTEGER,
    issue_type TEXT NOT NULL,
    severity TEXT DEFAULT '警告',
    description TEXT NOT NULL,
    affected_fields TEXT,
    detected_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    resolved INTEGER DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES review_batches(id),
    FOREIGN KEY (record_id) REFERENCES rescue_records(id)
  );

  CREATE INDEX idx_records_batch ON rescue_records(batch_id);
  CREATE INDEX idx_records_status ON rescue_records(review_status);
  CREATE INDEX idx_history_record ON change_history(record_id);
  CREATE INDEX idx_history_batch ON change_history(batch_id);
  CREATE INDEX idx_dirty_batch ON dirty_data_reports(batch_id);
`);

console.log('数据库初始化完成 ✅');
console.log('数据库位置:', dbPath);
db.close();
