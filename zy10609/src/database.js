const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'sms_blacklist.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS unsubscribe_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL,
          template_type TEXT NOT NULL,
          source TEXT NOT NULL,
          unsubscribe_time DATETIME NOT NULL,
          operator TEXT,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS restore_applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          application_no TEXT UNIQUE NOT NULL,
          phone TEXT NOT NULL,
          restore_templates TEXT NOT NULL,
          certificate_type TEXT NOT NULL,
          certificate_no TEXT,
          applicant TEXT NOT NULL,
          apply_time DATETIME NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          reviewer TEXT,
          review_time DATETIME,
          review_remark TEXT,
          conflict_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          application_no TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          operator TEXT NOT NULL,
          operation_time DATETIME NOT NULL,
          before_status TEXT,
          after_status TEXT,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_restore_phone ON restore_applications(phone)`, () => {
        db.run(`CREATE INDEX IF NOT EXISTS idx_restore_status ON restore_applications(status)`, () => {
          db.run(`CREATE INDEX IF NOT EXISTS idx_history_application ON operation_history(application_no)`, () => {
            resolve();
          });
        });
      });
    });
  });
}

module.exports = { db, initDatabase };