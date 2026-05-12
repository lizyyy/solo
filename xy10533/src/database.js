const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'traceability.db');

let db = null;

const initDatabaseConnection = () => {
  // 确保 data 目录存在
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接错误:', err.message);
        reject(err);
      } else {
        console.log('已连接到 SQLite 数据库');
        db = database;
        resolve(database);
      }
    });
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase()');
  }
  return db;
};

const runSql = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const initializeDatabase = async () => {
  await initDatabaseConnection();
  
  await runSql(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      product_code TEXT NOT NULL,
      production_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL DEFAULT '箱',
      status TEXT NOT NULL DEFAULT 'CREATED',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      store_name TEXT NOT NULL,
      store_code TEXT NOT NULL,
      city TEXT,
      address TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS outbound_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      outbound_time TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS cold_chain_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      outbound_record_id TEXT NOT NULL,
      transport_start_time TEXT NOT NULL,
      transport_end_time TEXT,
      temperature_log TEXT,
      avg_temperature REAL,
      min_temperature REAL,
      max_temperature REAL,
      status TEXT NOT NULL DEFAULT 'IN_TRANSIT',
      is_abnormal INTEGER DEFAULT 0,
      abnormal_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (outbound_record_id) REFERENCES outbound_records(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS receive_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      cold_chain_record_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      receive_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (cold_chain_record_id) REFERENCES cold_chain_records(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS store_inventory (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      frozen_quantity INTEGER NOT NULL DEFAULT 0,
      thawed_quantity INTEGER NOT NULL DEFAULT 0,
      sold_quantity INTEGER NOT NULL DEFAULT 0,
      recalled_quantity INTEGER NOT NULL DEFAULT 0,
      damaged_quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS thaw_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      thaw_start_time TEXT NOT NULL,
      thaw_end_time TEXT,
      expected_thaw_time TEXT,
      is_overtime INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'THAWING',
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS sales_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      sale_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS recall_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      recall_reason TEXT NOT NULL,
      recall_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS damage_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      damage_reason TEXT NOT NULL,
      damage_time TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      before_data TEXT,
      after_data TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await runSql(`
    CREATE TABLE IF NOT EXISTS idempotency_records (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      key TEXT NOT NULL,
      result TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(operation_type, key)
    )
  `);
};

module.exports = {
  getDb,
  initializeDatabase
};
