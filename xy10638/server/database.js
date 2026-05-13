const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_no TEXT UNIQUE NOT NULL,
        building_no TEXT NOT NULL,
        unit_no TEXT NOT NULL,
        room_no TEXT NOT NULL,
        area REAL NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_no TEXT UNIQUE NOT NULL,
        property_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        id_card TEXT NOT NULL,
        intended_price REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        applicant TEXT NOT NULL,
        apply_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewer TEXT,
        review_time DATETIME,
        review_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deposit_no TEXT UNIQUE NOT NULL,
        subscription_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_no TEXT,
        status TEXT DEFAULT 'pending',
        operator TEXT NOT NULL,
        payment_time DATETIME,
        reviewer TEXT,
        review_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS room_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        change_no TEXT UNIQUE NOT NULL,
        subscription_id INTEGER NOT NULL,
        old_property_id INTEGER NOT NULL,
        new_property_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        price_diff REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        applicant TEXT NOT NULL,
        apply_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewer TEXT,
        review_time DATETIME,
        review_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
        FOREIGN KEY (old_property_id) REFERENCES properties(id),
        FOREIGN KEY (new_property_id) REFERENCES properties(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        refund_no TEXT UNIQUE NOT NULL,
        subscription_id INTEGER NOT NULL,
        deposit_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        applicant TEXT NOT NULL,
        apply_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewer TEXT,
        review_time DATETIME,
        review_comment TEXT,
        refund_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
        FOREIGN KEY (deposit_id) REFERENCES deposits(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deal_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        deal_time DATETIME,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        operator TEXT NOT NULL,
        operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        old_value TEXT,
        new_value TEXT,
        ip TEXT,
        remark TEXT
      )`);

      resolve();
    });
  });
}

module.exports = { db, initDatabase };
