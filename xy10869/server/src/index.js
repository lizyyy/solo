const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const migrationRoutes = require('./routes/migration');
const idempotencyMiddleware = require('./middleware/idempotency');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(idempotencyMiddleware);

app.use('/api/migration', migrationRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'db-migration-preview-api'
    }
  });
});

app.use((err, req, res, next) => {
  logger.error('未处理的错误', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

const checkTablesExist = (db) => {
  return new Promise((resolve) => {
    db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('target_databases', 'migration_scripts', 'preview_batches')
    `, (err, rows) => {
      if (err) {
        resolve(false);
      } else {
        resolve(rows.length >= 3);
      }
    });
  });
};

const initDatabase = async () => {
  const dbPath = path.join(__dirname, '../../data/database.db');
  const fs = require('fs');
  const dataDir = path.join(__dirname, '../../data');
  
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info('已创建数据目录:', dataDir);
    }
  } catch (err) {
    logger.warn('创建数据目录失败（可能已存在或权限问题）:', err.message);
  }
  
  const db = new sqlite3.Database(dbPath);
  const tablesExist = await checkTablesExist(db);
  
  if (!tablesExist) {
    logger.info('数据库表不存在，开始初始化...');
    
    await new Promise((resolve) => {
      db.run('PRAGMA foreign_keys = ON', () => resolve());
    });
    
    const createTables = [
      `CREATE TABLE IF NOT EXISTS target_databases (
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
      )`,
      `CREATE TABLE IF NOT EXISTS migration_scripts (
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
      )`,
      `CREATE TABLE IF NOT EXISTS preview_batches (
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
      )`,
      `CREATE TABLE IF NOT EXISTS affected_tables (
        id TEXT PRIMARY KEY,
        preview_batch_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        affected_rows INTEGER DEFAULT 0,
        before_sample TEXT,
        after_sample TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS slow_queries (
        id TEXT PRIMARY KEY,
        preview_batch_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        rows_examined INTEGER,
        rows_affected INTEGER,
        explanation TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (preview_batch_id) REFERENCES preview_batches(id)
      )`,
      `CREATE TABLE IF NOT EXISTS rollback_validations (
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
      )`,
      `CREATE TABLE IF NOT EXISTS compensation_actions (
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
      )`,
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        request_method TEXT NOT NULL,
        request_path TEXT NOT NULL,
        response_body TEXT,
        response_status INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )`
    ];

    const createIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_preview_batches_status ON preview_batches(status)`,
      `CREATE INDEX IF NOT EXISTS idx_preview_batches_migration ON preview_batches(migration_script_id)`,
      `CREATE INDEX IF NOT EXISTS idx_affected_tables_batch ON affected_tables(preview_batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_slow_queries_batch ON slow_queries(preview_batch_id)`,
      `CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key)`
    ];

    for (const sql of createTables) {
      await new Promise((resolve, reject) => {
        db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    for (const sql of createIndexes) {
      await new Promise((resolve, reject) => {
        db.run(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    logger.info('数据库表初始化完成');
  }
  
  db.close();
};

app.listen(PORT, async () => {
  await initDatabase();
  logger.info(`服务器运行在 http://localhost:${PORT}`);
  logger.info(`API 文档: http://localhost:${PORT}/api/health`);
});
