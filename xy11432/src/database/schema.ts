export const createTables = `
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  data TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE(source_type, batch_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_records_batch ON records(batch_id);
CREATE INDEX IF NOT EXISTS idx_records_source ON records(source_type, source_id);

CREATE TABLE IF NOT EXISTS queue_items (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_retry_at INTEGER,
  next_retry_at INTEGER,
  processed_by TEXT,
  processed_at INTEGER,
  error_message TEXT,
  error_stack TEXT,
  frozen INTEGER NOT NULL DEFAULT 0,
  frozen_by TEXT,
  frozen_at INTEGER,
  frozen_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_items(status);
CREATE INDEX IF NOT EXISTS idx_queue_batch ON queue_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_queue_retry ON queue_items(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_queue_frozen ON queue_items(frozen);

CREATE TABLE IF NOT EXISTS change_history (
  id TEXT PRIMARY KEY,
  queue_item_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  operator TEXT NOT NULL,
  operated_at INTEGER NOT NULL,
  before_state TEXT,
  after_state TEXT,
  diff TEXT,
  comment TEXT,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (queue_item_id) REFERENCES queue_items(id)
);

CREATE INDEX IF NOT EXISTS idx_history_queue ON change_history(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_history_operator ON change_history(operator);
CREATE INDEX IF NOT EXISTS idx_history_time ON change_history(operated_at);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY,
  queue_item_id TEXT NOT NULL UNIQUE,
  record_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  original_error TEXT NOT NULL,
  retry_history TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at INTEGER,
  resolution TEXT,
  FOREIGN KEY (queue_item_id) REFERENCES queue_items(id),
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE INDEX IF NOT EXISTS idx_dead_resolved ON dead_letters(resolved);
CREATE INDEX IF NOT EXISTS idx_dead_batch ON dead_letters(batch_id);

CREATE TABLE IF NOT EXISTS compensation_ledger (
  id TEXT PRIMARY KEY,
  queue_item_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount REAL,
  quantity REAL,
  account_code TEXT,
  posted_by TEXT NOT NULL,
  posted_at INTEGER NOT NULL,
  reference TEXT,
  notes TEXT,
  FOREIGN KEY (queue_item_id) REFERENCES queue_items(id),
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_batch ON compensation_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_ledger_time ON compensation_ledger(posted_at);

CREATE TABLE IF NOT EXISTS supervisor_comments (
  id TEXT PRIMARY KEY,
  queue_item_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  commented_by TEXT NOT NULL,
  commented_at INTEGER NOT NULL,
  is_append_only INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (queue_item_id) REFERENCES queue_items(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_queue ON supervisor_comments(queue_item_id);

CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  log_level TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  stack_trace TEXT,
  created_at INTEGER NOT NULL,
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_logs_time ON system_logs(created_at);

CREATE TABLE IF NOT EXISTS export_snapshots (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  filters TEXT,
  content_hash TEXT NOT NULL,
  exported_by TEXT NOT NULL,
  exported_at INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  frozen_snapshot INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_snapshots_time ON export_snapshots(exported_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON export_snapshots(content_hash);
`;
