const schemaSQL = `
CREATE TABLE IF NOT EXISTS repair_requests (
  id TEXT PRIMARY KEY,
  ticket_no TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  business_type TEXT,
  applicant_id TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  department TEXT,
  urgency TEXT DEFAULT 'normal',
  risk_level TEXT DEFAULT 'medium',
  current_status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sql_contents (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  sql_text TEXT NOT NULL,
  sql_type TEXT,
  target_table TEXT,
  target_database TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS impact_estimations (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  estimated_rows INTEGER,
  affected_tables TEXT,
  affected_indexes TEXT,
  backup_strategy TEXT,
  rollback_plan TEXT,
  risk_assessment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  reason TEXT,
  is_manual_correction INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS sql_reviews (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  review_result TEXT NOT NULL,
  review_comments TEXT,
  sql_suggestions TEXT,
  approved_at INTEGER,
  rejected_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS execution_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  executor_id TEXT NOT NULL,
  executor_name TEXT NOT NULL,
  execution_status TEXT NOT NULL,
  execution_start_at INTEGER,
  execution_end_at INTEGER,
  affected_rows INTEGER,
  execution_log TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS rollback_scripts (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  rollback_sql TEXT NOT NULL,
  script_type TEXT,
  generated_at INTEGER,
  generated_by TEXT,
  is_approved INTEGER DEFAULT 0,
  executed_at INTEGER,
  execution_result TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  report_content TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  generated_by TEXT,
  report_type TEXT DEFAULT 'full',
  FOREIGN KEY (request_id) REFERENCES repair_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON repair_requests(current_status);
CREATE INDEX IF NOT EXISTS idx_requests_applicant ON repair_requests(applicant_id);
CREATE INDEX IF NOT EXISTS idx_requests_created ON repair_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_status_history_request ON status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_status_history_time ON status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_sql_reviews_request ON sql_reviews(request_id);
CREATE INDEX IF NOT EXISTS idx_execution_results_request ON execution_results(request_id);
CREATE INDEX IF NOT EXISTS idx_rollback_scripts_request ON rollback_scripts(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_request ON audit_reports(request_id);
`;

module.exports = schemaSQL;