import { run } from './db';

export const initDatabase = async () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS price_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      price REAL NOT NULL,
      effective_date DATETIME NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      UNIQUE(category_id, version)
    )`,
    `CREATE TABLE IF NOT EXISTS deduction_ratios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      ratio REAL NOT NULL,
      effective_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )`,
    `CREATE TABLE IF NOT EXISTS weighing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      gross_weight REAL NOT NULL,
      tare_weight REAL NOT NULL,
      net_weight REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      price_version_id INTEGER,
      deduction_ratio REAL,
      operator TEXT,
      weigh_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_time DATETIME,
      settled_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (price_version_id) REFERENCES price_versions(id)
    )`,
    `CREATE TABLE IF NOT EXISTS weight_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weighing_record_id INTEGER NOT NULL,
      gross_weight REAL NOT NULL,
      tare_weight REAL NOT NULL,
      verifier TEXT NOT NULL,
      verification_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      FOREIGN KEY (weighing_record_id) REFERENCES weighing_records(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settlement_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      generated_by TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settlement_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      weighing_record_id INTEGER NOT NULL,
      net_weight REAL NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (report_id) REFERENCES settlement_reports(id),
      FOREIGN KEY (weighing_record_id) REFERENCES weighing_records(id),
      UNIQUE(report_id, weighing_record_id)
    )`,
    `CREATE TABLE IF NOT EXISTS exception_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT,
      type TEXT NOT NULL,
      original_input TEXT NOT NULL,
      error_message TEXT,
      handled BOOLEAN DEFAULT 0,
      handled_by TEXT,
      handled_at DATETIME,
      conclusion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS manual_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weighing_record_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (weighing_record_id) REFERENCES weighing_records(id)
    )`
  ];

  for (const sql of tables) {
    await run(sql);
  }

  console.log('数据库表初始化完成');
};
