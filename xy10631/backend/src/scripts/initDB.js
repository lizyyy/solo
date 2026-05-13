const db = require('../database/db');

const createTables = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS sku (
      id TEXT PRIMARY KEY,
      sku_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      unit_price REAL,
      safety_stock INTEGER,
      current_stock INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT,
      created_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS shift_usage (
      id TEXT PRIMARY KEY,
      sku_id TEXT NOT NULL,
      sku_code TEXT,
      shift_date TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      area_id TEXT,
      area_name TEXT,
      quantity INTEGER NOT NULL,
      user_id TEXT,
      user_name TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (sku_id) REFERENCES sku(id)
    )`,
    `CREATE TABLE IF NOT EXISTS area (
      id TEXT PRIMARY KEY,
      area_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      building TEXT,
      floor TEXT,
      area_size REAL,
      manager_id TEXT,
      manager_name TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS return_inspection (
      id TEXT PRIMARY KEY,
      usage_id TEXT NOT NULL,
      sku_id TEXT,
      return_quantity INTEGER NOT NULL,
      inspector_id TEXT,
      inspector_name TEXT,
      inspection_date TEXT,
      inspection_result TEXT,
      rejection_reason TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (usage_id) REFERENCES shift_usage(id)
    )`,
    `CREATE TABLE IF NOT EXISTS replenishment_alert (
      id TEXT PRIMARY KEY,
      sku_id TEXT NOT NULL,
      sku_code TEXT,
      alert_date TEXT,
      current_stock INTEGER,
      threshold INTEGER,
      alert_level TEXT,
      handler_id TEXT,
      handler_name TEXT,
      handle_date TEXT,
      handle_result TEXT,
      replenishment_quantity INTEGER,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (sku_id) REFERENCES sku(id)
    )`,
    `CREATE TABLE IF NOT EXISTS cost_variance (
      id TEXT PRIMARY KEY,
      sku_id TEXT NOT NULL,
      sku_code TEXT,
      period TEXT,
      expected_cost REAL,
      actual_cost REAL,
      variance REAL,
      variance_rate REAL,
      analysis TEXT,
      reviewer_id TEXT,
      reviewer_name TEXT,
      review_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (sku_id) REFERENCES sku(id)
    )`,
    `CREATE TABLE IF NOT EXISTS operation_log (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL,
      business_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT,
      operator_name TEXT,
      operation_time TEXT,
      notes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS callback_record (
      id TEXT PRIMARY KEY,
      callback_id TEXT UNIQUE NOT NULL,
      business_type TEXT NOT NULL,
      business_id TEXT NOT NULL,
      processed_at TEXT,
      status TEXT
    )`
  ];

  tables.forEach((sql, index) => {
    db.run(sql, (err) => {
      if (err) {
        console.error(`创建表 ${index + 1} 失败:`, err.message);
      } else {
        console.log(`表 ${index + 1} 创建成功`);
      }
    });
  });
};

createTables();

setTimeout(() => {
  db.close();
  console.log('数据库初始化完成');
}, 2000);