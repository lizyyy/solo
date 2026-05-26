const SCHEMA = `
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_no VARCHAR(50) UNIQUE NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  source_name VARCHAR(100),
  total_count INTEGER DEFAULT 0,
  created_by VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  remark TEXT
);

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_no VARCHAR(50) UNIQUE NOT NULL,
  batch_id INTEGER,
  pole_no VARCHAR(50) NOT NULL,
  light_no VARCHAR(50),
  record_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  alarm_type VARCHAR(100),
  alarm_level VARCHAR(20),
  location TEXT,
  description TEXT,
  maintenance_team VARCHAR(100),
  handler VARCHAR(50),
  report_time DATETIME,
  repair_time DATETIME,
  recheck_result VARCHAR(20),
  recheck_time DATETIME,
  recheck_by VARCHAR(50),
  source_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS processing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  action_reason TEXT,
  action_by VARCHAR(50) NOT NULL,
  action_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  remark TEXT,
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE TABLE IF NOT EXISTS multi_light_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  main_record_id INTEGER NOT NULL,
  related_record_id INTEGER NOT NULL,
  relation_type VARCHAR(20) DEFAULT 'same_pole',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (main_record_id) REFERENCES records(id),
  FOREIGN KEY (related_record_id) REFERENCES records(id)
);

CREATE TABLE IF NOT EXISTS false_alarm_filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  filter_reason TEXT NOT NULL,
  filter_by VARCHAR(50) NOT NULL,
  filter_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  confidence_score DECIMAL(3,2),
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE INDEX IF NOT EXISTS idx_records_pole_no ON records(pole_no);
CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
CREATE INDEX IF NOT EXISTS idx_records_maintenance_team ON records(maintenance_team);
CREATE INDEX IF NOT EXISTS idx_records_recheck_result ON records(recheck_result);
CREATE INDEX IF NOT EXISTS idx_records_batch_id ON records(batch_id);
CREATE INDEX IF NOT EXISTS idx_history_record_id ON processing_history(record_id);
`;

module.exports = SCHEMA;
