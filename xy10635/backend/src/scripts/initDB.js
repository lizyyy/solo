const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'conflict_assignment.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS lawyers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 5,
    current_load INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    opposing_party TEXT NOT NULL,
    case_domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_lawyer_id TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    conflict_status TEXT NOT NULL DEFAULT 'unverified',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (assigned_lawyer_id) REFERENCES lawyers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    change_reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS conflict_checks (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    opposing_party TEXT NOT NULL,
    check_result TEXT NOT NULL,
    conflict_details TEXT,
    checked_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    case_id TEXT UNIQUE NOT NULL,
    lawyer_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (lawyer_id) REFERENCES lawyers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reassignment_records (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    from_lawyer_id TEXT,
    to_lawyer_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    reassigned_by TEXT NOT NULL,
    follow_up_required INTEGER NOT NULL DEFAULT 0,
    follow_up_completed INTEGER NOT NULL DEFAULT 0,
    follow_up_note TEXT,
    follow_up_by TEXT,
    follow_up_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (from_lawyer_id) REFERENCES lawyers(id),
    FOREIGN KEY (to_lawyer_id) REFERENCES lawyers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS case_modifications (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    modified_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lead_funnel (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    entered_at TEXT NOT NULL,
    exited_at TEXT,
    notes TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    request_hash TEXT NOT NULL,
    response_data TEXT,
    created_at TEXT NOT NULL
  )`);

  console.log('数据库表创建完成');
});

db.close();
