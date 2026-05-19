const { exec } = require('../config/database');
const logger = require('../config/logger');

const initDatabase = async () => {
  try {
    await exec(`
      CREATE TABLE IF NOT EXISTS import_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processing',
        error_message TEXT,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        visitor_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        id_card TEXT,
        company TEXT,
        visit_reason TEXT,
        visit_date DATE NOT NULL,
        visit_time_start TEXT,
        visit_time_end TEXT,
        visited_person TEXT,
        license_plate TEXT,
        status TEXT DEFAULT 'pending',
        review_status TEXT DEFAULT 'pending',
        review_by TEXT,
        review_at DATETIME,
        review_remark TEXT,
        is_blacklisted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES import_batches(id)
      );

      CREATE TABLE IF NOT EXISTS temporary_plates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        plate_number TEXT NOT NULL UNIQUE,
        vehicle_type TEXT,
        owner_name TEXT,
        owner_phone TEXT,
        valid_start_date DATE NOT NULL,
        valid_end_date DATE NOT NULL,
        issue_reason TEXT,
        status TEXT DEFAULT 'active',
        review_status TEXT DEFAULT 'pending',
        review_by TEXT,
        review_at DATETIME,
        review_remark TEXT,
        is_blacklisted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES import_batches(id)
      );

      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        type TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        id_card TEXT,
        license_plate TEXT,
        reason TEXT NOT NULL,
        level TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'active',
        added_by TEXT,
        expire_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES import_batches(id)
      );

      CREATE TABLE IF NOT EXISTS verify_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verify_type TEXT NOT NULL,
        target_value TEXT NOT NULL,
        visitor_id INTEGER,
        plate_id INTEGER,
        blacklist_id INTEGER,
        is_allowed INTEGER DEFAULT 0,
        is_in_blacklist INTEGER DEFAULT 0,
        verify_result TEXT,
        verify_by TEXT,
        gate_number TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visitor_id) REFERENCES visitors(id),
        FOREIGN KEY (plate_id) REFERENCES temporary_plates(id),
        FOREIGN KEY (blacklist_id) REFERENCES blacklist(id)
      );

      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id INTEGER,
        operator TEXT,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    logger.info('Database tables initialized successfully');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

module.exports = initDatabase;
