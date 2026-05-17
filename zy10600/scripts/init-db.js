const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到SQLite数据库');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS signature_rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_key TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      old_signature_version TEXT NOT NULL,
      new_signature_version TEXT NOT NULL,
      current_signature_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_enabled',
      fail_count INTEGER DEFAULT 0,
      gray_start_time DATETIME,
      switch_time DATETIME,
      rollback_time DATETIME,
      old_key_expire_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(app_key, old_signature_version, new_signature_version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rotation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rotation_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rotation_id) REFERENCES signature_rotations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS callback_retries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rotation_id INTEGER NOT NULL,
      app_key TEXT NOT NULL,
      signature_version TEXT NOT NULL,
      callback_url TEXT,
      retry_count INTEGER DEFAULT 1,
      last_retry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rotation_id) REFERENCES signature_rotations(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_rotation_app_key ON signature_rotations(app_key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rotation_status ON signature_rotations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_rotation_id ON rotation_history(rotation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_retry_rotation_id ON callback_retries(rotation_id)`);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});
