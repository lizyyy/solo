import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'rigging.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
  }
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheme (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      safety_factor REAL NOT NULL DEFAULT 2.0,
      status TEXT NOT NULL CHECK(status IN ('draft','verified','flagged')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rigging_point (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL REFERENCES scheme(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0,
      rated_load REAL NOT NULL,
      rated_load_unit TEXT NOT NULL CHECK(rated_load_unit IN ('kg','lb')),
      angle REAL NOT NULL DEFAULT 0,
      angle_direction TEXT NOT NULL DEFAULT 'left' CHECK(angle_direction IN ('left','right')),
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixture (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      weight REAL NOT NULL,
      weight_unit TEXT NOT NULL CHECK(weight_unit IN ('kg','lb')),
      quantity INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS assignment (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL REFERENCES scheme(id) ON DELETE CASCADE,
      point_id TEXT NOT NULL REFERENCES rigging_point(id) ON DELETE CASCADE,
      fixture_id TEXT NOT NULL REFERENCES fixture(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS risk_item (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL REFERENCES scheme(id) ON DELETE CASCADE,
      point_id TEXT REFERENCES rigging_point(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK(category IN ('unit_error','overload','angle_reversed','safety_insufficient')),
      severity TEXT NOT NULL CHECK(severity IN ('critical','warning','info')),
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved','dismissed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheme_version (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL REFERENCES scheme(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS changelog (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL REFERENCES scheme_version(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      old_value TEXT NOT NULL DEFAULT '',
      new_value TEXT NOT NULL DEFAULT '',
      changed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_rigging_point_scheme ON rigging_point(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_assignment_scheme ON assignment(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_assignment_point ON assignment(point_id);
    CREATE INDEX IF NOT EXISTS idx_assignment_fixture ON assignment(fixture_id);
    CREATE INDEX IF NOT EXISTS idx_risk_scheme ON risk_item(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_risk_status ON risk_item(status);
    CREATE INDEX IF NOT EXISTS idx_version_scheme ON scheme_version(scheme_id);
    CREATE INDEX IF NOT EXISTS idx_changelog_version ON changelog(version_id);
  `)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
