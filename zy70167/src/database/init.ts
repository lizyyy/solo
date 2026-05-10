import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data', 'quality.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      content TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      published_at TEXT,
      UNIQUE(rule_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_recalculations (
      id TEXT PRIMARY KEY,
      rule_version_id TEXT NOT NULL,
      batch_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      data_count INTEGER DEFAULT 0,
      pass_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      created_by TEXT NOT NULL,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alert_subscriptions (
      id TEXT PRIMARY KEY,
      rule_version_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      subscriber_name TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      last_notified_at TEXT,
      error_message TEXT,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id),
      UNIQUE(rule_version_id, subscriber_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS false_positive_waives (
      id TEXT PRIMARY KEY,
      rule_version_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      waived_by TEXT NOT NULL,
      waived_at TEXT NOT NULL,
      affected_rows INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id),
      FOREIGN KEY (batch_id) REFERENCES batch_recalculations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quality_reports (
      id TEXT PRIMARY KEY,
      rule_version_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      total_batches INTEGER DEFAULT 0,
      success_batches INTEGER DEFAULT 0,
      fail_batches INTEGER DEFAULT 0,
      average_score REAL DEFAULT 0,
      generated_at TEXT NOT NULL,
      FOREIGN KEY (rule_version_id) REFERENCES rule_versions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      description TEXT NOT NULL,
      operator TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_rule_versions_status ON rule_versions(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rule_versions_rule_id ON rule_versions(rule_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_batches_rule_version_id ON batch_recalculations(rule_version_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_subscriptions_rule_version_id ON alert_subscriptions(rule_version_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_entity ON operation_logs(entity_type, entity_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON operation_logs(timestamp)`);
});

export default db;
