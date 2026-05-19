CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT,
  min_temp REAL,
  max_temp REAL,
  shelf_life_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  supplier TEXT,
  delivery_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  valid_items INTEGER DEFAULT 0,
  invalid_items INTEGER DEFAULT 0,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT '支',
  temperature REAL,
  receiver_name TEXT,
  receiver_phone TEXT,
  damage_photo_path TEXT,
  damage_description TEXT,
  has_damage INTEGER DEFAULT 0,
  production_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'pending',
  validation_result TEXT,
  validation_details TEXT,
  is_valid INTEGER DEFAULT 1,
  review_status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES delivery_orders(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT '支',
  location TEXT,
  production_date DATE,
  expiry_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_code, batch_no)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT NOT NULL,
  product_code TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  reference_id INTEGER,
  reference_type TEXT,
  operated_by TEXT,
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type TEXT NOT NULL,
  operator TEXT,
  ip_address TEXT,
  request_path TEXT,
  request_method TEXT,
  request_body TEXT,
  response_status INTEGER,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  affected_records INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS validation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_code TEXT UNIQUE NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  severity TEXT DEFAULT 'error',
  error_message TEXT NOT NULL,
  config_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT UNIQUE NOT NULL,
  operation_type TEXT NOT NULL,
  total_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_details TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS batch_operation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_operation_id INTEGER NOT NULL,
  item_index INTEGER NOT NULL,
  item_key TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  result_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_operation_id) REFERENCES batch_operations(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_items_order_id ON delivery_items(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_batch_no ON delivery_items(batch_no);
CREATE INDEX IF NOT EXISTS idx_delivery_items_status ON delivery_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_product_batch ON inventory(product_code, batch_no);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_batch_operations_batch_no ON batch_operations(batch_no);
