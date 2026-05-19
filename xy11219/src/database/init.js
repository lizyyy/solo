const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/storeqc.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('SQLite 数据库连接成功');
  }
});

module.exports = db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        permissions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        real_name TEXT NOT NULL,
        role_id INTEGER NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sample_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dish_name TEXT NOT NULL,
        dish_code TEXT,
        sample_time DATETIME NOT NULL,
        sample_quantity TEXT NOT NULL,
        refrigerator_id INTEGER NOT NULL,
        operator_id INTEGER NOT NULL,
        storage_location TEXT NOT NULL,
        expiry_time DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        reviewer_id INTEGER,
        review_time DATETIME,
        review_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES users(id),
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS temperature_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        refrigerator_id TEXT NOT NULL,
        refrigerator_name TEXT NOT NULL,
        temperature REAL NOT NULL,
        measure_time DATETIME NOT NULL,
        operator_id INTEGER NOT NULL,
        status TEXT DEFAULT 'normal',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS waste_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        quantity TEXT NOT NULL,
        waste_reason TEXT NOT NULL,
        waste_time DATETIME NOT NULL,
        operator_id INTEGER NOT NULL,
        reviewer_id INTEGER,
        review_time DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES users(id),
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      resolve();
    });
  });
}

module.exports = { db, initializeDatabase };
