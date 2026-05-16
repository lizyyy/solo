const { initDatabase, promisifyDb } = require('../config/database');

async function createTables(db) {
  const pDb = promisifyDb(db);
  
  await pDb.exec(`
    CREATE TABLE IF NOT EXISTS error_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_code TEXT UNIQUE NOT NULL,
      error_name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS retry_strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy_code TEXT UNIQUE NOT NULL,
      strategy_name TEXT NOT NULL,
      max_retries INTEGER NOT NULL DEFAULT 3,
      retry_interval INTEGER NOT NULL DEFAULT 60000,
      backoff_multiplier REAL NOT NULL DEFAULT 2.0,
      rate_limit INTEGER NOT NULL DEFAULT 10,
      rate_limit_window INTEGER NOT NULL DEFAULT 60000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS callback_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      callback_url TEXT NOT NULL,
      headers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dlx_batches (
      id TEXT PRIMARY KEY,
      batch_name TEXT NOT NULL,
      error_type_id INTEGER NOT NULL,
      strategy_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (error_type_id) REFERENCES error_types(id),
      FOREIGN KEY (strategy_id) REFERENCES retry_strategies(id)
    );

    CREATE TABLE IF NOT EXISTS dlx_messages (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      batch_id TEXT,
      error_type_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      last_retry_at DATETIME,
      original_input TEXT NOT NULL,
      processing_evidence TEXT,
      final_conclusion TEXT,
      manually_corrected_input TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES callback_events(id),
      FOREIGN KEY (batch_id) REFERENCES dlx_batches(id),
      FOREIGN KEY (error_type_id) REFERENCES error_types(id)
    );

    CREATE TABLE IF NOT EXISTS retry_reports (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES dlx_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_dlx_messages_status ON dlx_messages(status);
    CREATE INDEX IF NOT EXISTS idx_dlx_messages_error_type ON dlx_messages(error_type_id);
    CREATE INDEX IF NOT EXISTS idx_dlx_messages_batch ON dlx_messages(batch_id);
    CREATE INDEX IF NOT EXISTS idx_dlx_batches_status ON dlx_batches(status);
  `);
}

async function seedInitialData(db) {
  const pDb = promisifyDb(db);
  
  const errorTypes = [
    { code: 'NETWORK_ERROR', name: '网络错误', desc: '网络连接超时或失败' },
    { code: 'HTTP_500_ERROR', name: '服务端错误', desc: '回调地址返回5xx错误' },
    { code: 'HTTP_400_ERROR', name: '请求错误', desc: '回调地址返回4xx错误' },
    { code: 'TIMEOUT_ERROR', name: '超时错误', desc: '回调请求超时' },
    { code: 'SIGNATURE_ERROR', name: '签名错误', desc: '回调签名验证失败' },
    { code: 'UNKNOWN_ERROR', name: '未知错误', desc: '未分类的其他错误' }
  ];

  const insertError = db.prepare(`
    INSERT OR IGNORE INTO error_types (error_code, error_name, description)
    VALUES (?, ?, ?)
  `);

  for (const et of errorTypes) {
    await new Promise((resolve, reject) => {
      insertError.run(et.code, et.name, et.desc, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  const strategies = [
    { 
      code: 'STANDARD', name: '标准重试策略', 
      maxRetries: 3, interval: 60000, multiplier: 2.0, rateLimit: 10, window: 60000 
    },
    { 
      code: 'AGGRESSIVE', name: '激进重试策略', 
      maxRetries: 5, interval: 30000, multiplier: 1.5, rateLimit: 20, window: 60000 
    },
    { 
      code: 'CONSERVATIVE', name: '保守重试策略', 
      maxRetries: 2, interval: 300000, multiplier: 3.0, rateLimit: 5, window: 60000 
    }
  ];

  const insertStrategy = db.prepare(`
    INSERT OR IGNORE INTO retry_strategies 
    (strategy_code, strategy_name, max_retries, retry_interval, backoff_multiplier, rate_limit, rate_limit_window)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of strategies) {
    await new Promise((resolve, reject) => {
      insertStrategy.run(s.code, s.name, s.maxRetries, s.interval, s.multiplier, s.rateLimit, s.window, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function main() {
  const db = initDatabase();
  await createTables(db);
  await seedInitialData(db);
  console.log('数据库初始化完成！');
  db.close();
}

main().catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
