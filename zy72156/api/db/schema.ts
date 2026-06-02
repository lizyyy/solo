import { getDb } from '../db/index.js'

export function initSchema(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      has_coordinate_drift INTEGER NOT NULL DEFAULT 0,
      drift_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL REFERENCES locations(id),
      raw_location_text TEXT NOT NULL,
      content TEXT,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('居民投诉','网格巡查','12345工单','现场走访')),
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      duplicate_of TEXT REFERENCES feedback(id),
      is_boundary INTEGER NOT NULL DEFAULT 0,
      boundary_note TEXT,
      reported_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL REFERENCES locations(id),
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '草稿' CHECK(status IN ('草稿','已发布','被覆盖')),
      superseded_by TEXT REFERENCES schemes(id),
      historical_opinion TEXT,
      manual_note TEXT,
      source_refs TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_by TEXT NOT NULL DEFAULT '老曹'
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL REFERENCES locations(id),
      scheme_id TEXT NOT NULL REFERENCES schemes(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      cross_period_stats TEXT NOT NULL DEFAULT '{}',
      source_trace TEXT NOT NULL DEFAULT '[]',
      generated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      generated_by TEXT NOT NULL DEFAULT '老曹'
    );

    CREATE TABLE IF NOT EXISTS manual_notes (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL CHECK(target_type IN ('location','feedback','scheme','report')),
      target_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_by TEXT NOT NULL DEFAULT '老曹'
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_location ON feedback(location_id);
    CREATE INDEX IF NOT EXISTS idx_schemes_location ON schemes(location_id);
    CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(location_id);
    CREATE INDEX IF NOT EXISTS idx_notes_target ON manual_notes(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_duplicate ON feedback(is_duplicate);
    CREATE INDEX IF NOT EXISTS idx_feedback_boundary ON feedback(is_boundary);
  `)
}
