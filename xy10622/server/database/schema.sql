CREATE TABLE IF NOT EXISTS volunteers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  total_hours REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS volunteer_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id INTEGER,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT,
  standard_hours REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER,
  volunteer_id INTEGER,
  checkin_time TEXT,
  checkout_time TEXT,
  hours REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_id) REFERENCES activities(id),
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
);

CREATE TABLE IF NOT EXISTS checkin_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checkin_id) REFERENCES activity_checkins(id)
);

CREATE TABLE IF NOT EXISTS captain_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  captain_id INTEGER,
  confirmed_hours REAL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  confirmed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checkin_id) REFERENCES activity_checkins(id),
  FOREIGN KEY (captain_id) REFERENCES volunteers(id)
);

CREATE TABLE IF NOT EXISTS confirmation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  confirmation_id INTEGER,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (confirmation_id) REFERENCES captain_confirmations(id)
);

CREATE TABLE IF NOT EXISTS missing_checkouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  status TEXT DEFAULT 'pending',
  handled_by TEXT,
  handled_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checkin_id) REFERENCES activity_checkins(id)
);

CREATE TABLE IF NOT EXISTS supplemental_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkin_id INTEGER,
  auditor_id INTEGER,
  original_hours REAL,
  approved_hours REAL,
  status TEXT DEFAULT 'pending',
  reason TEXT,
  handled_by TEXT,
  handled_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (checkin_id) REFERENCES activity_checkins(id),
  FOREIGN KEY (auditor_id) REFERENCES volunteers(id)
);

CREATE TABLE IF NOT EXISTS honor_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id INTEGER,
  honor_name TEXT,
  required_hours REAL,
  status TEXT DEFAULT 'pending',
  redeemed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id)
);
