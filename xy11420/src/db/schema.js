const { run } = require('./index');

const TABLES = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('entry', 'reviewer', 'manager', 'readonly')),
      real_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  batches: `
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      vin TEXT NOT NULL,
      plate_number TEXT,
      car_model TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(
        status IN ('draft', 'submitted', 'reviewing', 'approved', 'rejected', 'frozen', 'settled', 'archived', 'cancelled')
      ),
      entry_user_id INTEGER,
      reviewer_id INTEGER,
      manager_id INTEGER,
      current_return_count INTEGER DEFAULT 1,
      total_amount REAL DEFAULT 0,
      freeze_reason TEXT,
      freeze_time DATETIME,
      frozen_status TEXT,
      manual_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_user_id) REFERENCES users(id),
      FOREIGN KEY (reviewer_id) REFERENCES users(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `,
  
  inspection_orders: `
    CREATE TABLE IF NOT EXISTS inspection_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      order_no TEXT NOT NULL,
      inspection_date DATE,
      inspector TEXT,
      mileage REAL,
      fuel_level TEXT,
      items_json TEXT,
      raw_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      UNIQUE(batch_id, order_no)
    )
  `,
  
  repair_quotes: `
    CREATE TABLE IF NOT EXISTS repair_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      quote_no TEXT NOT NULL,
      quote_date DATE,
      repair_shop TEXT,
      total_amount REAL DEFAULT 0,
      items_json TEXT,
      raw_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      UNIQUE(batch_id, quote_no)
    )
  `,
  
  photo_lists: `
    CREATE TABLE IF NOT EXISTS photo_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      photo_no TEXT NOT NULL,
      category TEXT,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      description TEXT,
      upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      UNIQUE(batch_id, photo_no)
    )
  `,
  
  scan_details: `
    CREATE TABLE IF NOT EXISTS scan_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      scan_no TEXT NOT NULL,
      scan_time DATETIME,
      scan_location TEXT,
      operator TEXT,
      items_json TEXT,
      raw_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      UNIQUE(batch_id, scan_no)
    )
  `,
  
  status_history: `
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator_id INTEGER,
      reason TEXT,
      change_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    )
  `,
  
  dirty_records: `
    CREATE TABLE IF NOT EXISTS dirty_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      source_type TEXT NOT NULL CHECK(
        source_type IN ('inspection', 'repair_quote', 'photo', 'scan')
      ),
      error_type TEXT NOT NULL CHECK(
        error_type IN ('missing_field', 'cross_day', 'name_mismatch', 'amount_conflict', 'quantity_conflict', 'duplicate')
      ),
      field_name TEXT,
      expected_value TEXT,
      actual_value TEXT,
      raw_content TEXT,
      handler_id INTEGER,
      handling_opinion TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'resolved', 'ignored')),
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
      FOREIGN KEY (handler_id) REFERENCES users(id)
    )
  `,
  
  operation_logs: `
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `,
  
  return_records: `
    CREATE TABLE IF NOT EXISTS return_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      vin TEXT NOT NULL,
      return_number INTEGER NOT NULL,
      return_reason TEXT,
      return_date DATE,
      responsible_person TEXT,
      additional_cost REAL DEFAULT 0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    )
  `
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_batches_vin ON batches(vin)',
  'CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status)',
  'CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_status_history_batch_id ON status_history(batch_id)',
  'CREATE INDEX IF NOT EXISTS idx_dirty_records_batch_id ON dirty_records(batch_id)',
  'CREATE INDEX IF NOT EXISTS idx_dirty_records_status ON dirty_records(status)',
  'CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON operation_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_return_records_vin ON return_records(vin)'
];

function initSchema() {
  console.log('开始初始化数据库Schema...');
  
  for (const [tableName, sql] of Object.entries(TABLES)) {
    try {
      run(sql);
      console.log(`表 ${tableName} 初始化完成`);
    } catch (err) {
      console.error(`表 ${tableName} 初始化失败:`, err.message);
      throw err;
    }
  }
  
  for (const indexSql of INDEXES) {
    try {
      run(indexSql);
    } catch (err) {
      console.error('索引创建失败:', err.message);
    }
  }
  
  console.log('数据库Schema初始化完成');
}

module.exports = {
  initSchema,
  TABLES
};
