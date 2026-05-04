const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

function initDatabase(dbPath = config.db.path) {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS frequencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      device_id INTEGER NOT NULL,
      frequency REAL NOT NULL,
      band TEXT,
      channel TEXT,
      tx_power TEXT,
      antenna_gain REAL,
      is_backup INTEGER DEFAULT 0,
      backup_for_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
      FOREIGN KEY (backup_for_id) REFERENCES frequencies(id)
    );

    CREATE TABLE IF NOT EXISTS forbidden_bands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT,
      freq_start REAL NOT NULL,
      freq_end REAL NOT NULL,
      reason TEXT,
      priority INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      frequency_1_id INTEGER,
      frequency_2_id INTEGER,
      details TEXT NOT NULL,
      intermod_value REAL,
      intermod_orders TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (frequency_1_id) REFERENCES frequencies(id),
      FOREIGN KEY (frequency_2_id) REFERENCES frequencies(id)
    );

    CREATE TABLE IF NOT EXISTS resolution_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conflict_id INTEGER NOT NULL,
      frequency_id INTEGER,
      action TEXT,
      suggested_frequency REAL,
      notes TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conflict_id) REFERENCES conflicts(id) ON DELETE CASCADE,
      FOREIGN KEY (frequency_id) REFERENCES frequencies(id)
    );

    CREATE INDEX IF NOT EXISTS idx_frequencies_session ON frequencies(session_id);
    CREATE INDEX IF NOT EXISTS idx_frequencies_device ON frequencies(device_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_session ON conflicts(session_id);
    CREATE INDEX IF NOT EXISTS idx_forbidden_bands_session ON forbidden_bands(session_id);
  `);

  db.close();
  console.log(`数据库初始化完成: ${dbPath}`);
}

module.exports = initDatabase;
