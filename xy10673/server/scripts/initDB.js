const db = require('../config/database');

const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS newspapers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      price_per_issue REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_id INTEGER NOT NULL,
      newspaper_id INTEGER NOT NULL,
      total_issues INTEGER NOT NULL,
      remaining_issues INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id),
      FOREIGN KEY (newspaper_id) REFERENCES newspapers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      delivery_date DATE NOT NULL,
      issue_number INTEGER,
      status TEXT DEFAULT 'scheduled',
      delivered_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS pause_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      request_date DATE NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      old_start_date DATE,
      old_end_date DATE,
      old_reason TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS re_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      request_date DATE NOT NULL,
      reason TEXT,
      new_delivery_date DATE,
      status TEXT DEFAULT 'pending',
      handled_by TEXT,
      handled_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES delivery_calendar(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS manual_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      adjustment_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      adjusted_by TEXT NOT NULL,
      adjusted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      related_id INTEGER,
      description TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT,
      handled_by TEXT,
      handled_at DATETIME,
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据库表初始化完成');
  });
};

initDatabase();
