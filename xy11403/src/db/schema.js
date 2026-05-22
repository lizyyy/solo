const createTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      driver_name TEXT,
      driver_phone TEXT,
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      submit_by TEXT DEFAULT 'system',
      status TEXT DEFAULT 'pending',
      frozen INTEGER DEFAULT 0,
      frozen_at DATETIME,
      frozen_by TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS boxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      box_no TEXT NOT NULL,
      original_box_no TEXT,
      wms_expected_qty INTEGER DEFAULT 0,
      actual_qty INTEGER DEFAULT 0,
      receive_time DATETIME,
      receive_date TEXT,
      status TEXT DEFAULT 'normal',
      is_renamed INTEGER DEFAULT 0,
      is_cross_day INTEGER DEFAULT 0,
      compensation_amount DECIMAL(10,2) DEFAULT 0,
      temperature_abnormal INTEGER DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS temperature_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      box_no TEXT,
      record_time DATETIME NOT NULL,
      temperature DECIMAL(5,2) NOT NULL,
      humidity DECIMAL(5,2),
      is_abnormal INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      photo_type TEXT,
      file_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS reconciliation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER UNIQUE,
      total_boxes INTEGER DEFAULT 0,
      normal_boxes INTEGER DEFAULT 0,
      renamed_boxes INTEGER DEFAULT 0,
      cross_day_boxes INTEGER DEFAULT 0,
      temperature_abnormal_boxes INTEGER DEFAULT 0,
      total_compensation DECIMAL(10,2) DEFAULT 0,
      status TEXT DEFAULT 'calculated',
      calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      box_id INTEGER,
      operation_type TEXT NOT NULL,
      operation_subtype TEXT,
      operator TEXT DEFAULT 'system',
      before_data TEXT,
      after_data TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manual_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      box_id INTEGER,
      adjust_type TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_batches_batch_no ON batches(batch_no);
    CREATE INDEX IF NOT EXISTS idx_boxes_batch_id ON boxes(batch_id);
    CREATE INDEX IF NOT EXISTS idx_boxes_box_no ON boxes(box_no);
    CREATE INDEX IF NOT EXISTS idx_temperature_batch_id ON temperature_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_operation_history_batch_id ON operation_history(batch_id);
    CREATE INDEX IF NOT EXISTS idx_manual_adjustments_batch_id ON manual_adjustments(batch_id);
  `);
};

module.exports = { createTables };
