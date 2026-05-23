CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  batch_no TEXT UNIQUE NOT NULL,
  vin TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  responsible_person TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  idempotent_strategy TEXT NOT NULL DEFAULT 'ignore',
  frozen INTEGER NOT NULL DEFAULT 0,
  frozen_at INTEGER,
  frozen_by TEXT,
  submit_count INTEGER NOT NULL DEFAULT 0,
  last_submitted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_vin ON batches(vin);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_batch_no ON batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at);

CREATE TABLE IF NOT EXISTS inspection_sheets (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  sheet_no TEXT NOT NULL,
  inspector TEXT NOT NULL,
  inspection_date INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  overall_status TEXT NOT NULL,
  items TEXT NOT NULL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_inspection_sheets_batch_id ON inspection_sheets(batch_id);
CREATE INDEX IF NOT EXISTS idx_inspection_sheets_sheet_no ON inspection_sheets(sheet_no);

CREATE TABLE IF NOT EXISTS repair_quotes (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  quote_no TEXT NOT NULL,
  workshop TEXT NOT NULL,
  quoted_by TEXT NOT NULL,
  quote_date INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  items TEXT NOT NULL,
  labor_cost REAL NOT NULL DEFAULT 0,
  parts_cost REAL NOT NULL DEFAULT 0,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_repair_quotes_batch_id ON repair_quotes(batch_id);
CREATE INDEX IF NOT EXISTS idx_repair_quotes_quote_no ON repair_quotes(quote_no);

CREATE TABLE IF NOT EXISTS photo_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  photo_no TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  is_abnormal INTEGER NOT NULL DEFAULT 0,
  abnormal_desc TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_photo_items_batch_id ON photo_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_photo_items_is_abnormal ON photo_items(is_abnormal);

CREATE TABLE IF NOT EXISTS abnormal_photos (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  photo_item_id TEXT NOT NULL,
  abnormal_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  reported_by TEXT NOT NULL,
  reported_at INTEGER NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_result TEXT,
  manual_override INTEGER NOT NULL DEFAULT 0,
  manual_override_by TEXT,
  manual_override_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (photo_item_id) REFERENCES photo_items(id)
);

CREATE INDEX IF NOT EXISTS idx_abnormal_photos_batch_id ON abnormal_photos(batch_id);
CREATE INDEX IF NOT EXISTS idx_abnormal_photos_photo_item_id ON abnormal_photos(photo_item_id);
CREATE INDEX IF NOT EXISTS idx_abnormal_photos_reviewed ON abnormal_photos(reviewed);

CREATE TABLE IF NOT EXISTS sms_screenshots (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  sms_no TEXT NOT NULL,
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_sms_screenshots_batch_id ON sms_screenshots(batch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  item_type TEXT,
  item_id TEXT,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  operator TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  remark TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator);

CREATE TABLE IF NOT EXISTS status_transitions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_status_transitions_batch_id ON status_transitions(batch_id);
CREATE INDEX IF NOT EXISTS idx_status_transitions_created_at ON status_transitions(created_at);
