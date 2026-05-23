const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const reportsDir = path.join(dataDir, 'reports');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('创建数据目录:', dataDir);
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  console.log('创建报告目录:', reportsDir);
}

const db = require('../src/database/db');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY,
      employee_id TEXT UNIQUE,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      phone TEXT,
      department TEXT,
      position TEXT,
      status TEXT DEFAULT 'active',
      photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS training_status (
      id TEXT PRIMARY KEY,
      personnel_id TEXT NOT NULL,
      training_type TEXT NOT NULL,
      training_date DATETIME,
      expiry_date DATETIME,
      status TEXT DEFAULT 'pending',
      score REAL,
      certificate_no TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blacklist (
      id TEXT PRIMARY KEY,
      personnel_id TEXT,
      id_card TEXT,
      name TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      added_by TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      remarks TEXT
    );

    CREATE TABLE IF NOT EXISTS visitor_applications (
      id TEXT PRIMARY KEY,
      visitor_name TEXT NOT NULL,
      visitor_id_card TEXT,
      visitor_phone TEXT,
      visitor_company TEXT,
      visit_purpose TEXT,
      host_personnel_id TEXT,
      host_name TEXT,
      scheduled_start DATETIME NOT NULL,
      scheduled_end DATETIME NOT NULL,
      actual_start DATETIME,
      actual_end DATETIME,
      access_zones TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_personnel_id) REFERENCES personnel(id)
    );

    CREATE TABLE IF NOT EXISTS gate_events (
      id TEXT PRIMARY KEY,
      event_no TEXT UNIQUE,
      personnel_id TEXT,
      visitor_application_id TEXT,
      person_type TEXT NOT NULL,
      name TEXT,
      id_card TEXT,
      gate_no TEXT NOT NULL,
      direction TEXT NOT NULL,
      event_time DATETIME NOT NULL,
      access_result TEXT NOT NULL,
      access_reason TEXT,
      photo_captured TEXT,
      temperature REAL,
      mask_detected INTEGER,
      dedup_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS access_reports (
      id TEXT PRIMARY KEY,
      report_no TEXT UNIQUE,
      report_type TEXT NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      generated_by TEXT,
      status TEXT DEFAULT 'generating',
      file_path TEXT,
      total_records INTEGER DEFAULT 0,
      summary_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE,
      api_endpoint TEXT,
      raw_input TEXT NOT NULL,
      error_type TEXT,
      error_message TEXT,
      processing_result TEXT NOT NULL,
      resolution_status TEXT DEFAULT 'pending',
      resolved_by TEXT,
      resolved_at DATETIME,
      resolution_notes TEXT,
      related_gate_event_id TEXT,
      related_personnel_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      correction_type TEXT NOT NULL,
      target_record_id TEXT NOT NULL,
      target_table TEXT NOT NULL,
      original_value TEXT,
      corrected_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      corrected_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_id_card ON personnel(id_card);
    CREATE INDEX IF NOT EXISTS idx_personnel_status ON personnel(status);
    CREATE INDEX IF NOT EXISTS idx_training_personnel ON training_status(personnel_id);
    CREATE INDEX IF NOT EXISTS idx_training_expiry ON training_status(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_blacklist_id_card ON blacklist(id_card);
    CREATE INDEX IF NOT EXISTS idx_blacklist_status ON blacklist(status);
    CREATE INDEX IF NOT EXISTS idx_visitor_scheduled ON visitor_applications(scheduled_start, scheduled_end);
    CREATE INDEX IF NOT EXISTS idx_visitor_status ON visitor_applications(status);
    CREATE INDEX IF NOT EXISTS idx_gate_event_time ON gate_events(event_time);
    CREATE INDEX IF NOT EXISTS idx_gate_dedup ON gate_events(dedup_hash);
    CREATE INDEX IF NOT EXISTS idx_exception_transaction ON exception_logs(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_exception_status ON exception_logs(resolution_status);
  `);

  console.log('数据库表初始化完成');
};

initTables();
db.close();
