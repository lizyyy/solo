const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'appeal.db');
const uploadDir = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appeal_no TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    source_platform TEXT,
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    operator_id INTEGER,
    reviewer_id INTEGER,
    result TEXT,
    result_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS appeal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appeal_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    action TEXT NOT NULL,
    remark TEXT,
    operator_id INTEGER,
    operator_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appeal_id) REFERENCES appeals(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appeal_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by INTEGER,
    uploaded_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appeal_id) REFERENCES appeals(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    target_id INTEGER,
    detail TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
  CREATE INDEX IF NOT EXISTS idx_appeals_operator ON appeals(operator_id);
  CREATE INDEX IF NOT EXISTS idx_appeals_reviewer ON appeals(reviewer_id);
  CREATE INDEX IF NOT EXISTS idx_appeal_history_appeal ON appeal_history(appeal_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_appeal ON attachments(appeal_id);
  CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_action ON operation_logs(action);
`);

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const saltRounds = 10;
  
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role) 
    VALUES (?, ?, ?, ?)
  `);
  
  insertUser.run(
    'admin',
    bcrypt.hashSync('admin123', saltRounds),
    '系统管理员',
    'admin'
  );
  
  insertUser.run(
    'reviewer',
    bcrypt.hashSync('reviewer123', saltRounds),
    '张复核员',
    'reviewer'
  );
  
  insertUser.run(
    'operator',
    bcrypt.hashSync('operator123', saltRounds),
    '李操作员',
    'operator'
  );
}

module.exports = db;
