const db = require('./database');

const initDatabase = () => {
  db.exec(`
    -- 仓库服务表
    CREATE TABLE IF NOT EXISTS warehouse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL,
      location TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sku, location)
    );

    CREATE TABLE IF NOT EXISTS warehouse_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      sku TEXT NOT NULL,
      from_location TEXT,
      to_location TEXT,
      quantity INTEGER NOT NULL,
      operation_type TEXT NOT NULL, -- PREPARE, CONFIRM, CANCEL
      status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 账务服务表
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL DEFAULT 0,
      frozen_balance REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS account_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      account_id TEXT NOT NULL,
      amount REAL NOT NULL,
      operation_type TEXT NOT NULL, -- PREPARE, CONFIRM, CANCEL
      status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 物流服务表
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      shipment_no TEXT NOT NULL UNIQUE,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      items TEXT NOT NULL, -- JSON 存储
      status TEXT NOT NULL, -- PENDING, PREPARED, CONFIRMED, CANCELLED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS logistics_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT,
      shipment_no TEXT NOT NULL,
      operation_type TEXT NOT NULL, -- PREPARE, CONFIRM, CANCEL
      status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 分布式事务表
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      business_type TEXT NOT NULL, -- TRANSFER
      status TEXT NOT NULL, -- INIT, PREPARING, PREPARED, CONFIRMING, CONFIRMED, CANCELLING, CANCELLED, FAILED
      payload TEXT NOT NULL, -- JSON 存储请求数据
      idempotency_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 事务时间线
    CREATE TABLE IF NOT EXISTS transaction_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      step TEXT NOT NULL, -- WAREHOUSE_PREPARE, ACCOUNT_PREPARE, LOGISTICS_PREPARE, etc.
      status TEXT NOT NULL, -- START, SUCCESS, FAILED, RETRY
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );

    -- 幂等键表
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 失败注入配置
    CREATE TABLE IF NOT EXISTS failure_injections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step TEXT NOT NULL, -- WAREHOUSE_PREPARE, ACCOUNT_CONFIRM, etc.
      failure_type TEXT NOT NULL, -- ERROR, TIMEOUT
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 重试记录
    CREATE TABLE IF NOT EXISTS retry_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      step TEXT NOT NULL,
      attempt_count INTEGER DEFAULT 1,
      status TEXT NOT NULL, -- PENDING, SUCCESS, FAILED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    );
  `);

  console.log('数据库初始化完成');
};

const seedTestData = () => {
  const count = db.prepare('SELECT COUNT(*) as count FROM warehouse').get();
  if (count.count === 0) {
    const insertWarehouse = db.prepare(`
      INSERT INTO warehouse (sku, location, quantity) VALUES (?, ?, ?)
    `);

    insertWarehouse.run('SKU001', 'WH_A', 1000);
    insertWarehouse.run('SKU001', 'WH_B', 500);
    insertWarehouse.run('SKU002', 'WH_A', 200);

    const insertAccount = db.prepare(`
      INSERT INTO accounts (account_id, balance, frozen_balance) VALUES (?, ?, ?)
    `);

    insertAccount.run('ACC_001', 50000, 0);
    insertAccount.run('ACC_002', 30000, 0);

    console.log('测试数据初始化完成');
  }
};

module.exports = { initDatabase, seedTestData };
