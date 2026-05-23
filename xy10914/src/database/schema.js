const schema = `
CREATE TABLE IF NOT EXISTS riders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  station TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  rider_id INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  restaurant_name TEXT,
  order_amount REAL,
  promised_delivery_time DATETIME,
  actual_delivery_time DATETIME,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
);

CREATE TABLE IF NOT EXISTS exception_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'normal',
  requires_evidence INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exception_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exception_no TEXT UNIQUE NOT NULL,
  order_id INTEGER NOT NULL,
  rider_id INTEGER NOT NULL,
  exception_type_id INTEGER NOT NULL,
  reported_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  status TEXT DEFAULT 'pending',
  raw_input TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (rider_id) REFERENCES riders(id),
  FOREIGN KEY (exception_type_id) REFERENCES exception_types(id)
);

CREATE TABLE IF NOT EXISTS reassignment_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reassignment_no TEXT UNIQUE NOT NULL,
  exception_record_id INTEGER NOT NULL,
  from_rider_id INTEGER NOT NULL,
  to_rider_id INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  requested_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_time DATETIME,
  processed_by TEXT,
  conclusion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exception_record_id) REFERENCES exception_records(id),
  FOREIGN KEY (from_rider_id) REFERENCES riders(id),
  FOREIGN KEY (to_rider_id) REFERENCES riders(id)
);

CREATE TABLE IF NOT EXISTS appeal_evidences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_no TEXT UNIQUE NOT NULL,
  exception_record_id INTEGER NOT NULL,
  uploader_id INTEGER NOT NULL,
  evidence_type TEXT NOT NULL,
  evidence_url TEXT,
  description TEXT,
  upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified INTEGER DEFAULT 0,
  verified_by TEXT,
  verified_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exception_record_id) REFERENCES exception_records(id),
  FOREIGN KEY (uploader_id) REFERENCES riders(id)
);

CREATE TABLE IF NOT EXISTS arbitration_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arbitration_no TEXT UNIQUE NOT NULL,
  exception_record_id INTEGER NOT NULL,
  arbitrator TEXT NOT NULL,
  arbitration_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  result TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  penalty_type TEXT,
  penalty_amount REAL,
  is_appealable INTEGER DEFAULT 1,
  appeal_deadline DATETIME,
  raw_input TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exception_record_id) REFERENCES exception_records(id)
);

CREATE TABLE IF NOT EXISTS processing_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_no TEXT UNIQUE NOT NULL,
  exception_record_id INTEGER,
  operation_type TEXT NOT NULL,
  operator TEXT,
  before_status TEXT,
  after_status TEXT,
  raw_input TEXT,
  conclusion TEXT,
  operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exception_record_id) REFERENCES exception_records(id)
);

CREATE INDEX IF NOT EXISTS idx_exception_records_order ON exception_records(order_id);
CREATE INDEX IF NOT EXISTS idx_exception_records_rider ON exception_records(rider_id);
CREATE INDEX IF NOT EXISTS idx_reassignment_exception ON reassignment_records(exception_record_id);
CREATE INDEX IF NOT EXISTS idx_evidence_exception ON appeal_evidences(exception_record_id);
CREATE INDEX IF NOT EXISTS idx_arbitration_exception ON arbitration_results(exception_record_id);
CREATE INDEX IF NOT EXISTS idx_logs_exception ON processing_logs(exception_record_id);
`;

module.exports = schema;
