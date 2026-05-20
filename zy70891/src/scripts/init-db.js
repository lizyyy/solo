const db = require('../config/database');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_hash TEXT UNIQUE NOT NULL,
      submitter TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing',
      total_records INTEGER DEFAULT 0,
      normal_count INTEGER DEFAULT 0,
      pending_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0,
      processed_at DATETIME,
      processed_by TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checkin_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      object_name TEXT NOT NULL,
      checkin_date DATE NOT NULL,
      risk_level TEXT NOT NULL,
      has_checkin BOOLEAN DEFAULT 0,
      checkin_source TEXT,
      has_leave BOOLEAN DEFAULT 0,
      leave_start_date DATE,
      leave_end_date DATE,
      leave_approved BOOLEAN DEFAULT 0,
      location_gap_hours INTEGER DEFAULT 0,
      location_sources TEXT,
      location_abnormal BOOLEAN DEFAULT 0,
      raw_data TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS processing_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      object_id TEXT NOT NULL,
      object_name TEXT NOT NULL,
      checkin_date DATE NOT NULL,
      result_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      follow_up_action TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_by TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (record_id) REFERENCES checkin_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_date DATE NOT NULL,
      batch_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      object_name TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      checkin_status TEXT,
      checkin_sources TEXT,
      leave_status TEXT,
      leave_coverage TEXT,
      location_status TEXT,
      location_gap_hours INTEGER DEFAULT 0,
      location_sources TEXT,
      final_result TEXT NOT NULL,
      final_reason TEXT,
      processed_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(summary_date, object_id, batch_id)
    )
  `);

  console.log('数据库表初始化完成');
});

db.close();
