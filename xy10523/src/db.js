const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'quota.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      current_plan_id TEXT,
      plan_effective_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      storage_quota_gb INTEGER DEFAULT 0,
      call_quota INTEGER DEFAULT 0,
      member_quota INTEGER DEFAULT 0,
      soft_limit_pct REAL DEFAULT 0.8,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS addon_packages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      effective_at TEXT NOT NULL,
      expires_at TEXT,
      source TEXT DEFAULT 'manual',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      request_id TEXT UNIQUE,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON usage_records(tenant_id, resource_type, usage_date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_request_id ON usage_records(request_id);

    CREATE TABLE IF NOT EXISTS plan_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      old_plan_id TEXT,
      new_plan_id TEXT NOT NULL,
      effective_at TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS freeze_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT,
      action TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      diff TEXT,
      operator TEXT,
      request_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
  `);

  const plans = [
    { id: 'free', name: '免费版', tier: 'free', storage_quota_gb: 1, call_quota: 1000, member_quota: 3 },
    { id: 'starter', name: '入门版', tier: 'starter', storage_quota_gb: 10, call_quota: 10000, member_quota: 10 },
    { id: 'pro', name: '专业版', tier: 'pro', storage_quota_gb: 100, call_quota: 100000, member_quota: 50 },
    { id: 'enterprise', name: '企业版', tier: 'enterprise', storage_quota_gb: 1000, call_quota: 1000000, member_quota: 200 }
  ];

  const upsertPlan = db.prepare(`
    INSERT INTO plans (id, name, tier, storage_quota_gb, call_quota, member_quota)
    VALUES (@id, @name, @tier, @storage_quota_gb, @call_quota, @member_quota)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      tier = excluded.tier,
      storage_quota_gb = excluded.storage_quota_gb,
      call_quota = excluded.call_quota,
      member_quota = excluded.member_quota
  `);

  for (const plan of plans) {
    upsertPlan.run(plan);
  }
}

module.exports = { db, initDB };
