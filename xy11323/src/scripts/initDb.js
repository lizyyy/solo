const db = require('../config/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      import_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_records INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      row_number INTEGER,
      order_no TEXT,
      machine_no TEXT,
      operator_name TEXT,
      work_date DATE,
      work_type TEXT,
      hours REAL,
      acres REAL,
      fuel_cost REAL,
      total_amount REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fuel_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      row_number INTEGER,
      record_no TEXT,
      machine_no TEXT,
      fuel_date DATE,
      fuel_type TEXT,
      liters REAL,
      price_per_liter REAL,
      total_cost REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rate_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      row_number INTEGER,
      work_type TEXT,
      rate_per_hour REAL,
      rate_per_acre REAL,
      fuel_surcharge_rate REAL,
      effective_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS error_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      file_type TEXT,
      row_number INTEGER,
      original_data TEXT,
      error_type TEXT,
      error_message TEXT,
      suggestion TEXT,
      corrected_data TEXT,
      is_fixed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT,
      batch_id INTEGER,
      record_id INTEGER,
      record_type TEXT,
      old_data TEXT,
      new_data TEXT,
      operator TEXT,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表初始化完成');
});