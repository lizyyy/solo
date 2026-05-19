export const createTables = `
CREATE TABLE IF NOT EXISTS room_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('occupied', 'vacant', 'reserved', 'maintenance')),
  guest_name TEXT,
  guest_phone TEXT,
  check_in_date TEXT,
  check_out_date TEXT,
  source TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_number, date)
);

CREATE TABLE IF NOT EXISTS cleaning_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL,
  cleaner_name TEXT NOT NULL,
  cleaner_phone TEXT,
  scheduled_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  photos TEXT,
  quality_score INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  remarks TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL,
  guest_name TEXT,
  guest_phone TEXT,
  complaint_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cleanliness', 'facility', 'service', 'noise', 'other')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  handler TEXT,
  resolution TEXT,
  resolution_date TEXT,
  deduction_amount REAL DEFAULT 0,
  related_cleaning_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_cleaning_id) REFERENCES cleaning_records(id)
);

CREATE TABLE IF NOT EXISTS rework_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  related_cleaning_id INTEGER NOT NULL,
  room_number TEXT NOT NULL,
  rework_reason TEXT NOT NULL,
  rework_date TEXT NOT NULL,
  reworker_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  photos TEXT,
  verification_remarks TEXT,
  deduction_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_cleaning_id) REFERENCES cleaning_records(id)
);

CREATE TABLE IF NOT EXISTS deduction_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  sub_category TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  is_percentage INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'json', 'photo_list')),
  source_file_name TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,
  is_valid INTEGER NOT NULL DEFAULT 0,
  errors TEXT,
  suggestions TEXT,
  imported_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('room_state', 'cleaning', 'photo')),
  file_name TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  valid_records INTEGER NOT NULL DEFAULT 0,
  invalid_records INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_room_states_date ON room_states(date);
CREATE INDEX IF NOT EXISTS idx_cleaning_records_scheduled ON cleaning_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_complaints_date ON complaints(complaint_date);
CREATE INDEX IF NOT EXISTS idx_import_records_batch ON import_records(batch_id);
`;

export const seedDeductionRules = `
INSERT OR IGNORE INTO deduction_rules (category, sub_category, description, amount, is_percentage) VALUES
('cleanliness', 'missing_photo', '保洁照片缺失', 50, 0),
('cleanliness', 'poor_quality', '保洁质量不达标', 100, 0),
('cleanliness', 'forgotten_item', '遗留物品未清理', 80, 0),
('rework', 'second_cleaning', '二次返工扣款', 150, 0),
('complaint', 'guest_complaint', '客诉扣款', 200, 0),
('complaint', 'escalated', '升级客诉', 500, 0);
`;
