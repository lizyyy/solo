const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'rag-freshness.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始初始化数据库...');

  db.run(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      status TEXT DEFAULT 'active',
      config TEXT,
      last_crawled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_batches (
      id TEXT PRIMARY KEY,
      data_source_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      data_source_id TEXT NOT NULL,
      crawl_batch_id TEXT,
      content TEXT NOT NULL,
      metadata TEXT,
      last_modified_at TEXT NOT NULL,
      fingerprint TEXT,
      freshness_score REAL DEFAULT 100,
      is_expired INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id),
      FOREIGN KEY (crawl_batch_id) REFERENCES crawl_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS freshness_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL,
      condition TEXT NOT NULL,
      action TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tasks (
      id TEXT PRIMARY KEY,
      snippet_id TEXT NOT NULL,
      data_source_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      is_manual_fix INTEGER DEFAULT 0,
      fixed_by TEXT,
      fixed_at TEXT,
      fix_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (snippet_id) REFERENCES snippets(id),
      FOREIGN KEY (data_source_id) REFERENCES data_sources(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id TEXT,
      related_type TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      resolve_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snippet_references (
      id TEXT PRIMARY KEY,
      snippet_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer_id TEXT NOT NULL,
      reference_context TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (snippet_id) REFERENCES snippets(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      request_type TEXT NOT NULL,
      response_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成');

  db.close();
});
