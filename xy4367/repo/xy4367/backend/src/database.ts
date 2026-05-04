import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const db = new Database(join(__dirname, '../../data/astro.db'));

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS observing_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('telescope', 'camera', 'mount', 'filter')),
      model TEXT,
      battery_level REAL NOT NULL DEFAULT 100,
      is_available INTEGER NOT NULL DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS observing_targets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      right_ascension TEXT NOT NULL,
      declination TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS target_windows (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      device_ids TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (target_id) REFERENCES observing_targets(id)
    );

    CREATE TABLE IF NOT EXISTS light_pollution_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      date TEXT NOT NULL,
      bortle_scale INTEGER NOT NULL,
      limiting_magnitude REAL NOT NULL,
      artificial_sky_brightness REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (site_id) REFERENCES observing_sites(id)
    );

    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      window_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
      message TEXT NOT NULL,
      is_overridden INTEGER NOT NULL DEFAULT 0,
      override_reason TEXT,
      override_by TEXT,
      override_at TEXT,
      FOREIGN KEY (window_id) REFERENCES target_windows(id)
    );

    CREATE TABLE IF NOT EXISTS observation_activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      site_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('planned', 'active', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES observing_sites(id)
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      window_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      reviewed_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('approved', 'rejected', 'pending')),
      notes TEXT,
      risks TEXT NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES observation_activities(id),
      FOREIGN KEY (window_id) REFERENCES target_windows(id)
    );

    CREATE INDEX IF NOT EXISTS idx_windows_target ON target_windows(target_id);
    CREATE INDEX IF NOT EXISTS idx_risks_window ON risks(window_id);
    CREATE INDEX IF NOT EXISTS idx_risks_type ON risks(type);
    CREATE INDEX IF NOT EXISTS idx_reviews_activity ON review_records(activity_id);
  `);
}
