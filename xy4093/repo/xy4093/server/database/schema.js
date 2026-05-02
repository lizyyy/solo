const DATABASE_PATH = './data/typhoon.db';

const SCHEMAS = {
  rooms: `
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_number TEXT NOT NULL UNIQUE,
      floor INTEGER,
      capacity INTEGER DEFAULT 2,
      status TEXT DEFAULT 'available',
      is_occupied INTEGER DEFAULT 0,
      is_evacuated INTEGER DEFAULT 0,
      is_window_sealed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  guests: `
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      room_id TEXT,
      name TEXT NOT NULL,
      id_number TEXT,
      phone TEXT,
      age INTEGER,
      gender TEXT,
      is_elderly INTEGER DEFAULT 0,
      is_child INTEGER DEFAULT 0,
      has_disability INTEGER DEFAULT 0,
      nationality TEXT DEFAULT '中国',
      checkin_date TEXT,
      checkout_date TEXT,
      is_evacuated INTEGER DEFAULT 0,
      evacuation_batch_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (evacuation_batch_id) REFERENCES evacuation_batches(id)
    )
  `,
  
  ships: `
    CREATE TABLE IF NOT EXISTS ships (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      current_load INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      departure_time TEXT,
      estimated_arrival TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  supplies: `
    CREATE TABLE IF NOT EXISTS supplies (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      unit TEXT,
      min_threshold REAL DEFAULT 0,
      status TEXT DEFAULT 'sufficient',
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  sandbags: `
    CREATE TABLE IF NOT EXISTS sandbags (
      id TEXT PRIMARY KEY,
      location TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      needed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  evacuation_batches: `
    CREATE TABLE IF NOT EXISTS evacuation_batches (
      id TEXT PRIMARY KEY,
      batch_number INTEGER NOT NULL UNIQUE,
      ship_id TEXT,
      scheduled_time TEXT,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'planned',
      guest_count INTEGER DEFAULT 0,
      max_capacity INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ship_id) REFERENCES ships(id)
    )
  `,
  
  system_settings: `
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_guests_room ON guests(room_id)',
  'CREATE INDEX IF NOT EXISTS idx_guests_evacuated ON guests(is_evacuated)',
  'CREATE INDEX IF NOT EXISTS idx_guests_elderly ON guests(is_elderly)',
  'CREATE INDEX IF NOT EXISTS idx_guests_child ON guests(is_child)',
  'CREATE INDEX IF NOT EXISTS idx_evacuation_batches_status ON evacuation_batches(status)',
  'CREATE INDEX IF NOT EXISTS idx_supplies_type ON supplies(type)'
];

export { DATABASE_PATH, SCHEMAS, INDEXES };
