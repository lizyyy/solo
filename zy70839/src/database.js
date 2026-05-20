const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        batch_hash TEXT UNIQUE NOT NULL,
        submitter TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_processor TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS materials (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        key_number TEXT,
        key_status TEXT,
        fuel_card_number TEXT,
        fuel_card_balance REAL,
        violation_records TEXT,
        manual_registration TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        operator TEXT NOT NULL,
        change_reason TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        old_data TEXT,
        new_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        exported_by TEXT NOT NULL,
        export_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_batch_hash ON tasks(batch_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_materials_task_id ON materials(task_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id)`);
  });
}

module.exports = db;