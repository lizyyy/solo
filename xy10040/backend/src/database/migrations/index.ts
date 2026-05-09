import { db } from '../client';
import { logger } from '../../utils/logger';

const migrations = [
  {
    version: 1,
    name: 'create_events_table',
    up: `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        max_participants INTEGER NOT NULL DEFAULT 0,
        current_participants INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL,
        CHECK (start_time < end_time),
        CHECK (current_participants <= max_participants)
      );
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
      CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
    `,
  },
  {
    version: 2,
    name: 'create_registrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_phone VARCHAR(20),
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        notes TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
    `,
  },
  {
    version: 3,
    name: 'create_event_log_table',
    up: `
      CREATE TABLE IF NOT EXISTS event_log (
        id BIGSERIAL PRIMARY KEY,
        aggregate_type VARCHAR(50) NOT NULL,
        aggregate_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_version INTEGER NOT NULL DEFAULT 1,
        payload JSONB NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id UUID,
        request_id UUID,
        ip_address VARCHAR(45)
      );
      CREATE INDEX IF NOT EXISTS idx_event_log_aggregate ON event_log(aggregate_type, aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_event_log_timestamp ON event_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
    `,
  },
  {
    version: 4,
    name: 'create_idempotency_tokens_table',
    up: `
      CREATE TABLE IF NOT EXISTS idempotency_tokens (
        token UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        request_path VARCHAR(255) NOT NULL,
        request_hash VARCHAR(64) NOT NULL,
        response_code INTEGER,
        response_body JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing'
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_tokens(expires_at);
    `,
  },
  {
    version: 5,
    name: 'create_distributed_locks_table',
    up: `
      CREATE TABLE IF NOT EXISTS distributed_locks (
        lock_key VARCHAR(255) PRIMARY KEY,
        holder_id UUID NOT NULL,
        acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_locks_expires ON distributed_locks(expires_at);
    `,
  },
  {
    version: 6,
    name: 'create_async_tasks_table',
    up: `
      CREATE TABLE IF NOT EXISTS async_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        next_retry_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON async_tasks(status, priority DESC, created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_retry ON async_tasks(next_retry_at);
    `,
  },
  {
    version: 7,
    name: 'create_migration_history_table',
    up: `
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        version INTEGER NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
];

async function getLatestVersion(): Promise<number> {
  try {
    const result = await db.query(
      "SELECT version FROM migration_history ORDER BY version DESC LIMIT 1"
    );
    return result.rows.length > 0 ? result.rows[0].version : 0;
  } catch {
    return 0;
  }
}

async function runMigration(version: number, name: string, up: string): Promise<void> {
  await db.transaction(async (client) => {
    await client.query(up);
    await client.query(
      'INSERT INTO migration_history (version, name) VALUES ($1, $2)',
      [version, name]
    );
  });
  logger.info(`Migration applied: v${version} - ${name}`);
}

export async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations...');

  const latestVersion = await getLatestVersion();
  const pendingMigrations = migrations.filter((m) => m.version > latestVersion);

  if (pendingMigrations.length === 0) {
    logger.info('No pending migrations');
    return;
  }

  for (const migration of pendingMigrations) {
    logger.info(`Applying migration: v${migration.version} - ${migration.name}`);
    await runMigration(migration.version, migration.name, migration.up);
  }

  logger.info('All migrations completed successfully');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Migration failed', { error: error.message });
      process.exit(1);
    });
}
