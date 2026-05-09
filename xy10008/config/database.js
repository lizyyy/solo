const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'bill_system.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

const initTables = () => {
  const transaction = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        total_amount REAL NOT NULL,
        payer_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (payer_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_bills_payer ON bills(payer_id);
      CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);

      CREATE TABLE IF NOT EXISTS bill_splits (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (bill_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_bill_splits_bill ON bill_splits(bill_id);
      CREATE INDEX IF NOT EXISTS idx_bill_splits_user ON bill_splits(user_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        performed_by TEXT,
        timestamp INTEGER NOT NULL,
        request_id TEXT,
        ip_address TEXT,
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE (request_id)
      );

      CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

      CREATE TABLE IF NOT EXISTS task_queue (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        error_message TEXT,
        last_attempted_at INTEGER,
        next_retry_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_status ON task_queue(status, next_retry_at);
      CREATE INDEX IF NOT EXISTS idx_task_type ON task_queue(task_type);
    `);
  });

  transaction();
};

initTables();

module.exports = db;
