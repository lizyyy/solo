const db = require('./database');

function initDatabase() {
  db.exec(`
    -- 客户表
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      region TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 订单表
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      product_name TEXT NOT NULL,
      category TEXT,
      purchase_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    -- 分类标签表（taxonomy）
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      parent_code TEXT,
      keywords TEXT,
      description TEXT,
      is_manual INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 通话记录表
    CREATE TABLE IF NOT EXISTS call_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      order_id TEXT,
      call_time DATETIME,
      agent_name TEXT,
      category TEXT,
      product_category TEXT,
      region TEXT,
      raw_text TEXT NOT NULL,
      cleaned_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 归因结果表
    CREATE TABLE IF NOT EXISTS attributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL,
      category_code TEXT NOT NULL,
      confidence REAL DEFAULT 0,
      keywords TEXT,
      evidence TEXT,
      is_manual INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (call_id) REFERENCES call_notes(call_id)
    );

    -- 承诺事项表
    CREATE TABLE IF NOT EXISTS commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT NOT NULL,
      content TEXT NOT NULL,
      deadline DATE,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      follow_up_note TEXT,
      followed_up_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (call_id) REFERENCES call_notes(call_id)
    );

    -- 跟进任务表
    CREATE TABLE IF NOT EXISTS follow_up_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commitment_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      due_date DATE,
      status TEXT DEFAULT 'pending',
      risk_level TEXT DEFAULT 'medium',
      assigned_to TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (commitment_id) REFERENCES commitments(id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_call_notes_customer ON call_notes(customer_id);
    CREATE INDEX IF NOT EXISTS idx_call_notes_order ON call_notes(order_id);
    CREATE INDEX IF NOT EXISTS idx_call_notes_time ON call_notes(call_time);
    CREATE INDEX IF NOT EXISTS idx_attributions_call ON attributions(call_id);
    CREATE INDEX IF NOT EXISTS idx_commitments_call ON commitments(call_id);
    CREATE INDEX IF NOT EXISTS idx_commitments_deadline ON commitments(deadline);
  `);

  console.log('数据库初始化完成');
}

module.exports = initDatabase;
