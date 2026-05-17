const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { config } = require('./config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(config.dbPath);

const STATUS = {
  NOT_OBTAINED: '未获得',
  PENDING_REVIEW: '补录待审',
  OBTAINED: '已获得',
  REVOKED: '已撤销'
};

const SOURCE_TYPES = {
  MANUAL: '手动补录',
  BATCH_IMPORT: '批量导入',
  SYSTEM: '系统触发'
};

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT UNIQUE NOT NULL,
        member_name TEXT NOT NULL,
        group_id TEXT NOT NULL,
        group_name TEXT,
        is_in_group INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id TEXT UNIQUE NOT NULL,
        activity_name TEXT NOT NULL,
        start_date DATETIME,
        end_date DATETIME,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS qualifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qualification_id TEXT UNIQUE NOT NULL,
        member_id TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL,
        operator_id TEXT,
        operator_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(member_id),
        FOREIGN KEY (activity_id) REFERENCES activities(activity_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qualification_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        operator_id TEXT,
        operator_name TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (qualification_id) REFERENCES qualifications(qualification_id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_qualifications_member ON qualifications(member_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_qualifications_activity ON qualifications(activity_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_qualifications_status ON qualifications(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_qualification ON audit_logs(qualification_id)`);

      resolve();
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = {
  db,
  initDatabase,
  closeDatabase,
  STATUS,
  SOURCE_TYPES
};
