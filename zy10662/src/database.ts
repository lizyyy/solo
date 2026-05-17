import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'violation-review.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS violation_fragments (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          room_name TEXT NOT NULL,
          anchor_name TEXT NOT NULL,
          fragment_start_time INTEGER NOT NULL,
          fragment_end_time INTEGER NOT NULL,
          violation_tag TEXT NOT NULL,
          violation_description TEXT,
          detect_model TEXT NOT NULL,
          confidence REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          reviewer_id TEXT,
          reviewer_name TEXT,
          review_comment TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          has_conflict INTEGER DEFAULT 0,
          conflict_info TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS review_history (
          id TEXT PRIMARY KEY,
          fragment_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          operation_source TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          comment TEXT,
          changed_fields TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_fragment_room ON violation_fragments(room_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_fragment_status ON violation_fragments(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_fragment_time ON violation_fragments(fragment_start_time)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_history_fragment ON review_history(fragment_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export { db, initDb };
