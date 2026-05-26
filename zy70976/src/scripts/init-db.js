const db = require('../config/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rental_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id VARCHAR(50) NOT NULL,
      device_serial VARCHAR(100) NOT NULL,
      device_name VARCHAR(200),
      customer_name VARCHAR(200),
      customer_phone VARCHAR(50),
      rental_start_date DATE,
      rental_end_date DATE,
      actual_return_date DATE,
      daily_rate DECIMAL(10,2),
      deposit_amount DECIMAL(10,2),
      deposit_flow_id VARCHAR(100),
      total_rental_fee DECIMAL(10,2),
      actual_payment DECIMAL(10,2),
      status VARCHAR(50) DEFAULT 'pending',
      overdue_days INTEGER DEFAULT 0,
      overdue_fee DECIMAL(10,2) DEFAULT 0,
      repair_fee DECIMAL(10,2) DEFAULT 0,
      has_repair INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS repair_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER,
      device_serial VARCHAR(100) NOT NULL,
      repair_type VARCHAR(100),
      repair_description TEXT,
      repair_cost DECIMAL(10,2),
      is_customer_fault INTEGER DEFAULT 0,
      fault_reason TEXT,
      report_date DATE,
      repair_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rental_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS deposit_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_type VARCHAR(100) NOT NULL,
      device_model VARCHAR(100),
      deposit_amount DECIMAL(10,2) NOT NULL,
      overdue_rate DECIMAL(5,2) DEFAULT 0.1,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER,
      batch_id VARCHAR(50),
      operation_type VARCHAR(50) NOT NULL,
      operator VARCHAR(100) NOT NULL,
      reason TEXT,
      old_status VARCHAR(50),
      new_status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rental_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id VARCHAR(50) UNIQUE NOT NULL,
      batch_name VARCHAR(200),
      total_count INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'processing',
      operator VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rental_id INTEGER NOT NULL,
      exception_type VARCHAR(50) NOT NULL,
      description TEXT,
      amount DECIMAL(10,2),
      is_resolved INTEGER DEFAULT 0,
      resolved_by VARCHAR(100),
      resolved_at TIMESTAMP,
      resolution_note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rental_records(id)
    )
  `);

  console.log('数据库表初始化完成');
});

db.close();
