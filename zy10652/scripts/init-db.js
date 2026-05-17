const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id VARCHAR(64) UNIQUE NOT NULL,
    app_name VARCHAR(128) NOT NULL,
    owner VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS permission_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id VARCHAR(64) NOT NULL,
    permission_key VARCHAR(64) NOT NULL,
    permission_name VARCHAR(128) NOT NULL,
    original_level INTEGER DEFAULT 1,
    target_level INTEGER DEFAULT 0,
    FOREIGN KEY (app_id) REFERENCES applications(app_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS downgrade_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    audit_opinion TEXT,
    downgrade_reason TEXT,
    operator VARCHAR(64),
    old_token_high_permission BOOLEAN DEFAULT 0,
    conflict_detected BOOLEAN DEFAULT 0,
    conflict_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES applications(app_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id VARCHAR(64) NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    operator VARCHAR(64),
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES applications(app_id)
  )`);

  console.log('数据库初始化完成');
});

db.close();
