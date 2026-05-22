"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATE_TABLES_SQL = exports.TABLES = void 0;
exports.TABLES = {
    IMPORT_SOURCES: 'import_sources',
    ORDER_ITEMS: 'order_items',
    WASTE_RECORDS: 'waste_records',
    HEADQUARTER_PRICES: 'headquarter_prices',
    SUPPLEMENT_RECORDS: 'supplement_records',
    VERIFICATION_TASKS: 'verification_tasks',
    ANOMALY_RECORDS: 'anomaly_records',
    RECONCILIATION_RESULTS: 'reconciliation_results',
    EXPORT_RECORDS: 'export_records'
};
exports.CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS import_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  source_type TEXT NOT NULL,
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  imported_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  source_line_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,
  order_no TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  franchisee_id TEXT NOT NULL,
  franchisee_name TEXT NOT NULL,
  order_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES import_sources(source_id)
);

CREATE TABLE IF NOT EXISTS waste_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  source_line_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,
  waste_no TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  waste_reason TEXT NOT NULL,
  franchisee_id TEXT NOT NULL,
  franchisee_name TEXT NOT NULL,
  waste_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES import_sources(source_id)
);

CREATE TABLE IF NOT EXISTS headquarter_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  source_line_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  price REAL NOT NULL,
  unit TEXT NOT NULL,
  effective_date DATE NOT NULL,
  expire_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES import_sources(source_id)
);

CREATE TABLE IF NOT EXISTS supplement_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT UNIQUE NOT NULL,
  source_id TEXT NOT NULL,
  source_line_number INTEGER NOT NULL,
  raw_data TEXT NOT NULL,
  supplement_no TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  supplement_reason TEXT NOT NULL,
  franchisee_id TEXT NOT NULL,
  franchisee_name TEXT NOT NULL,
  supplement_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES import_sources(source_id)
);

CREATE TABLE IF NOT EXISTS verification_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT UNIQUE NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  failure_category TEXT,
  failure_reason TEXT,
  manual_opinion TEXT,
  assigned_to TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anomaly_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomaly_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  related_fact_ids TEXT,
  status TEXT NOT NULL,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES verification_tasks(task_id)
);

CREATE TABLE IF NOT EXISTS reconciliation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  franchisee_id TEXT NOT NULL,
  material_code TEXT NOT NULL,
  expected_quantity REAL NOT NULL,
  actual_quantity REAL NOT NULL,
  difference REAL NOT NULL,
  unit_price REAL NOT NULL,
  difference_amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES verification_tasks(task_id)
);

CREATE TABLE IF NOT EXISTS export_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  export_id TEXT UNIQUE NOT NULL,
  task_id TEXT,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  exported_by TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  export_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES verification_tasks(task_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_fact_id ON order_items(fact_id);
CREATE INDEX IF NOT EXISTS idx_order_items_franchisee ON order_items(franchisee_id, order_date);
CREATE INDEX IF NOT EXISTS idx_waste_franchisee ON waste_records(franchisee_id, waste_date);
CREATE INDEX IF NOT EXISTS idx_prices_effective ON headquarter_prices(material_code, effective_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_task ON anomaly_records(task_id);
`;
