CREATE TABLE IF NOT EXISTS log_topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')
);

CREATE TABLE IF NOT EXISTS event_ranges (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  start_event_id TEXT,
  end_event_id TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES log_topics(id)
);

CREATE TABLE IF NOT EXISTS hash_chains (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  event_id TEXT NOT NULL UNIQUE,
  event_timestamp TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  event_content_hash TEXT NOT NULL,
  chain_sequence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES log_topics(id)
);

CREATE INDEX IF NOT EXISTS idx_hash_chains_topic_sequence ON hash_chains(topic_id, chain_sequence);

CREATE TABLE IF NOT EXISTS export_requests (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  range_id TEXT NOT NULL,
  requester TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approver TEXT,
  approval_comment TEXT,
  approved_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  original_input TEXT NOT NULL,
  processing_evidence TEXT,
  failure_reason TEXT,
  final_conclusion TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES log_topics(id),
  FOREIGN KEY (range_id) REFERENCES event_ranges(id)
);

CREATE INDEX IF NOT EXISTS idx_export_requests_idempotency ON export_requests(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status);

CREATE TABLE IF NOT EXISTS verification_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  range_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  hash_chain_valid INTEGER NOT NULL DEFAULT 0,
  first_hash TEXT NOT NULL,
  last_hash TEXT NOT NULL,
  verified_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  mismatch_details TEXT,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_by TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES export_requests(id),
  FOREIGN KEY (range_id) REFERENCES event_ranges(id)
);

CREATE TABLE IF NOT EXISTS proof_reports (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  verification_id TEXT NOT NULL,
  report_content TEXT NOT NULL,
  file_path TEXT,
  file_format TEXT NOT NULL DEFAULT 'json',
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES export_requests(id),
  FOREIGN KEY (verification_id) REFERENCES verification_results(id)
);

CREATE TABLE IF NOT EXISTS audit_log_events (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (topic_id) REFERENCES log_topics(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_events_topic_time ON audit_log_events(topic_id, timestamp);

CREATE TABLE IF NOT EXISTS processing_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (request_id) REFERENCES export_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_processing_history_request ON processing_history(request_id);
