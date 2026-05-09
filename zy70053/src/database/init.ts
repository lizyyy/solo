import * as sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';

export function initDatabase(dbPath: string = './credit_limit.db'): Database {
  const db = new Database(dbPath);

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS group_credits (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        total_limit REAL NOT NULL,
        available_limit REAL NOT NULL,
        used_limit REAL NOT NULL DEFAULT 0,
        frozen_limit REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sub_accounts (
        id TEXT PRIMARY KEY,
        group_credit_id TEXT NOT NULL,
        name TEXT NOT NULL,
        used_limit REAL NOT NULL DEFAULT 0,
        frozen_limit REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (group_credit_id) REFERENCES group_credits(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        group_credit_id TEXT NOT NULL,
        sub_account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        idempotency_key TEXT NOT NULL UNIQUE,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (group_credit_id) REFERENCES group_credits(id),
        FOREIGN KEY (sub_account_id) REFERENCES sub_accounts(id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_withdrawals_idempotency_key 
      ON withdrawals(idempotency_key)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS repayments (
        id TEXT PRIMARY KEY,
        group_credit_id TEXT NOT NULL,
        sub_account_id TEXT NOT NULL,
        withdrawal_id TEXT,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        idempotency_key TEXT NOT NULL UNIQUE,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (group_credit_id) REFERENCES group_credits(id),
        FOREIGN KEY (sub_account_id) REFERENCES sub_accounts(id),
        FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_repayments_idempotency_key 
      ON repayments(idempotency_key)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS freeze_records (
        id TEXT PRIMARY KEY,
        group_credit_id TEXT NOT NULL,
        sub_account_id TEXT,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        released_at TEXT,
        FOREIGN KEY (group_credit_id) REFERENCES group_credits(id),
        FOREIGN KEY (sub_account_id) REFERENCES sub_accounts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS balance_snapshots (
        id TEXT PRIMARY KEY,
        group_credit_id TEXT NOT NULL,
        snapshot_time TEXT NOT NULL,
        total_limit REAL NOT NULL,
        available_limit REAL NOT NULL,
        used_limit REAL NOT NULL,
        frozen_limit REAL NOT NULL,
        sub_accounts_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (group_credit_id) REFERENCES group_credits(id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_balance_snapshots_group_time 
      ON balance_snapshots(group_credit_id, snapshot_time)
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS background_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_background_jobs_status 
      ON background_jobs(status)
    `);
  });

  return db;
}

export function closeDatabase(db: Database): void {
  db.close();
}
