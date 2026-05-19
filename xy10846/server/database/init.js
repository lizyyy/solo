const { run } = require('./connection');

async function initDatabase() {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        file_type TEXT DEFAULT 'markdown',
        status TEXT DEFAULT 'pending',
        responsibility_node TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ documents 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS slice_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        max_chunk_length INTEGER DEFAULT 500,
        min_chunk_length INTEGER DEFAULT 100,
        overlap_size INTEGER DEFAULT 50,
        heading_hierarchy_level INTEGER DEFAULT 3,
        inherit_headers INTEGER DEFAULT 1,
        preserve_tables INTEGER DEFAULT 1,
        effect_remark TEXT,
        version TEXT DEFAULT 'v1.0.0',
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ slice_rules 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS heading_hierarchies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        rule_id INTEGER,
        level INTEGER,
        text TEXT,
        position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ heading_hierarchies 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS table_fragments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        rule_id INTEGER,
        original_table TEXT,
        fragment_content TEXT,
        row_count INTEGER,
        col_count INTEGER,
        handling_method TEXT DEFAULT 'preserved',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ table_fragments 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS slice_previews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        rule_id INTEGER,
        chunk_index INTEGER,
        content TEXT,
        heading_path TEXT,
        chunk_length INTEGER,
        has_table INTEGER DEFAULT 0,
        quality_score REAL,
        status TEXT DEFAULT 'generated',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ slice_previews 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS published_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER,
        version_tag TEXT UNIQUE,
        description TEXT,
        config_snapshot TEXT,
        is_active INTEGER DEFAULT 1,
        published_by TEXT,
        rollback_from_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ published_versions 表就绪');

    await run(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        method TEXT,
        request_input TEXT,
        response_result TEXT,
        responsibility_node TEXT,
        status_code INTEGER,
        duration_ms INTEGER,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ request_logs 表就绪');

    console.log('\n🎉 数据库初始化完成!');
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err);
    throw err;
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = initDatabase;
