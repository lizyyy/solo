const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/rate-limit-ledger.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      contact_email TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenant_quotas (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      api_group_id TEXT NOT NULL,
      daily_quota INTEGER NOT NULL DEFAULT 1000,
      monthly_quota INTEGER NOT NULL DEFAULT 30000,
      remaining_daily INTEGER NOT NULL,
      remaining_monthly INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (api_group_id) REFERENCES api_groups(id),
      UNIQUE(tenant_id, api_group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS call_windows (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      api_group_id TEXT NOT NULL,
      window_start DATETIME NOT NULL,
      window_end DATETIME NOT NULL,
      call_count INTEGER DEFAULT 0,
      window_size_seconds INTEGER NOT NULL DEFAULT 60,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (api_group_id) REFERENCES api_groups(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rate_limit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      api_group_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      window_id TEXT,
      request_details TEXT,
      resolved BOOLEAN DEFAULT 0,
      resolved_at DATETIME,
      resolved_by TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (api_group_id) REFERENCES api_groups(id),
      FOREIGN KEY (window_id) REFERENCES call_windows(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_records (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      api_group_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      rate_limit_event_id TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (api_group_id) REFERENCES api_groups(id),
      FOREIGN KEY (rate_limit_event_id) REFERENCES rate_limit_events(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS billing_summaries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      period_type TEXT NOT NULL,
      period_start DATETIME NOT NULL,
      period_end DATETIME NOT NULL,
      total_calls INTEGER DEFAULT 0,
      limited_calls INTEGER DEFAULT 0,
      compensation_amount INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      exported BOOLEAN DEFAULT 0,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_rate_limit_events_tenant ON rate_limit_events(tenant_id, triggered_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_call_windows_tenant ON call_windows(tenant_id, api_group_id, window_start)`);
});

module.exports = db;
