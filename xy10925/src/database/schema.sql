CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  max_participants INTEGER NOT NULL DEFAULT 50,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS athletes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  id_card TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  group_id INTEGER,
  registration_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL,
  doc_number TEXT,
  is_valid BOOLEAN DEFAULT 0,
  upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME,
  verified_by TEXT,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id),
  UNIQUE(athlete_id, doc_type)
);

CREATE TABLE IF NOT EXISTS substitutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL UNIQUE,
  group_id INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  is_promoted BOOLEAN DEFAULT 0,
  promoted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id),
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

CREATE TABLE IF NOT EXISTS checkin_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  operator TEXT,
  notes TEXT,
  raw_input TEXT,
  processing_result TEXT,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT,
  reason TEXT,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id)
);

CREATE TABLE IF NOT EXISTS qualification_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  athlete_id INTEGER NOT NULL,
  report_data TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  generated_by TEXT,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id)
);

CREATE INDEX IF NOT EXISTS idx_athletes_id_card ON athletes(id_card);
CREATE INDEX IF NOT EXISTS idx_checkin_athlete ON checkin_events(athlete_id);
CREATE INDEX IF NOT EXISTS idx_status_athlete ON status_history(athlete_id);
