const db = require('../utils/database');

async function initTables() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS hazards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      level TEXT NOT NULL,
      discover_date TEXT NOT NULL,
      discoverer TEXT NOT NULL,
      department TEXT,
      responsible_person TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      rectification_description TEXT,
      rectification_date TEXT,
      rectification_complete_date TEXT,
      review_result TEXT,
      review_date TEXT,
      reviewer TEXT,
      review_comments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id TEXT UNIQUE NOT NULL,
      hazard_code TEXT NOT NULL,
      photo_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      uploader TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_code) REFERENCES hazards(hazard_code)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_code TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hazard_code) REFERENCES hazards(hazard_code)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      import_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      raw_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      suggestion TEXT,
      hazard_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id)
    )
  `);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_hazards_status ON hazards(status)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_hazards_level ON hazards(level)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_hazards_hazard_code ON hazards(hazard_code)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_photos_hazard_code ON photos(hazard_code)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_status_history_hazard_code ON status_history(hazard_code)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_import_records_batch_id ON import_records(batch_id)`);
}

async function initDatabase() {
  await db.connect();
  await initTables();
  console.log('数据库初始化完成');
}

module.exports = { initDatabase, initTables };
