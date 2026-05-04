const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/migration-manager.db';
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const tempDir = process.env.TEMP_DIR || './temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      db_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version TEXT NOT NULL,
      name TEXT NOT NULL,
      up_sql TEXT NOT NULL,
      down_sql TEXT,
      dependencies TEXT DEFAULT '[]',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      UNIQUE(project_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS execution_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      migration_ids TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      error_message TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      migration_id TEXT NOT NULL,
      execution_id TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (migration_id) REFERENCES migrations(id),
      FOREIGN KEY (execution_id) REFERENCES execution_history(id)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_migrations_project ON migrations(project_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_migrations_version ON migrations(version)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_history_project ON execution_history(project_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_applied_migrations_project ON applied_migrations(project_id)
  `);
});

module.exports = db;
