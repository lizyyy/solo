const db = require('../config/database');

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        daily_capacity INTEGER NOT NULL DEFAULT 50,
        current_usage INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        department_id TEXT NOT NULL,
        is_addable INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        base_price REAL NOT NULL,
        type TEXT NOT NULL DEFAULT 'personal',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS package_items (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (package_id) REFERENCES packages(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        id_card TEXT,
        type TEXT NOT NULL DEFAULT 'personal',
        company_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        package_id TEXT NOT NULL,
        appointment_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (package_id) REFERENCES packages(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS appointment_items (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL DEFAULT 'package',
        price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        report_issued INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (item_id) REFERENCES items(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'receptionist',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        staff_id TEXT,
        staff_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS add_remove_records (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        action TEXT NOT NULL,
        price REAL NOT NULL,
        staff_id TEXT,
        staff_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (item_id) REFERENCES items(id),
        FOREIGN KEY (staff_id) REFERENCES staff(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS daily_department_usage (
        id TEXT PRIMARY KEY,
        department_id TEXT NOT NULL,
        date TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        capacity INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )`);

      console.log('Database initialized successfully');
      resolve();
    });
  });
};

module.exports = {
  initDatabase
};
