const db = require('./db');

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      contract_no TEXT UNIQUE NOT NULL,
      room_no TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      monthly_rent REAL,
      area REAL,
      share_ratio REAL DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      reading_date DATE NOT NULL,
      water_prev REAL DEFAULT 0,
      water_curr REAL DEFAULT 0,
      water_usage REAL DEFAULT 0,
      electric_prev REAL DEFAULT 0,
      electric_curr REAL DEFAULT 0,
      electric_usage REAL DEFAULT 0,
      reader TEXT,
      remarks TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS special_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      power REAL,
      hours_per_day REAL,
      days_per_month INTEGER,
      fixed_usage REAL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      bill_month TEXT NOT NULL,
      water_usage REAL DEFAULT 0,
      water_amount REAL DEFAULT 0,
      electric_usage REAL DEFAULT 0,
      electric_amount REAL DEFAULT 0,
      device_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      unpaid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      has_exception BOOLEAN DEFAULT 0,
      exception_type TEXT,
      exception_desc TEXT,
      handled_by TEXT,
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      adjust_type TEXT NOT NULL,
      adjust_amount REAL NOT NULL,
      adjust_reason TEXT NOT NULL,
      adjusted_by TEXT NOT NULL,
      old_value REAL,
      new_value REAL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS price_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`INSERT OR IGNORE INTO price_settings (type, price) VALUES 
      ('water', 5.0),
      ('electric', 1.2)`);

    console.log('数据库初始化完成');
  });
};

initDatabase();
