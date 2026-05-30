import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/setlist.db');

export const initDatabase = (): Database.Database => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS setlists (
      id TEXT PRIMARY KEY,
      tour_name TEXT NOT NULL,
      venue TEXT NOT NULL,
      date TEXT NOT NULL,
      max_duration INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      current_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      last_validated TEXT,
      last_check_result_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_setlists_date ON setlists(date);
    CREATE INDEX IF NOT EXISTS idx_setlists_status ON setlists(status);

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      original_key TEXT NOT NULL,
      current_key TEXT NOT NULL,
      duration INTEGER NOT NULL,
      song_order INTEGER NOT NULL,
      vocal_range_min TEXT,
      vocal_range_max TEXT,
      vocal_notes TEXT,
      guitar_tuning TEXT,
      bass_tuning TEXT,
      keys_tuning TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      update_reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_songs_setlist_id ON songs(setlist_id);
    CREATE INDEX IF NOT EXISTS idx_songs_order ON songs(setlist_id, song_order);

    CREATE TABLE IF NOT EXISTS song_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_song_versions_song_id ON song_versions(song_id);
    CREATE INDEX IF NOT EXISTS idx_song_versions_version ON song_versions(song_id, version);

    CREATE TABLE IF NOT EXISTS setlist_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      description TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_setlist_versions_setlist_id ON setlist_versions(setlist_id);

    CREATE TABLE IF NOT EXISTS check_reports (
      id TEXT PRIMARY KEY,
      setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
      generated_at TEXT NOT NULL,
      generated_by TEXT NOT NULL DEFAULT 'system',
      summary_json TEXT NOT NULL,
      key_checks_json TEXT NOT NULL,
      duration_analysis_json TEXT NOT NULL,
      duration_breakdown_json TEXT NOT NULL DEFAULT '{}',
      conflicts_json TEXT NOT NULL,
      validations_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_check_reports_setlist_id ON check_reports(setlist_id);
    CREATE INDEX IF NOT EXISTS idx_check_reports_generated_at ON check_reports(generated_at);

    CREATE TABLE IF NOT EXISTS validation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL REFERENCES check_reports(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL,
      song_name TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 1,
      severity TEXT NOT NULL DEFAULT 'warning',
      check_type TEXT NOT NULL DEFAULT 'key_format',
      message TEXT NOT NULL DEFAULT '',
      suggestion TEXT,
      details_json TEXT,
      checks_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_validation_results_report_id ON validation_results(report_id);
  `);

  const countStmt = db.prepare('SELECT COUNT(*) as count FROM setlists');
  const result = countStmt.get() as { count: number };
  if (result.count === 0) {
    seedData(db);
  }

  return db;
};

const seedData = (db: Database.Database) => {
  const now = new Date().toISOString();

  const insertSetlist = db.prepare(`
    INSERT INTO setlists (id, tour_name, venue, date, max_duration, status, current_version, created_at, last_updated)
    VALUES (?, ?, ?, ?, ?, 'draft', 1, ?, ?)
  `);
  insertSetlist.run('sl-001', '夏日狂热巡演', '北京工人体育馆', '2026-06-15', 7200, now, now);

  const insertSong = db.prepare(`
    INSERT INTO songs (id, setlist_id, name, original_key, current_key, duration, song_order,
                       vocal_range_min, vocal_range_max, vocal_notes, guitar_tuning,
                       last_updated, updated_by, update_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSong.run(
    's-001', 'sl-001', '夜空中最亮的星', 'D', 'C', 280, 1,
    'G3', 'D5', '副歌部分注意换气', 'Standard',
    now, '音乐总监', '初始版本'
  );
  insertSong.run(
    's-002', 'sl-001', '海阔天空', 'C', 'Bb', 320, 2,
    'F3', 'C5', '主唱近期感冒，降1key', 'Standard',
    now, '音乐总监', '降调适配主唱'
  );
  insertSong.run(
    's-003', 'sl-001', '光辉岁月', 'E', 'H#', 295, 3,
    'G3', 'E5', null, 'Drop D',
    now, '巡演经理', '临时录入'
  );

  const insertSongVersion = db.prepare(`
    INSERT INTO song_versions (song_id, version, field_name, old_value, new_value, updated_at, updated_by, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSongVersion.run(
    's-002', 1, 'currentKey', 'C', 'Bb', now, '音乐总监', '降调适配主唱'
  );
};

export default initDatabase;
