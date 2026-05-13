const { getDb } = require('../config/database');

async function initSchema() {
  const db = await getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_ledgers (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      trans_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      freeze_balance_before INTEGER NOT NULL,
      freeze_balance_after INTEGER NOT NULL,
      available_balance_before INTEGER NOT NULL,
      available_balance_after INTEGER NOT NULL,
      ref_id TEXT,
      ref_type TEXT,
      operator TEXT,
      operator_id TEXT,
      operator_type TEXT,
      reason TEXT,
      request_id TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_point_ledgers_member ON point_ledgers(member_id);
    CREATE INDEX IF NOT EXISTS idx_point_ledgers_request ON point_ledgers(request_id);

    CREATE TABLE IF NOT EXISTS freeze_buckets (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      frozen_amount INTEGER NOT NULL DEFAULT 0,
      used_amount INTEGER NOT NULL DEFAULT 0,
      released_amount INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      operator TEXT,
      operator_id TEXT,
      operator_type TEXT,
      freeze_rule_id TEXT,
      status TEXT NOT NULL,
      frozen_at INTEGER NOT NULL,
      expected_release_at INTEGER,
      released_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_freeze_buckets_member ON freeze_buckets(member_id);
    CREATE INDEX IF NOT EXISTS idx_freeze_buckets_status ON freeze_buckets(status);

    CREATE TABLE IF NOT EXISTS freeze_rules (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      release_type TEXT NOT NULL,
      release_days INTEGER,
      auto_release INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      total_balance INTEGER NOT NULL,
      freeze_balance INTEGER NOT NULL,
      available_balance INTEGER NOT NULL,
      ledger_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(member_id, snapshot_date)
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      member_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(request_id, action)
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_member ON idempotency_keys(member_id);
  `);
}

module.exports = { initSchema };
