const { exec } = require('../config/database');

async function initDatabase() {
  await exec(`
    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_number TEXT NOT NULL UNIQUE,
      recipient_id INTEGER NOT NULL,
      courier_company TEXT,
      weight REAL,
      status TEXT NOT NULL DEFAULT 'in_stock',
      storage_location TEXT,
      in_time DATETIME NOT NULL,
      last_reminder_time DATETIME,
      reminder_count INTEGER DEFAULT 0,
      retention_level TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipient_id) REFERENCES recipients(id)
    );

    CREATE TABLE IF NOT EXISTS reminder_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      reminder_type TEXT NOT NULL,
      reminder_time DATETIME NOT NULL,
      channel TEXT NOT NULL DEFAULT 'sms',
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE TABLE IF NOT EXISTS rejection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      rejected_at DATETIME NOT NULL,
      handler TEXT,
      status TEXT DEFAULT 'pending_return',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE TABLE IF NOT EXISTS return_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      rejection_id INTEGER NOT NULL,
      return_tracking_number TEXT,
      return_courier TEXT,
      return_time DATETIME,
      confirmed_by TEXT,
      confirmed_at DATETIME,
      status TEXT DEFAULT 'pending_confirmation',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (rejection_id) REFERENCES rejection_records(id)
    );

    CREATE TABLE IF NOT EXISTS exception_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_path TEXT NOT NULL,
      request_method TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      processing_conclusion TEXT,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      handled_by TEXT,
      is_resolved BOOLEAN DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
    CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);
    CREATE INDEX IF NOT EXISTS idx_packages_retention ON packages(retention_level);
    CREATE INDEX IF NOT EXISTS idx_reminders_package ON reminder_records(package_id);
    CREATE INDEX IF NOT EXISTS idx_exception_logs_time ON exception_logs(occurred_at);
  `);
}

module.exports = initDatabase;
