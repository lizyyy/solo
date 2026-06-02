-- 结算批次表
CREATE TABLE IF NOT EXISTS settlement_batches (
  id TEXT PRIMARY KEY,
  batch_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  import_date TEXT NOT NULL,
  import_operator TEXT NOT NULL,
  risk_operator TEXT,
  audit_operator TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  exception_records INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON settlement_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_import_date ON settlement_batches(import_date);

-- 明细表
CREATE TABLE IF NOT EXISTS settlement_details (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
  original_line_no INTEGER NOT NULL,
  original_snapshot_id TEXT NOT NULL REFERENCES original_snapshots(id),
  policy_no TEXT NOT NULL,
  product_name TEXT,
  commission_amount REAL NOT NULL,
  currency TEXT NOT NULL,
  currency_raw TEXT NOT NULL,
  has_mixed_currency INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL,
  tax_rate_remark TEXT,
  net_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  tier_level INTEGER NOT NULL DEFAULT 1,
  tier_rate REAL NOT NULL DEFAULT 0,
  current_handler TEXT,
  data_fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_details_batch_id ON settlement_details(batch_id);
CREATE INDEX IF NOT EXISTS idx_details_status ON settlement_details(status);
CREATE INDEX IF NOT EXISTS idx_details_mixed_currency ON settlement_details(has_mixed_currency);
CREATE INDEX IF NOT EXISTS idx_details_fingerprint ON settlement_details(data_fingerprint);

-- 原始快照表
CREATE TABLE IF NOT EXISTS original_snapshots (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
  original_line_no INTEGER NOT NULL,
  raw_content TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  import_source TEXT NOT NULL,
  file_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_snapshots_batch_id ON original_snapshots(batch_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_file_hash ON original_snapshots(file_hash);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  detail_id TEXT NOT NULL REFERENCES settlement_details(id),
  batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
  operator TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  remark TEXT,
  operated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_detail_id ON audit_logs(detail_id);
CREATE INDEX IF NOT EXISTS idx_audit_batch_id ON audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_operated_at ON audit_logs(operated_at);

-- 自检结果表
CREATE TABLE IF NOT EXISTS self_check_results (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES settlement_batches(id),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  affected_detail_ids TEXT,
  check_metadata TEXT,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_self_check_batch_id ON self_check_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_self_check_type ON self_check_results(check_type);
