const { exec } = require('./index');

const EVENT_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED_RETRY: 'failed_retry',
  DISCARDED: 'discarded',
};

const SIGNATURE_ALGORITHMS = ['sha256', 'sha512', 'sha1'];

async function createTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      algorithm TEXT NOT NULL DEFAULT 'sha256',
      secret TEXT NOT NULL,
      tolerance_seconds INTEGER NOT NULL DEFAULT 300,
      signature_header TEXT NOT NULL DEFAULT 'X-Signature',
      timestamp_header TEXT NOT NULL DEFAULT 'X-Timestamp',
      event_id_key TEXT DEFAULT 'eventId',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_providers_name ON providers(name);
    CREATE INDEX IF NOT EXISTS idx_providers_enabled ON providers(enabled);
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      provider_name TEXT NOT NULL,
      event_id TEXT,
      payload_hash TEXT NOT NULL UNIQUE,
      raw_body TEXT NOT NULL,
      headers TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'POST',
      path TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      received_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      processed_at INTEGER,
      last_attempt_at INTEGER,
      next_retry_at INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      FOREIGN KEY (provider_id) REFERENCES providers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_provider ON webhook_events(provider_name);
    CREATE INDEX IF NOT EXISTS idx_events_event_id ON webhook_events(event_id);
    CREATE INDEX IF NOT EXISTS idx_events_status ON webhook_events(status);
    CREATE INDEX IF NOT EXISTS idx_events_next_retry ON webhook_events(next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_events_received ON webhook_events(received_at);
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS processing_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      ended_at INTEGER,
      duration_ms INTEGER,
      is_replay INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (event_id) REFERENCES webhook_events(id)
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_event ON processing_attempts(event_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_status ON processing_attempts(status);
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      triggered_by TEXT DEFAULT 'system'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS simulator_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL,
      event_type TEXT NOT NULL DEFAULT '*',
      mode TEXT NOT NULL DEFAULT 'success',
      fail_count INTEGER,
      error_message TEXT,
      delay_ms INTEGER DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id),
      UNIQUE(provider_id, event_type)
    );

    CREATE INDEX IF NOT EXISTS idx_simulator_provider ON simulator_configs(provider_id);
  `);

  console.log('[Schema] All tables created successfully');
}

module.exports = { createTables, EVENT_STATUSES, SIGNATURE_ALGORITHMS };
