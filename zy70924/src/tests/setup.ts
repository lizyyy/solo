import sqlite3 from 'sqlite3';

beforeAll(async () => {
  const db = new sqlite3.Database(':memory:');
  await new Promise<void>((resolve) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id TEXT PRIMARY KEY,
          course_name TEXT NOT NULL,
          course_code TEXT NOT NULL,
          batch_number TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          total_students INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    });
    resolve();
  });
  db.close();
});
