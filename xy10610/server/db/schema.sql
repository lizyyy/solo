CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  tracking_number TEXT UNIQUE NOT NULL,
  sender_name TEXT,
  sender_country TEXT,
  receiver_name TEXT,
  receiver_address TEXT,
  weight REAL,
  declared_value REAL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS declaration_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  hs_code TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER,
  unit_price REAL,
  total_value REAL,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tax_calculations (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  customs_duty REAL DEFAULT 0,
  value_added_tax REAL DEFAULT 0,
  consumption_tax REAL DEFAULT 0,
  total_tax REAL DEFAULT 0,
  calculation_rules TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customs_callbacks (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  callback_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  customs_reference TEXT,
  callback_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS supplement_tickets (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  ticket_number TEXT UNIQUE NOT NULL,
  required_documents TEXT,
  current_owner TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS re_submissions (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  original_tracking_number TEXT,
  reason TEXT,
  review_status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_templates (
  id TEXT PRIMARY KEY,
  template_name TEXT UNIQUE NOT NULL,
  scenario TEXT,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'zh-CN',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  package_id TEXT,
  operation_type TEXT NOT NULL,
  operator TEXT,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  request_hash TEXT NOT NULL,
  response_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_packages_tracking ON packages(tracking_number);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_declaration_items_package ON declaration_items(package_id);
CREATE INDEX IF NOT EXISTS idx_customs_callbacks_package ON customs_callbacks(package_id);
CREATE INDEX IF NOT EXISTS idx_supplement_tickets_package ON supplement_tickets(package_id);
CREATE INDEX IF NOT EXISTS idx_supplement_tickets_status ON supplement_tickets(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_package ON operation_logs(package_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(idempotency_key);
