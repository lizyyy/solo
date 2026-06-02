import db from './index';

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS track_cleanup_records (
      id TEXT PRIMARY KEY,
      track_name TEXT NOT NULL,
      artist_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'needs_supplement', 'obsolete')),
      source TEXT NOT NULL CHECK(source IN ('stage_channel', 'manual', 'imported_old')),
      has_authorization INTEGER NOT NULL DEFAULT 1,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      is_old_master INTEGER NOT NULL DEFAULT 0,
      is_renamed INTEGER NOT NULL DEFAULT 0,
      original_track_name TEXT,
      current_note TEXT NOT NULL DEFAULT '',
      latest_handler TEXT NOT NULL,
      latest_handle_time TEXT NOT NULL,
      original_source TEXT NOT NULL,
      original_handle_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS version_history (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      modified_by TEXT NOT NULL,
      modified_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES track_cleanup_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_version_record_id ON version_history(record_id);
    CREATE INDEX IF NOT EXISTS idx_records_status ON track_cleanup_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_source ON track_cleanup_records(source);
  `);
}
