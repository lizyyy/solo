CREATE TABLE IF NOT EXISTS chart_metrics (
  id TEXT PRIMARY KEY,
  chart_code TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_date TEXT NOT NULL,
  dimension TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chart_code, metric_name, metric_date, dimension)
);

CREATE TABLE IF NOT EXISTS annotation_events (
  id TEXT PRIMARY KEY,
  request_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  impact_level TEXT DEFAULT 'medium',
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  parent_id TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scope_definitions (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_value TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annotation_id) REFERENCES annotation_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS approval_status_logs (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL,
  status TEXT NOT NULL,
  approver TEXT,
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annotation_id) REFERENCES annotation_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot_data TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (annotation_id) REFERENCES annotation_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_recalculation_records (
  id TEXT PRIMARY KEY,
  annotation_id TEXT NOT NULL,
  recalculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  recalculated_by TEXT NOT NULL,
  affected_metrics TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_annotation_request_id ON annotation_events(request_id);
CREATE INDEX IF NOT EXISTS idx_annotation_status ON annotation_events(status);
CREATE INDEX IF NOT EXISTS idx_annotation_event_date ON annotation_events(event_date);
CREATE INDEX IF NOT EXISTS idx_scope_annotation ON scope_definitions(annotation_id);
CREATE INDEX IF NOT EXISTS idx_approval_annotation ON approval_status_logs(annotation_id);
CREATE INDEX IF NOT EXISTS idx_versions_annotation ON versions(annotation_id);
CREATE INDEX IF NOT EXISTS idx_chart_metrics_date ON chart_metrics(metric_date);
