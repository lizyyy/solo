const db = require('../config/database');

const initDB = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        device_number TEXT UNIQUE NOT NULL,
        language_pack TEXT NOT NULL,
        status TEXT DEFAULT 'available',
        battery_level INTEGER DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS rental_orders (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        deposit_amount REAL NOT NULL,
        rental_time DATETIME NOT NULL,
        return_time DATETIME,
        status TEXT DEFAULT 'active',
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS flow_records (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_number TEXT NOT NULL,
        order_id TEXT,
        flow_type TEXT NOT NULL,
        before_data TEXT,
        after_data TEXT,
        operator TEXT NOT NULL,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS repair_records (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_number TEXT NOT NULL,
        issue_description TEXT NOT NULL,
        repair_status TEXT DEFAULT 'pending',
        responsible_person TEXT,
        repair_time DATETIME,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exceptions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_number TEXT NOT NULL,
        order_id TEXT,
        exception_type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        responsible_person TEXT,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据库初始化完成');
  });
};

initDB();
