const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  era TEXT,
  valuation REAL NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT '待审核',
  handler TEXT,
  reviewer TEXT,
  review_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS batch_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  artifact_id INTEGER NOT NULL,
  valuation_snapshot REAL NOT NULL,
  processing_status TEXT NOT NULL DEFAULT '待审核',
  returned_reason TEXT,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  UNIQUE(batch_id, artifact_id)
);

CREATE TABLE IF NOT EXISTS transports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  transport_no TEXT NOT NULL,
  carrier TEXT,
  departure_time TEXT,
  arrival_time TEXT,
  status TEXT NOT NULL DEFAULT '待发运',
  delay_reason TEXT,
  delay_duration_hours INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transport_boxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transport_id INTEGER NOT NULL,
  box_no TEXT NOT NULL,
  artifact_id INTEGER NOT NULL,
  temperature REAL,
  humidity REAL,
  temp_anomaly BOOLEAN NOT NULL DEFAULT 0,
  humidity_anomaly BOOLEAN NOT NULL DEFAULT 0,
  anomaly_detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (transport_id) REFERENCES transports(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  policy_no TEXT UNIQUE NOT NULL,
  insurer TEXT,
  insured_value REAL NOT NULL,
  coverage_start TEXT,
  coverage_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  artifact_id INTEGER,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  handler TEXT NOT NULL,
  handled_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  resolved BOOLEAN NOT NULL DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER,
  artifact_id INTEGER,
  action TEXT NOT NULL,
  detail TEXT,
  operator TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS valuation_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id INTEGER NOT NULL,
  batch_id INTEGER,
  old_value REAL NOT NULL,
  new_value REAL NOT NULL,
  reason TEXT NOT NULL,
  operator TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_level ON artifacts(level);
CREATE INDEX IF NOT EXISTS idx_artifacts_no ON artifacts(artifact_no);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_no ON batches(batch_no);
CREATE INDEX IF NOT EXISTS idx_insurance_no ON insurance_policies(policy_no);
CREATE INDEX IF NOT EXISTS idx_transport_boxes_no ON transport_boxes(box_no);
CREATE INDEX IF NOT EXISTS idx_exceptions_type ON exceptions(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_batch ON audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_artifact ON audit_logs(artifact_id);
CREATE INDEX IF NOT EXISTS idx_valuation_changes_artifact ON valuation_changes(artifact_id);
`;

function initSchema(db) {
  return new Promise((resolve, reject) => {
    db.exec(SCHEMA_SQL, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

module.exports = { initSchema, SCHEMA_SQL };
