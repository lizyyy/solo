CREATE TABLE IF NOT EXISTS import_batch (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  reused_count INTEGER NOT NULL DEFAULT 0,
  suspected_count INTEGER NOT NULL DEFAULT 0,
  imported_by TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_batch_batch_id ON import_batch(batch_id);

CREATE TABLE IF NOT EXISTS material (
  id TEXT PRIMARY KEY,
  material_name TEXT NOT NULL,
  isrc_code TEXT NOT NULL,
  composer TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL,
  license_start_date TEXT NOT NULL,
  license_end_date TEXT NOT NULL,
  episode_count INTEGER NOT NULL DEFAULT 0,
  license_fee REAL NOT NULL DEFAULT 0,
  revenue_ratio TEXT NOT NULL DEFAULT '0',
  error_tolerance TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  batch_id TEXT NOT NULL REFERENCES import_batch(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_isrc ON material(isrc_code);
CREATE INDEX IF NOT EXISTS idx_material_name_isrc_date ON material(material_name, isrc_code, license_start_date);
CREATE INDEX IF NOT EXISTS idx_material_status ON material(status);
CREATE INDEX IF NOT EXISTS idx_material_batch_id ON material(batch_id);

CREATE TABLE IF NOT EXISTS track (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material(id),
  track_name TEXT NOT NULL,
  track_number INTEGER NOT NULL DEFAULT 1,
  track_type TEXT NOT NULL DEFAULT 'V1',
  isrc_code TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  need_recheck INTEGER NOT NULL DEFAULT 0,
  rework_confirmed INTEGER NOT NULL DEFAULT 0,
  rework_confirmed_by TEXT,
  rework_confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_track_material_id ON track(material_id);
CREATE INDEX IF NOT EXISTS idx_track_rework ON track(need_recheck, rework_confirmed);

CREATE TABLE IF NOT EXISTS tuner_message (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material(id),
  content TEXT NOT NULL,
  message_date TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  has_conflict INTEGER NOT NULL DEFAULT 0,
  conflict_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tuner_message_material_id ON tuner_message(material_id);
CREATE INDEX IF NOT EXISTS idx_tuner_message_conflict ON tuner_message(conflict_status);

CREATE TABLE IF NOT EXISTS conflict (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material(id),
  track_id TEXT,
  message_id TEXT NOT NULL REFERENCES tuner_message(id),
  field_name TEXT NOT NULL,
  original_value TEXT NOT NULL,
  message_value TEXT NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conflict_material_id ON conflict(material_id);
CREATE INDEX IF NOT EXISTS idx_conflict_status ON conflict(status);
CREATE INDEX IF NOT EXISTS idx_conflict_message_id ON conflict(message_id);

CREATE TABLE IF NOT EXISTS rehearsal_change (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material(id),
  track_id TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  operator TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  affected_items TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_material_id ON rehearsal_change(material_id);
CREATE INDEX IF NOT EXISTS idx_change_track_id ON rehearsal_change(track_id);
CREATE INDEX IF NOT EXISTS idx_change_field_name ON rehearsal_change(field_name);

CREATE TABLE IF NOT EXISTS history_record (
  id TEXT PRIMARY KEY,
  material_id TEXT NOT NULL REFERENCES material(id),
  track_id TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  operator TEXT,
  change_reason TEXT,
  record_snapshot TEXT NOT NULL,
  change_id TEXT NOT NULL REFERENCES rehearsal_change(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_material_id ON history_record(material_id);
CREATE INDEX IF NOT EXISTS idx_history_change_id ON history_record(change_id);
CREATE INDEX IF NOT EXISTS idx_history_track_id ON history_record(track_id);
