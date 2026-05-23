const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS releases (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      readiness_score INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      scheduled_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS check_items (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      assignee TEXT,
      due_date DATETIME,
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id) REFERENCES releases(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS block_reasons (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      check_item_id TEXT,
      reason TEXT NOT NULL,
      reporter TEXT NOT NULL,
      resolved BOOLEAN DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id) REFERENCES releases(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exemptions (
      id TEXT PRIMARY KEY,
      release_id TEXT NOT NULL,
      check_item_id TEXT,
      reason TEXT NOT NULL,
      applicant TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver TEXT,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id) REFERENCES releases(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      release_id TEXT,
      check_item_id TEXT,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (release_id) REFERENCES releases(id),
      FOREIGN KEY (check_item_id) REFERENCES check_items(id)
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
