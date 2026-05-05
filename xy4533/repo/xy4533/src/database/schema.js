const SCHEMA = {
  artworks: `
    CREATE TABLE IF NOT EXISTS artworks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      client_name TEXT,
      artwork_name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      start_date TEXT,
      expected_completion_date TEXT,
      status TEXT DEFAULT 'in_progress',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  layers: `
    CREATE TABLE IF NOT EXISTS layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artwork_id INTEGER NOT NULL,
      layer_number INTEGER NOT NULL,
      lacquer_type TEXT,
      thickness TEXT,
      color TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artwork_id) REFERENCES artworks(id),
      UNIQUE(artwork_id, layer_number)
    )
  `,
  
  processes: `
    CREATE TABLE IF NOT EXISTS processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layer_id INTEGER NOT NULL,
      process_type TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_hours REAL,
      status TEXT DEFAULT 'pending',
      operator_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (layer_id) REFERENCES layers(id),
      UNIQUE(layer_id, process_type)
    )
  `,
  
  wetroom_readings: `
    CREATE TABLE IF NOT EXISTS wetroom_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cabinet_id TEXT NOT NULL,
      reading_time TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      recorded_by TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cabinet_id, reading_time)
    )
  `,
  
  reviews: `
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layer_id INTEGER NOT NULL,
      process_type TEXT,
      reviewer_name TEXT,
      review_date TEXT,
      signature TEXT,
      status TEXT DEFAULT 'pending',
      comments TEXT,
      issues_found TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (layer_id) REFERENCES layers(id)
    )
  `,
  
  handover_notes: `
    CREATE TABLE IF NOT EXISTS handover_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artwork_id INTEGER NOT NULL,
      from_apprentice TEXT,
      to_apprentice TEXT,
      handover_date TEXT,
      notes TEXT,
      layer_number INTEGER,
      next_process TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artwork_id) REFERENCES artworks(id)
    )
  `,
  
  violations: `
    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      description TEXT,
      artwork_id INTEGER,
      layer_id INTEGER,
      process_type TEXT,
      cabinet_id TEXT,
      reading_id INTEGER,
      detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved BOOLEAN DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution_notes TEXT,
      FOREIGN KEY (artwork_id) REFERENCES artworks(id),
      FOREIGN KEY (layer_id) REFERENCES layers(id),
      FOREIGN KEY (reading_id) REFERENCES wetroom_readings(id)
    )
  `
};

module.exports = SCHEMA;
