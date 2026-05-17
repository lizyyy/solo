const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS config_items (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        config_key TEXT NOT NULL,
        config_value TEXT NOT NULL,
        config_type TEXT DEFAULT 'string',
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, config_key),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS source_materials (
        id TEXT PRIMARY KEY,
        config_item_id TEXT NOT NULL,
        material_type TEXT NOT NULL,
        material_content TEXT NOT NULL,
        material_url TEXT,
        uploaded_by TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_item_id) REFERENCES config_items(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS confirmations (
        id TEXT PRIMARY KEY,
        config_item_id TEXT NOT NULL,
        confirmer_id TEXT NOT NULL,
        confirmer_name TEXT NOT NULL,
        confirmation_status TEXT DEFAULT 'pending',
        confirmed_at DATETIME,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_item_id) REFERENCES config_items(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS change_records (
        id TEXT PRIMARY KEY,
        config_item_id TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        change_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (config_item_id) REFERENCES config_items(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS handover_summaries (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        summary_content TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        version INTEGER DEFAULT 1,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exceptions (
        id TEXT PRIMARY KEY,
        config_item_id TEXT,
        exception_type TEXT NOT NULL,
        original_input TEXT NOT NULL,
        processing_basis TEXT,
        error_message TEXT,
        handled BOOLEAN DEFAULT 0,
        handled_by TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据表初始化完成');
  });
}

module.exports = db;
