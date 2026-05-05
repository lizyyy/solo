const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../../data');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'trainer.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS drills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS import_files (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schema_data (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS slow_log_entries (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      query_time REAL,
      lock_time REAL,
      rows_sent INTEGER,
      rows_examined INTEGER,
      sql_text TEXT,
      timestamp TEXT,
      database TEXT,
      user TEXT,
      host TEXT,
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS write_samples (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      table_name TEXT,
      operation_type TEXT,
      rows_count INTEGER,
      frequency REAL,
      sample_data TEXT,
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL UNIQUE,
      bottlenecks_json TEXT,
      sql_suggestions_json TEXT,
      index_suggestions_json TEXT,
      connection_pool_json TEXT,
      read_write_routing_json TEXT,
      sharding_risks_json TEXT,
      overall_score REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bottlenecks (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      suggestion TEXT,
      impact_score REAL,
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS index_issues (
      id TEXT PRIMARY KEY,
      drill_id TEXT NOT NULL,
      table_name TEXT,
      issue_type TEXT,
      index_name TEXT,
      description TEXT,
      suggestion TEXT,
      FOREIGN KEY (drill_id) REFERENCES drills(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_drills_created_at ON drills(created_at);
    CREATE INDEX IF NOT EXISTS idx_import_files_drill_id ON import_files(drill_id);
    CREATE INDEX IF NOT EXISTS idx_slow_log_drill_id ON slow_log_entries(drill_id);
    CREATE INDEX IF NOT EXISTS idx_analysis_drill_id ON analysis_results(drill_id);
  `);

  console.log('数据库初始化完成');
};

initTables();

module.exports = db;
