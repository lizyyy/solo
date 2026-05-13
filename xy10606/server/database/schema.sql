CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_schedules (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS host_schedule_versions (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  host_id TEXT,
  schedule_date DATE,
  start_time TEXT,
  end_time TEXT,
  description TEXT,
  status TEXT,
  change_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES host_schedules(id)
);

CREATE TABLE IF NOT EXISTS samples (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit_cost DECIMAL(10, 2),
  quantity_in_stock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sample_versions (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  sku TEXT,
  name TEXT,
  category TEXT,
  unit_cost DECIMAL(10, 2),
  quantity_in_stock INTEGER,
  change_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(id)
);

CREATE TABLE IF NOT EXISTS responsible_persons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sample_transactions (
  id TEXT PRIMARY KEY,
  transaction_type TEXT NOT NULL,
  sample_id TEXT NOT NULL,
  schedule_id TEXT,
  host_id TEXT,
  quantity INTEGER NOT NULL,
  loss_description TEXT,
  status TEXT DEFAULT 'pending',
  responsible_person_id TEXT,
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sample_id) REFERENCES samples(id),
  FOREIGN KEY (schedule_id) REFERENCES host_schedules(id),
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (responsible_person_id) REFERENCES responsible_persons(id)
);

CREATE TABLE IF NOT EXISTS sample_transaction_versions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  sample_id TEXT,
  schedule_id TEXT,
  host_id TEXT,
  quantity INTEGER,
  loss_description TEXT,
  status TEXT,
  responsible_person_id TEXT,
  change_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES sample_transactions(id)
);

CREATE TABLE IF NOT EXISTS transaction_reviews (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  review_type TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_name TEXT,
  review_result TEXT NOT NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES sample_transactions(id)
);

CREATE TABLE IF NOT EXISTS submitted_transactions (
  id TEXT PRIMARY KEY,
  sample_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sample_id, schedule_id, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_transactions_status ON sample_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_sample ON sample_transactions(sample_id);
CREATE INDEX IF NOT EXISTS idx_transactions_schedule ON sample_transactions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_transactions_responsible ON sample_transactions(responsible_person_id);
CREATE INDEX IF NOT EXISTS idx_host_schedules_date ON host_schedules(schedule_date);
