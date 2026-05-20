const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS target_databases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      database_name TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT,
      type TEXT NOT NULL DEFAULT 'mysql',
      environment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS migration_scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      author TEXT,
      version TEXT,
      target_database_id TEXT,
      rollback_script TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_database_id) REFERENCES target_databases(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS preview_batches (
      id TEXT PRIMARY KEY,
      migration_script_id TEXT NOT NULL,
      target_database_id TEXT NOT NULL,
      batch_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      execution_duration INTEGER,
      affected_rows_count INTEGER DEFAULT 0,
      affected_tables_count INTEGER DEFAULT 0,
      slow_queries_count INTEGER DEFAULT 0,
      error_message TEXT,
      error_stack TEXT,
      operator TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (migration_script_id) REFERENCES migration_scripts(id),
      FOREIGN KEY (target_database_id) REFERENCES target_databases(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS affected_tables (
      id TEXT PRIMARY KEY,
      preview_batch_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      affected_rows INTEGER DEFAULT 0,
      before_sample TEXT,
      after_sample TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS slow_queries (
      id TEXT PRIMARY KEY,
      preview_batch_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      rows_examined INTEGER,
      rows_affected INTEGER,
      explanation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rollback_validations (
      id TEXT PRIMARY KEY,
      preview_batch_id TEXT NOT NULL,
      rollback_script_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      validation_result TEXT,
      validated_by TEXT,
      validated_at DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_actions (
      id TEXT PRIMARY KEY,
      preview_batch_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      executed_by TEXT,
      executed_at DATETIME,
      result TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      request_method TEXT NOT NULL,
      request_path TEXT NOT NULL,
      response_body TEXT,
      response_status INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_preview_batches_status ON preview_batches(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_preview_batches_migration ON preview_batches(migration_script_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_affected_tables_batch ON affected_tables(preview_batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_slow_queries_batch ON slow_queries(preview_batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key)`);

  console.log('数据库表初始化完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});
