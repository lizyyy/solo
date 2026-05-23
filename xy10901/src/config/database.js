const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sample_barcodes (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE NOT NULL,
      sample_type TEXT NOT NULL,
      patient_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sampling_records (
      id TEXT PRIMARY KEY,
      barcode_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      sampling_time DATETIME NOT NULL,
      sampler TEXT NOT NULL,
      clinic_name TEXT NOT NULL,
      patient_name TEXT,
      patient_id TEXT,
      sample_type TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (barcode_id) REFERENCES sample_barcodes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transport_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      transporter TEXT NOT NULL,
      departure_time DATETIME NOT NULL,
      expected_arrival_time DATETIME,
      actual_arrival_time DATETIME,
      origin_clinic TEXT NOT NULL,
      destination_lab TEXT NOT NULL,
      sample_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'in_transit',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS batch_samples (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      sampling_record_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES transport_batches(id),
      FOREIGN KEY (sampling_record_id) REFERENCES sampling_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS receiving_windows (
      id TEXT PRIMARY KEY,
      lab_name TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      days_of_week TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rejection_reasons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      is_active BOOLEAN DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transfer_records (
      id TEXT PRIMARY KEY,
      sampling_record_id TEXT NOT NULL,
      batch_id TEXT,
      barcode TEXT NOT NULL,
      received_time DATETIME,
      receiver TEXT,
      status TEXT DEFAULT 'pending',
      rejection_reason_id TEXT,
      rejection_note TEXT,
      is_amended BOOLEAN DEFAULT 0,
      amendment_request_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sampling_record_id) REFERENCES sampling_records(id),
      FOREIGN KEY (batch_id) REFERENCES transport_batches(id),
      FOREIGN KEY (rejection_reason_id) REFERENCES rejection_reasons(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS amendment_requests (
      id TEXT PRIMARY KEY,
      transfer_record_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      original_data TEXT NOT NULL,
      requested_changes TEXT NOT NULL,
      reason TEXT NOT NULL,
      approver TEXT,
      approved_at DATETIME,
      status TEXT DEFAULT 'pending',
      approval_notes TEXT,
      FOREIGN KEY (transfer_record_id) REFERENCES transfer_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      api_endpoint TEXT NOT NULL,
      original_input TEXT NOT NULL,
      error_message TEXT NOT NULL,
      processing_result TEXT NOT NULL,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved BOOLEAN DEFAULT 0,
      resolved_by TEXT,
      resolved_at DATETIME
    )`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
