const db = require('./connection');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_type TEXT DEFAULT 'markdown',
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      responsibility_node TEXT
    );

    CREATE TABLE IF NOT EXISTS slice_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0.0',
      description TEXT,
      max_chunk_length INTEGER DEFAULT 500,
      min_chunk_length INTEGER DEFAULT 100,
      preserve_tables INTEGER DEFAULT 1,
      inherit_headers INTEGER DEFAULT 1,
      table_handling_strategy TEXT DEFAULT 'split',
      heading_hierarchy_level INTEGER DEFAULT 3,
      overlap_size INTEGER DEFAULT 50,
      status TEXT DEFAULT 'draft',
      effect_remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS heading_hierarchies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      rule_id INTEGER,
      level INTEGER NOT NULL,
      text TEXT NOT NULL,
      position INTEGER,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES slice_rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS table_fragments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      rule_id INTEGER,
      original_table TEXT NOT NULL,
      fragment_content TEXT NOT NULL,
      row_count INTEGER,
      col_count INTEGER,
      handling_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES slice_rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS slice_previews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      rule_id INTEGER,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      heading_path TEXT,
      chunk_length INTEGER,
      has_table INTEGER DEFAULT 0,
      quality_score REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES slice_rules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS published_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      version_tag TEXT NOT NULL,
      config_snapshot TEXT NOT NULL,
      description TEXT,
      published_by TEXT,
      is_active INTEGER DEFAULT 0,
      rollback_from_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES slice_rules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      request_input TEXT,
      response_result TEXT,
      responsibility_node TEXT,
      status TEXT,
      error_message TEXT,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_rules_status ON slice_rules(status);
    CREATE INDEX IF NOT EXISTS idx_previews_document ON slice_previews(document_id);
    CREATE INDEX IF NOT EXISTS idx_previews_rule ON slice_previews(rule_id);
    CREATE INDEX IF NOT EXISTS idx_versions_rule ON published_versions(rule_id);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON request_logs(created_at);
  `);

  console.log('数据库表初始化完成');
}

module.exports = initDatabase;
