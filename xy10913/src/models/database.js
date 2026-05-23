const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'rental.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('已创建 data 目录');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库:', DB_PATH);
    initTables();
  }
});

function initTables() {
  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      daily_rate REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      rental_no TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      actual_end_date DATETIME,
      total_deposit REAL NOT NULL,
      remaining_deposit REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    );

    CREATE TABLE IF NOT EXISTS deposit_transactions (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'CNY',
      status TEXT DEFAULT 'completed',
      request_id TEXT UNIQUE,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS damages (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      damage_type TEXT NOT NULL,
      description TEXT,
      deduction_amount REAL NOT NULL,
      reported_by TEXT,
      status TEXT DEFAULT 'pending',
      verified_by TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS renewals (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      request_id TEXT UNIQUE NOT NULL,
      original_end_date DATETIME NOT NULL,
      new_end_date DATETIME NOT NULL,
      extension_days INTEGER NOT NULL,
      extension_fee REAL NOT NULL,
      status TEXT DEFAULT 'approved',
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      rental_id TEXT UNIQUE NOT NULL,
      settlement_no TEXT UNIQUE NOT NULL,
      total_deposit REAL NOT NULL,
      damage_deduction REAL DEFAULT 0,
      overdue_fee REAL DEFAULT 0,
      renewal_fee REAL DEFAULT 0,
      refund_amount REAL NOT NULL,
      status TEXT DEFAULT 'completed',
      generated_by TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      api_path TEXT NOT NULL,
      request_method TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      error_message TEXT NOT NULL,
      processing_result TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rentals_status ON rentals(status);
    CREATE INDEX IF NOT EXISTS idx_deposit_transactions_rental ON deposit_transactions(rental_id);
    CREATE INDEX IF NOT EXISTS idx_damages_rental ON damages(rental_id);
    CREATE INDEX IF NOT EXISTS idx_renewals_rental ON renewals(rental_id);
  `;

  db.exec(createTablesSql, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
    } else {
      console.log('数据库表初始化完成');
    }
  });
}

module.exports = db;
